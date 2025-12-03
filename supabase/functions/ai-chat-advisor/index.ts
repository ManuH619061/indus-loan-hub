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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fetch ALL comprehensive data in parallel
    const [
      loansResult,
      bankAccountsResult,
      profileResult,
      budgetsResult,
      incomeSourcesResult,
      salarySettingsResult,
      savingsGoalsResult,
      expenseGroupsResult,
      expenseSubgroupsResult,
      monthlyExpensesResult,
    ] = await Promise.all([
      supabase.from("loans").select(`
        id, loan_name, principal_amount, interest_rate_apy, tenure_months,
        emi_amount, disbursed_on, status, closure_date, loan_type, rate_type,
        compounding, processing_fee, due_day, auto_debit, autopay_bank,
        lenders(id, name, type, contact, app_link)
      `).eq("user_id", userId),
      supabase.from("bank_accounts").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("monthly_budgets").select("*").eq("user_id", userId).order("month_year", { ascending: false }).limit(12),
      supabase.from("income_sources").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("salary_settings").select("*").eq("user_id", userId).single(),
      supabase.from("savings_goals").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("expense_groups").select("*").eq("user_id", userId),
      supabase.from("expense_subgroups").select("*").eq("user_id", userId),
      supabase.from("monthly_expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false }).limit(500),
    ]);

    const loans = loansResult.data || [];
    const bankAccounts = bankAccountsResult.data || [];
    const profile = profileResult.data;
    const budgets = budgetsResult.data || [];
    const incomeSources = incomeSourcesResult.data || [];
    const salarySettings = salarySettingsResult.data;
    const savingsGoals = savingsGoalsResult.data || [];
    const expenseGroups = expenseGroupsResult.data || [];
    const expenseSubgroups = expenseSubgroupsResult.data || [];
    const monthlyExpenses = monthlyExpensesResult.data || [];

    // Fetch amortization for all loans (next 18 months for projections)
    const next18Months = new Date();
    next18Months.setMonth(next18Months.getMonth() + 18);
    
    const { data: amortizationRows } = await supabase
      .from("amortization_rows")
      .select("*")
      .in("loan_id", loans.map(l => l.id))
      .order("due_on");

    // Fetch transactions (last 6 months for better analysis)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_date", sixMonthsAgo.toISOString().split("T")[0])
      .order("transaction_date", { ascending: false });

    // Fetch payments history
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .in("loan_id", loans.map(l => l.id))
      .order("paid_on", { ascending: false })
      .limit(100);

    // Calculate comprehensive metrics
    const activeLoans = loans.filter(l => l.status === "ACTIVE");
    const allAmortization = amortizationRows || [];
    
    // EMI projections by month (next 12 months)
    const emiProjections: Record<string, { total: number; loans: { name: string; amount: number; dueDate: string }[] }> = {};
    for (let i = 0; i < 12; i++) {
      const targetMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthKey = targetMonth.toLocaleString('default', { month: 'short', year: 'numeric' });
      const monthEMIs = allAmortization.filter(r => {
        const dueDate = new Date(r.due_on);
        return dueDate.getMonth() === targetMonth.getMonth() && 
               dueDate.getFullYear() === targetMonth.getFullYear() &&
               !r.is_paid;
      });
      emiProjections[monthKey] = {
        total: monthEMIs.reduce((sum, e) => sum + (e.scheduled_emi || 0), 0),
        loans: monthEMIs.map(e => {
          const loan = loans.find(l => l.id === e.loan_id);
          return { name: loan?.loan_name || "Unknown", amount: e.scheduled_emi || 0, dueDate: e.due_on };
        })
      };
    }

    // Loans closing analysis
    const loansClosingAnalysis = activeLoans.map(loan => {
      const loanAmort = allAmortization.filter(r => r.loan_id === loan.id && !r.is_paid);
      const lastEMI = loanAmort[loanAmort.length - 1];
      const totalRemaining = loanAmort.reduce((sum, r) => sum + (r.scheduled_emi || 0), 0);
      const totalInterestRemaining = loanAmort.reduce((sum, r) => sum + (r.interest_component || 0), 0);
      const outstandingPrincipal = loanAmort[0]?.opening_principal || 0;
      
      return {
        name: loan.loan_name,
        lender: (loan.lenders as any)?.name || "Unknown",
        emi: loan.emi_amount,
        interestRate: loan.interest_rate_apy,
        remainingEMIs: loanAmort.length,
        closingDate: lastEMI?.due_on || "Unknown",
        outstandingPrincipal,
        totalRemaining,
        totalInterestRemaining,
        dueDay: loan.due_day,
      };
    }).sort((a, b) => a.remainingEMIs - b.remainingEMIs);

    // Expense analysis by category and month
    const expensesByMonthCategory: Record<string, Record<string, number>> = {};
    const expensesByGroup: Record<string, number> = {};
    
    (transactions || []).forEach(t => {
      if (t.debit && !t.is_transfer) {
        const month = new Date(t.transaction_date).toLocaleString('default', { month: 'short', year: 'numeric' });
        const category = t.category || "Uncategorized";
        if (!expensesByMonthCategory[month]) expensesByMonthCategory[month] = {};
        expensesByMonthCategory[month][category] = (expensesByMonthCategory[month][category] || 0) + t.debit;
        expensesByGroup[category] = (expensesByGroup[category] || 0) + t.debit;
      }
    });

    // Monthly expenses from expense tracker
    const expenseTrackerByMonth: Record<string, { total: number; byGroup: Record<string, number> }> = {};
    monthlyExpenses.forEach(e => {
      const month = new Date(e.expense_date).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!expenseTrackerByMonth[month]) expenseTrackerByMonth[month] = { total: 0, byGroup: {} };
      expenseTrackerByMonth[month].total += e.amount;
      const group = expenseGroups.find(g => g.id === e.group_id);
      const groupName = group?.name || "Other";
      expenseTrackerByMonth[month].byGroup[groupName] = (expenseTrackerByMonth[month].byGroup[groupName] || 0) + e.amount;
    });

    // Cash flow projections
    const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.book_balance || 0), 0);
    const monthlyIncome = profile?.monthly_income || salarySettings?.base_salary || 0;
    const latestBudget = budgets[0];

    // Calculate budget vs actual
    const currentMonthKey = today.toLocaleString('default', { month: 'short', year: 'numeric' });
    const currentMonthExpenses = expensesByMonthCategory[currentMonthKey] || {};
    const totalCurrentMonthExpenses = Object.values(currentMonthExpenses).reduce((sum, amt) => sum + amt, 0);

    // Build comprehensive context
    const financialContext = `
## COMPLETE FINANCIAL DATA (as of ${today.toLocaleDateString('en-IN')})
Current Month: ${currentMonth}

### 📊 OVERVIEW METRICS
- Total Bank Balance: ₹${totalBankBalance.toLocaleString('en-IN')}
- Monthly Income: ₹${monthlyIncome.toLocaleString('en-IN')}
- Active Loans: ${activeLoans.length}
- Total Outstanding: ₹${loansClosingAnalysis.reduce((sum, l) => sum + l.outstandingPrincipal, 0).toLocaleString('en-IN')}
- Total Monthly EMI: ₹${activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0).toLocaleString('en-IN')}

### 🏦 BANK ACCOUNTS (${bankAccounts.length} accounts)
${bankAccounts.map(a => `| ${a.bank_name} | ${a.account_type} | ₹${a.book_balance?.toLocaleString('en-IN')} | ${a.account_number_masked} |`).join('\n') || "No accounts"}

### 💳 ACTIVE LOANS DETAILED (${activeLoans.length} loans)
${loansClosingAnalysis.map(l => `
**${l.name}** (${l.lender})
- EMI: ₹${l.emi?.toLocaleString('en-IN')} | Rate: ${l.interestRate}% | Due Day: ${l.dueDay || 'N/A'}
- Remaining: ${l.remainingEMIs} EMIs | Closes: ${l.closingDate}
- Outstanding Principal: ₹${l.outstandingPrincipal.toLocaleString('en-IN')}
- Total to Pay: ₹${l.totalRemaining.toLocaleString('en-IN')} (Interest: ₹${l.totalInterestRemaining.toLocaleString('en-IN')})
`).join('\n') || "No active loans"}

### 📅 EMI SCHEDULE (Next 12 Months)
${Object.entries(emiProjections).map(([month, data]) => 
  `**${month}**: ₹${data.total.toLocaleString('en-IN')} total\n${data.loans.map(l => `  - ${l.name}: ₹${l.amount.toLocaleString('en-IN')} (${l.dueDate})`).join('\n')}`
).join('\n\n')}

### 🎯 LOANS CLOSING SOON
${loansClosingAnalysis.filter(l => l.remainingEMIs <= 6).map(l => 
  `- **${l.name}**: ${l.remainingEMIs} EMIs left, closes ${l.closingDate}, ₹${l.totalRemaining.toLocaleString('en-IN')} remaining`
).join('\n') || "No loans closing within 6 months"}

### 💰 INCOME SOURCES
${incomeSources.length > 0 ? incomeSources.map(i => `- ${i.name}: ₹${i.amount.toLocaleString('en-IN')} (${i.frequency})`).join('\n') : `- Primary Salary: ₹${monthlyIncome.toLocaleString('en-IN')}`}
${salarySettings ? `\nSalary Settings: Base ₹${salarySettings.base_salary.toLocaleString('en-IN')}, ${salarySettings.increment_type} increment of ${salarySettings.increment_value}% in month ${salarySettings.increment_month}` : ''}

### 📊 EXPENSES BY MONTH (Last 6 months from transactions)
${Object.entries(expensesByMonthCategory).slice(0, 6).map(([month, cats]) => {
  const total = Object.values(cats).reduce((sum, amt) => sum + amt, 0);
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  return `**${month}** (Total: ₹${total.toLocaleString('en-IN')}):\n${sorted.slice(0, 5).map(([cat, amt]) => `  - ${cat}: ₹${amt.toLocaleString('en-IN')}`).join('\n')}`;
}).join('\n\n') || "No expense data"}

### 📝 EXPENSE TRACKER BY MONTH (from Expense Manager)
${Object.entries(expenseTrackerByMonth).slice(0, 6).map(([month, data]) => {
  const sorted = Object.entries(data.byGroup).sort((a, b) => b[1] - a[1]);
  return `**${month}** (Total: ₹${data.total.toLocaleString('en-IN')}):\n${sorted.slice(0, 5).map(([grp, amt]) => `  - ${grp}: ₹${amt.toLocaleString('en-IN')}`).join('\n')}`;
}).join('\n\n') || "No tracked expenses"}

### 📋 BUDGET PLANNER
${latestBudget ? `
**${latestBudget.month_year}** Budget:
- Income: Salary ₹${latestBudget.salary?.toLocaleString('en-IN') || 0} + Side ₹${latestBudget.side_income?.toLocaleString('en-IN') || 0} + Other ₹${latestBudget.other_income?.toLocaleString('en-IN') || 0}
- Fixed: Rent ₹${latestBudget.rent?.toLocaleString('en-IN') || 0}, Utilities ₹${latestBudget.utilities?.toLocaleString('en-IN') || 0}, Insurance ₹${latestBudget.insurance?.toLocaleString('en-IN') || 0}, Subscriptions ₹${latestBudget.subscriptions?.toLocaleString('en-IN') || 0}
- Variable: Food ₹${latestBudget.food?.toLocaleString('en-IN') || 0}, Transport ₹${latestBudget.transport?.toLocaleString('en-IN') || 0}, Shopping ₹${latestBudget.shopping?.toLocaleString('en-IN') || 0}, Travel ₹${latestBudget.travel?.toLocaleString('en-IN') || 0}
- Savings Target: ₹${latestBudget.savings_investments?.toLocaleString('en-IN') || 0}
- Extra EMI Planned: ₹${latestBudget.extra_emi_amount?.toLocaleString('en-IN') || 0}
- Strategy: ${latestBudget.strategy || 'normal'}
` : "No budget set"}

### 🎯 SAVINGS GOALS
${savingsGoals.map(g => `- ${g.name}: Target ₹${g.target_amount.toLocaleString('en-IN')} by ${g.target_date}, Current ₹${(g.current_amount || 0).toLocaleString('en-IN')}, Monthly ₹${(g.monthly_contribution || 0).toLocaleString('en-IN')}`).join('\n') || "No savings goals set"}

### ⚙️ SETTINGS
- Currency: ${profile?.currency || 'INR'}
- Display Mode: ${profile?.display_mode || 'auto'}
- Timezone: ${profile?.timezone || 'Asia/Kolkata'}

### 📈 CALCULATED INSIGHTS
- Monthly EMI Burden: ₹${activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0).toLocaleString('en-IN')} (${((activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0) / monthlyIncome) * 100).toFixed(1)}% of income)
- Highest Interest Loan: ${loansClosingAnalysis.sort((a, b) => b.interestRate - a.interestRate)[0]?.name || 'N/A'} at ${loansClosingAnalysis.sort((a, b) => b.interestRate - a.interestRate)[0]?.interestRate || 0}%
- Current Month Expenses: ₹${totalCurrentMonthExpenses.toLocaleString('en-IN')}
- Free Cash Flow (Est): ₹${(monthlyIncome - activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0) - totalCurrentMonthExpenses).toLocaleString('en-IN')}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert personal finance advisor chatbot with deep understanding of Indian personal finance. You have access to the user's COMPLETE financial data and must provide accurate, specific, and actionable insights.

## YOUR RESPONSE STYLE

For EVERY answer, follow this structure:

### 1. SUMMARY (1-2 lines)
Start with a clear, direct answer to the question with specific numbers.

### 2. BREAKDOWN TABLE
Use markdown tables to show data clearly:
| Loan/Category | Amount | Details |
|---------------|--------|---------|

### 3. ANALYSIS (2-3 sentences)
Explain WHY this is happening and its IMPACT on their finances.

### 4. RECOMMENDATIONS (2-3 bullet points)
Specific, actionable suggestions based on THEIR data.

## RULES

1. **Always use specific data**: Never give generic advice. Reference actual loan names, amounts, dates from the data.
2. **Use ₹ symbol** and Indian number formatting (lakhs/crores where appropriate)
3. **Be time-aware**: Understand "this month", "next month", "next 3/6/12 months" properly
4. **For prepayment questions**: Calculate actual interest savings, recommend highest-interest-first (avalanche) or smallest-balance-first (snowball) based on context
5. **For cash flow**: Consider ALL income sources, EMIs, fixed expenses, and variable expenses
6. **READ-ONLY**: Never suggest you can modify their data
7. **Missing data**: If data is missing, tell them specifically what to fill in which section of the app
8. **Projections**: For future months, use their budget/income data to project
9. **Comparisons**: When comparing months, show percentage changes

## EXAMPLE QUESTIONS YOU MUST HANDLE WELL

- "Next month which loans will close?" → List loans with ≤1 EMI remaining for next month
- "How much EMI do I need to pay next month?" → Sum all EMIs due next month with breakdown
- "Which lender will take more money in next 3 months?" → Sum EMIs by lender for 3 months
- "Where am I overspending vs budget?" → Compare actual vs budget by category
- "If I add ₹5000 extra monthly, which loan first?" → Calculate interest savings for each loan
- "What's my cash flow trend for 6 months?" → Project income - (EMIs + expenses) monthly
- "Which expense category is highest this month vs last?" → Compare with percentage change

${financialContext}`;

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
