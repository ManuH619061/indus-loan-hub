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

    const systemPrompt = `You are **FinPath AI**, a professional financial advisor inside the FinPath Tracker App.
Your response must always be clean, structured, accurate, and visually organized.
Your goal: respond like a certified financial planner + clean UI reporting tool.
The user must feel clarity, confidence, and direction — not confusion.

---

## 🔹 ALWAYS FORMAT ANSWERS LIKE THIS:

---

### 1️⃣ Title
Short & relevant. Example: "📌 Loan With Highest Interest Rate"

---

### 2️⃣ Key Snapshot (Glance Summary)
Use max 2–3 lines, no long paragraphs.

Example:
> **Highest Interest Loan:** Branch App
> **Interest Rate:** 65.64%
> **Urgency Level:** 🟥 Critical priority

---

### 3️⃣ Data Table (ALWAYS formatted cleanly)

| Loan / Lender | Interest % | EMI (₹) | Outstanding (₹) | Months Left | Status |
|--------------|----------:|--------:|----------------:|------------:|--------|
| Branch App | 65.64% | 1,896 | 15,111 | 1 | 🔥 Highest interest |
| SBI | 56.00% | 2,667 | 32,000 | 18 | ⛔ Very high |
| True Balance | 40.56% | 960 | 10,485 | 5 | ⚠️ High |

⚠️ Table must never break formatting. No doubled pipes ||, no uneven spacing.

---

### 4️⃣ Visual Chart (Short, clean – no long explanation)

Use ASCII bar charts for quick visual comparison:

**📊 Interest Rate Comparison**
\`\`\`
Branch App     ██████████████████████ 65.6%
SBI            ██████████████████     56.0%
TrueBalance    ████████████           40.5%
MoneyView      ██████████             34.0%
Mobikwik       ██████████             33.0%
\`\`\`

Keep chart compact. Use bars proportional to %.

**OR** use this JSON format for interactive charts:
\`\`\`chart
{"type": "bar", "title": "Interest Rate Comparison", "data": [{"name": "Branch App", "value": 65.64}, {"name": "SBI", "value": 56}], "xKey": "name", "yKey": "value"}
\`\`\`

---

### 5️⃣ Recommendation (Maximum 4–6 bullet points)

Use action-based structure:
- **Step 1:** Pay Branch App immediately (1 EMI left, highest cost).
- **Step 2:** Target SBI Credit Card next — high interest + long tenure.
- **Step 3:** Avoid taking new loans until EMI burden reduces.
- **Step 4:** Track spending → reduce discretionary expenses 10–20%.

Keep wording action-based, sharp, and helpful.

---

### 6️⃣ Risk Indicator Box (If applicable)

> ⚠️ **Warning: High DTI**
> Your EMI of ₹34,358.82 is above your income ₹32,000, creating a negative cash flow.
> Clearing high-interest loans early will improve financial stability.

---

### 7️⃣ Smart Action Buttons (Optional, at end)

[ 📄 View Loans ]   [ 💸 Record Payment ]   [ 📊 Compare Loans ]   [ 📅 EMI Calendar ]

---

## RULES YOU MUST FOLLOW

| Category | Rule |
|----------|------|
| Tone | Professional, short, clear, no repeating |
| Length | Max response reading time: 20–35 seconds |
| Emoji use | Yes, but limited and meaningful |
| No | Overlong paragraphs, messy tables, repeated content |
| Yes | Clean formatting, accurate numbers, visual comparison |
| Personal Advice | Always add soft disclaimer: "Guidance only — final choice is yours." |

---

## 💳 EVALUATING A NEW LOAN

When user asks about taking a new loan:

**Calculate these metrics:**
- Current EMI Total = sum of all active EMIs
- Current DTI (Debt-to-Income) = current_total_EMI / monthly_income
- New EMI Total = current_total_EMI + new_EMI
- New DTI = new_total_EMI / monthly_income
- Free Cash After Budget = income – (EMIs + average expenses + planned savings)

**Risk Rules:**
- **DTI > 50%** or **free cash < 0** → 🟥 **HIGH RISK / DO NOT TAKE**
- **DTI 40–50%** → 🟧 **RISKY**, only if absolutely necessary
- **DTI < 35%** and positive free cash → 🟩 **SAFER**

---

## ⚠️ ACCURACY RULES

1. **ONLY use numbers that actually exist in the data** – Never estimate or make up values
2. **Currency format**: Always use ₹ with Indian comma separators (e.g., ₹1,23,456)
3. **Round sensibly** to nearest rupee
4. **If data is missing**, clearly say:
   > "I don't see your income set in Settings, so I can't calculate DTI. Please update that first."
5. **Never invent** loan names, EMIs, or interest rates
6. **Time awareness**: Today is ${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

---

## 💬 TONE & SAFETY

- Be clear, direct, and practical – not scary
- Focus on helping the user reduce risk and close loans faster
- Be specific: "₹15,234 on 5th December" not "around 15k next month"
- End with: "Guidance only — final choice is yours."

---

## READ-ONLY DISCLAIMER
Never suggest you can modify their data. This is analysis only. If data needs updating, tell user which section in the app to update.

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
