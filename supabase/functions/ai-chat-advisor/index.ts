import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's financial data for context
    const userId = user.id;

    // Fetch loans with lenders
    const { data: loans } = await supabase
      .from("loans")
      .select(`
        id, loan_name, principal_amount, interest_rate_apy, tenure_months,
        emi_amount, disbursed_on, status, closure_date,
        lenders(name)
      `)
      .eq("user_id", userId);

    // Fetch amortization rows for next 12 months
    const today = new Date();
    const next12Months = new Date();
    next12Months.setMonth(next12Months.getMonth() + 12);
    
    const { data: amortizationRows } = await supabase
      .from("amortization_rows")
      .select("loan_id, period_no, due_on, scheduled_emi, principal_component, interest_component, is_paid, closing_principal")
      .in("loan_id", loans?.map(l => l.id) || [])
      .gte("due_on", today.toISOString().split("T")[0])
      .lte("due_on", next12Months.toISOString().split("T")[0])
      .order("due_on");

    // Fetch payments history
    const { data: payments } = await supabase
      .from("payments")
      .select("loan_id, paid_on, amount, payment_type")
      .in("loan_id", loans?.map(l => l.id) || [])
      .order("paid_on", { ascending: false })
      .limit(50);

    // Fetch monthly budgets
    const { data: budgets } = await supabase
      .from("monthly_budgets")
      .select("*")
      .eq("user_id", userId)
      .order("month_year", { ascending: false })
      .limit(6);

    // Fetch transactions (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const { data: transactions } = await supabase
      .from("transactions")
      .select("transaction_date, narration, debit, credit, category, subcategory, is_transfer")
      .eq("user_id", userId)
      .gte("transaction_date", threeMonthsAgo.toISOString().split("T")[0])
      .order("transaction_date", { ascending: false })
      .limit(200);

    // Fetch bank accounts
    const { data: bankAccounts } = await supabase
      .from("bank_accounts")
      .select("bank_name, account_type, book_balance, account_number_masked")
      .eq("user_id", userId)
      .eq("is_active", true);

    // Fetch profile for income
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_income, currency")
      .eq("id", userId)
      .single();

    // Build context summary
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Calculate expense summaries
    const expensesByMonth: Record<string, Record<string, number>> = {};
    transactions?.forEach(t => {
      if (t.debit && !t.is_transfer) {
        const month = new Date(t.transaction_date).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!expensesByMonth[month]) expensesByMonth[month] = {};
        const category = t.category || "Uncategorized";
        expensesByMonth[month][category] = (expensesByMonth[month][category] || 0) + t.debit;
      }
    });

    // Calculate upcoming EMIs
    const upcomingEMIs = amortizationRows?.filter(r => !r.is_paid) || [];
    const nextMonthEMIs = upcomingEMIs.filter(r => {
      const dueDate = new Date(r.due_on);
      return dueDate.getMonth() === nextMonth.getMonth() && dueDate.getFullYear() === nextMonth.getFullYear();
    });

    // Find loans closing soon
    const loansClosingSoon = loans?.filter(l => {
      if (l.status !== "ACTIVE") return false;
      const remainingEMIs = amortizationRows?.filter(r => r.loan_id === l.id && !r.is_paid) || [];
      return remainingEMIs.length > 0 && remainingEMIs.length <= 3;
    }) || [];

    // Build structured context
    const financialContext = `
## User's Financial Data (as of ${today.toLocaleDateString()})

### Active Loans (${loans?.filter(l => l.status === "ACTIVE").length || 0} total):
${loans?.filter(l => l.status === "ACTIVE").map(l => {
  const lenderData = l.lenders as unknown as { name: string } | { name: string }[] | null;
  const lenderName = Array.isArray(lenderData) ? lenderData[0]?.name : lenderData?.name || "Unknown Lender";
  const remainingEMIs = amortizationRows?.filter(r => r.loan_id === l.id && !r.is_paid) || [];
  const outstandingPrincipal = remainingEMIs[0]?.closing_principal || 0;
  return `- ${l.loan_name} (${lenderName}): Principal ₹${l.principal_amount?.toLocaleString()}, Rate ${l.interest_rate_apy}%, EMI ₹${l.emi_amount?.toLocaleString() || "N/A"}, ${remainingEMIs.length} EMIs remaining, Outstanding: ₹${outstandingPrincipal.toLocaleString()}`;
}).join("\n") || "No active loans"}

### Upcoming EMIs for ${nextMonthName}:
${nextMonthEMIs.map(e => {
  const loan = loans?.find(l => l.id === e.loan_id);
  return `- ${loan?.loan_name}: ₹${e.scheduled_emi?.toLocaleString()} due on ${e.due_on}`;
}).join("\n") || "No EMIs due next month"}

Total EMI for ${nextMonthName}: ₹${nextMonthEMIs.reduce((sum, e) => sum + (e.scheduled_emi || 0), 0).toLocaleString()}

### Loans Closing Soon (within 3 EMIs):
${loansClosingSoon.map(l => {
  const remainingEMIs = amortizationRows?.filter(r => r.loan_id === l.id && !r.is_paid) || [];
  const lastEMI = remainingEMIs[remainingEMIs.length - 1];
  return `- ${l.loan_name}: ${remainingEMIs.length} EMIs left, closes around ${lastEMI?.due_on || "Unknown"}`;
}).join("\n") || "No loans closing soon"}

### Bank Accounts:
${bankAccounts?.map(a => `- ${a.bank_name} (${a.account_type}): ₹${a.book_balance?.toLocaleString()}`).join("\n") || "No bank accounts"}
Total Balance: ₹${bankAccounts?.reduce((sum, a) => sum + (a.book_balance || 0), 0).toLocaleString() || 0}

### Monthly Income: ₹${profile?.monthly_income?.toLocaleString() || "Not set"}

### Recent Expenses by Category (Last 3 months):
${Object.entries(expensesByMonth).map(([month, categories]) => {
  const total = Object.values(categories).reduce((sum, amt) => sum + amt, 0);
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `  - ${cat}: ₹${amt.toLocaleString()}`)
    .join("\n");
  return `${month} (Total: ₹${total.toLocaleString()}):\n${topCategories}`;
}).join("\n\n") || "No expense data"}

### Latest Budget (${budgets?.[0]?.month_year || "Not set"}):
${budgets?.[0] ? `
- Salary: ₹${budgets[0].salary?.toLocaleString() || 0}
- Fixed expenses (rent, utilities, etc.): ₹${((budgets[0].rent || 0) + (budgets[0].utilities || 0) + (budgets[0].insurance || 0) + (budgets[0].subscriptions || 0)).toLocaleString()}
- Savings target: ₹${budgets[0].savings_investments?.toLocaleString() || 0}
` : "No budget set"}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a helpful financial advisor chatbot for a personal finance app. You have access to the user's real financial data and must answer questions accurately based on this data.

IMPORTANT RULES:
1. Always be specific with numbers, dates, and loan names
2. Keep responses concise and actionable (2-4 sentences max unless detailed breakdown requested)
3. Use ₹ symbol for Indian Rupees
4. Format numbers with commas for readability
5. If data is missing or question cannot be answered, clearly state what data is needed
6. You are READ-ONLY - never suggest you can make changes to their data
7. Be helpful and provide practical advice when appropriate
8. For prepayment questions, suggest targeting high-interest loans first unless asked otherwise

${financialContext}`;

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Chat Advisor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
