import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const loanSchema = z.object({
  loan_name: z.string().min(1).max(200),
  outstanding: z.number().positive().max(100000000),
  interest_rate_apy: z.number().min(0).max(100),
  emi_amount: z.number().nonnegative().max(10000000).optional(),
  rate_type: z.string().max(50),
});

const goalSchema = z.object({
  goal_type: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
});

const requestSchema = z.object({
  loans: z.array(loanSchema).min(1).max(50),
  monthlyIncome: z.number().positive().max(100000000).optional(),
  goals: z.array(goalSchema).max(20).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input data", 
          details: validationResult.error.format() 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { loans, monthlyIncome, goals } = validationResult.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build comprehensive context for AI
    const totalOutstanding = loans.reduce((sum: number, loan) => sum + loan.outstanding, 0);
    const totalMonthlyEMI = loans.reduce((sum: number, loan) => sum + (loan.emi_amount || 0), 0);
    const avgInterestRate = loans.length > 0 
      ? loans.reduce((sum: number, loan) => sum + loan.interest_rate_apy, 0) / loans.length 
      : 0;

    const systemPrompt = `You are an expert financial advisor specializing in debt management and payoff strategies. 
Your role is to analyze the user's loan portfolio and provide personalized, actionable advice to help them become debt-free efficiently.

Key principles to follow:
1. Prioritize high-interest debt (avalanche method) for maximum savings
2. Consider psychological wins (snowball method) when debt burden is overwhelming
3. Suggest realistic monthly extra payments based on income
4. Provide specific timelines and savings calculations
5. Give step-by-step actionable plans

Format your response with clear sections:
- **Summary**: Brief overview of current debt situation
- **Recommended Strategy**: Specific payoff approach with reasoning
- **Priority Order**: Which loans to focus on first
- **Monthly Action Plan**: Exact amounts to pay on each loan
- **Timeline**: When they'll be debt-free with your plan
- **Total Savings**: How much interest they'll save
- **Tips**: 3-5 practical tips to stay on track`;

    const userPrompt = `Please analyze my debt situation and create a personalized debt payoff plan:

**Current Debt Portfolio:**
${loans.map((loan, idx: number) => `
${idx + 1}. ${loan.loan_name}
   - Outstanding: ₹${loan.outstanding.toLocaleString('en-IN')}
   - Interest Rate: ${loan.interest_rate_apy}% APY
   - Monthly EMI: ₹${(loan.emi_amount || 0).toLocaleString('en-IN')}
   - Rate Type: ${loan.rate_type}
`).join('\n')}

**Financial Summary:**
- Total Outstanding Debt: ₹${totalOutstanding.toLocaleString('en-IN')}
- Total Monthly EMI: ₹${totalMonthlyEMI.toLocaleString('en-IN')}
- Average Interest Rate: ${avgInterestRate.toFixed(2)}%
${monthlyIncome ? `- Monthly Income: ₹${monthlyIncome.toLocaleString('en-IN')}` : ''}
${monthlyIncome ? `- EMI to Income Ratio: ${((totalMonthlyEMI / monthlyIncome) * 100).toFixed(1)}%` : ''}

${goals && goals.length > 0 ? `**Current Goals:**
${goals.map((goal, idx: number) => `${idx + 1}. ${goal.goal_type}: ${goal.notes || 'No notes'}`).join('\n')}` : ''}

Please provide a comprehensive debt payoff strategy tailored to my situation. Include specific recommendations on:
1. Which debt repayment strategy suits me best (avalanche vs snowball)
2. Exact monthly payment allocations
3. Realistic timeline to become debt-free
4. How much interest I can save
5. Any budget optimizations I should consider`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const advice = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ advice }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in debt-advisor function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
