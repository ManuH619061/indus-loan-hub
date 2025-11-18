import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Sparkles, ArrowUpCircle, ArrowDownCircle, Save, Target, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";
import MonthlyBudgetForm from "@/components/budget/MonthlyBudgetForm";
import BudgetSummaryCards from "@/components/budget/BudgetSummaryCards";
import FutureMonthsPlanner from "@/components/budget/FutureMonthsPlanner";
import LoanStrategies from "@/components/budget/LoanStrategies";
import BudgetReports from "@/components/budget/BudgetReports";
import { z } from "zod";

interface MonthlyBudgetData {
  salary: number;
  sideIncome: number;
  otherIncome: number;
  rent: number;
  food: number;
  foodLimit: number;
  transport: number;
  utilities: number;
  school: number;
  subscriptions: number;
  insurance: number;
  eatingOut: number;
  eatingOutLimit: number;
  shopping: number;
  shoppingLimit: number;
  travel: number;
  travelLimit: number;
  otherVariable: number;
  savingsInvestments: number;
  strategy: "normal" | "aggressive" | "safe";
  extraEMI: number;
}

interface ForecastMonth {
  monthYear: string;
  income: number;
  otherExpenses: number;
  plannedSavings: number;
}

interface Loan {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  emi_amount: number;
  tenure_months: number;
  disbursed_on: string;
  status: string;
}

export default function BudgetPlanner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [budget, setBudget] = useState<MonthlyBudgetData>({
    salary: 0, sideIncome: 0, otherIncome: 0, rent: 0, food: 0, foodLimit: 0,
    transport: 0, utilities: 0, school: 0, subscriptions: 0, insurance: 0,
    eatingOut: 0, eatingOutLimit: 0, shopping: 0, shoppingLimit: 0, travel: 0,
    travelLimit: 0, otherVariable: 0, savingsInvestments: 0, strategy: "normal", extraEMI: 0,
  });

  const [futureMonths, setFutureMonths] = useState<ForecastMonth[]>(() => {
    const months: ForecastMonth[] = [];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        monthYear: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        income: 0, otherExpenses: 0, plannedSavings: 0,
      });
    }
    return months;
  });

  useEffect(() => {
    fetchData();
  }, [user, selectedMonth]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: loansData } = await supabase.from("loans").select("*").eq("user_id", user.id).eq("status", "ACTIVE");
      setLoans(loansData || []);
      const { data: budgetData } = await supabase.from("monthly_budgets").select("*").eq("user_id", user.id).eq("month_year", selectedMonth).maybeSingle();
      if (budgetData) {
        setBudget({
          salary: budgetData.salary || 0, sideIncome: budgetData.side_income || 0, otherIncome: budgetData.other_income || 0,
          rent: budgetData.rent || 0, food: budgetData.food || 0, foodLimit: budgetData.food_limit || 0,
          transport: budgetData.transport || 0, utilities: budgetData.utilities || 0, school: budgetData.school || 0,
          subscriptions: budgetData.subscriptions || 0, insurance: budgetData.insurance || 0,
          eatingOut: budgetData.eating_out || 0, eatingOutLimit: budgetData.eating_out_limit || 0,
          shopping: budgetData.shopping || 0, shoppingLimit: budgetData.shopping_limit || 0,
          travel: budgetData.travel || 0, travelLimit: budgetData.travel_limit || 0,
          otherVariable: budgetData.other_variable || 0, savingsInvestments: budgetData.savings_investments || 0,
          strategy: (budgetData.strategy as any) || "normal", extraEMI: budgetData.extra_emi_amount || 0,
        });
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const budgetSchema = z.object({
    salary: z.number().min(0, "Salary cannot be negative").max(10000000, "Amount too large"),
    sideIncome: z.number().min(0, "Income cannot be negative").max(10000000, "Amount too large"),
    otherIncome: z.number().min(0, "Income cannot be negative").max(10000000, "Amount too large"),
    rent: z.number().min(0, "Expense cannot be negative").max(10000000, "Amount too large"),
    extraEMI: z.number().min(0, "Extra EMI cannot be negative").max(10000000, "Amount too large"),
  });

  const saveBudget = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Validate budget values
      const validationResult = budgetSchema.safeParse({
        salary: budget.salary,
        sideIncome: budget.sideIncome,
        otherIncome: budget.otherIncome,
        rent: budget.rent,
        extraEMI: budget.extraEMI,
      });

      if (!validationResult.success) {
        const errorMsg = validationResult.error.errors[0].message;
        toast.error(`Validation error: ${errorMsg}`);
        setSaving(false);
        return;
      }

      await supabase.from("monthly_budgets").upsert({
        user_id: user.id, month_year: selectedMonth, salary: budget.salary, side_income: budget.sideIncome,
        other_income: budget.otherIncome, rent: budget.rent, food: budget.food, food_limit: budget.foodLimit,
        transport: budget.transport, utilities: budget.utilities, school: budget.school,
        subscriptions: budget.subscriptions, insurance: budget.insurance, eating_out: budget.eatingOut,
        eating_out_limit: budget.eatingOutLimit, shopping: budget.shopping, shopping_limit: budget.shoppingLimit,
        travel: budget.travel, travel_limit: budget.travelLimit, other_variable: budget.otherVariable,
        savings_investments: budget.savingsInvestments, strategy: budget.strategy, extra_emi_amount: budget.extraEMI,
      });
      toast.success("Budget saved successfully");
    } catch (error) {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  const totalIncome = budget.salary + budget.sideIncome + budget.otherIncome;
  const totalFixedExpenses = budget.rent + budget.food + budget.transport + budget.utilities + budget.school + budget.subscriptions + budget.insurance;
  const totalVariableExpenses = budget.eatingOut + budget.shopping + budget.travel + budget.otherVariable;
  const totalExpenses = totalFixedExpenses + totalVariableExpenses;
  const totalEMI = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
  const freeCash = totalIncome - totalExpenses - totalEMI - budget.savingsInvestments;
  const debtBurden = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;

  const calculateStrategy = (type: "normal" | "aggressive" | "safe") => {
    const cuts = type === "aggressive" ? 30 : type === "safe" ? 10 : 20;
    const extra = type === "aggressive" ? freeCash * 0.8 : type === "safe" ? freeCash * 0.3 : freeCash * 0.5;
    const saved = extra > 0 ? Math.floor(totalEMI * 0.2 / extra) : 0;
    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + Math.max(0, 36 - saved));
    return {
      name: type === "aggressive" ? "Aggressive" : type === "safe" ? "Safe" : "Normal",
      description: type === "aggressive" ? "Max cuts for fastest debt clearance" : type === "safe" ? "Minimal cuts with emergency fund" : "Balanced approach",
      lifestyleExpenseReduction: cuts, extraEMIAmount: Math.max(0, extra),
      debtFreeDate: debtFreeDate.toLocaleDateString("en-IN", { year: "numeric", month: "short" }),
      interestSaved: Math.max(0, extra * saved * 0.15),
      minimumFreeCash: freeCash - extra,
      icon: type === "aggressive" ? Zap : type === "safe" ? Shield : Target,
      color: type === "aggressive" ? "text-destructive" : type === "safe" ? "text-success" : "text-primary",
    };
  };

  const strategies = { normal: calculateStrategy("normal"), aggressive: calculateStrategy("aggressive"), safe: calculateStrategy("safe") };

  const getAISuggestions = () => {
    const suggestions = [];
    if (debtBurden > 50) suggestions.push({ type: "critical", message: `Critical debt burden ${debtBurden.toFixed(1)}%! Use Aggressive strategy.` });
    else if (debtBurden > 40) suggestions.push({ type: "warning", message: `High debt ${debtBurden.toFixed(1)}%. Cut ${strategies.normal.lifestyleExpenseReduction}% lifestyle, add ${formatINR(strategies.normal.extraEMIAmount)} EMI.` });
    if (freeCash < 0) suggestions.push({ type: "critical", message: `Negative ${formatINR(freeCash)}! Cut expenses immediately.` });
    else if (freeCash > totalEMI * 0.3) suggestions.push({ type: "success", message: `Great! ${formatINR(freeCash)} free. Pay ${formatINR(freeCash * 0.5)} extra EMI.` });
    if (suggestions.length === 0) suggestions.push({ type: "success", message: "Excellent health! Keep it up." });
    return suggestions;
  };

  const futureForecasts = futureMonths.map((m) => {
    const date = new Date(m.monthYear + "-01");
    const futureEMI = loans.reduce((sum, l) => {
      const elapsed = Math.floor((date.getTime() - new Date(l.disbursed_on).getTime()) / (1000 * 60 * 60 * 24 * 30));
      return (elapsed >= 0 && elapsed < l.tenure_months) ? sum + (l.emi_amount || 0) : sum;
    }, 0);
    return {
      month: date.toLocaleDateString("en-IN", { year: "numeric", month: "short" }),
      income: m.income, emis: futureEMI, otherExpenses: m.otherExpenses, plannedSavings: m.plannedSavings,
      freeCash: m.income - m.otherExpenses - futureEMI - m.plannedSavings,
      debtBurden: m.income > 0 ? (futureEMI / m.income) * 100 : 0,
      onIncomeChange: (v: number) => setFutureMonths((p) => p.map((x) => x.monthYear === m.monthYear ? { ...x, income: v } : x)),
      onExpensesChange: (v: number) => setFutureMonths((p) => p.map((x) => x.monthYear === m.monthYear ? { ...x, otherExpenses: v } : x)),
      onSavingsChange: (v: number) => setFutureMonths((p) => p.map((x) => x.monthYear === m.monthYear ? { ...x, plannedSavings: v } : x)),
    };
  });

  if (loading) return <div className="space-y-6"><Skeleton className="h-12 w-64" /><div className="grid gap-6 md:grid-cols-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-48" />)}</div></div>;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-3xl sm:text-4xl font-bold">Budget Planner</h1><p className="text-muted-foreground mt-2">Deep budgeting with future planning and strategies</p></div>
        <Button onClick={saveBudget} disabled={saving} size="lg" className="w-full sm:w-auto"><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save"}</Button>
      </div>
      <FadeInStagger>
        <BudgetSummaryCards totalIncome={totalIncome} totalExpenses={totalExpenses} totalEMI={totalEMI} savings={budget.savingsInvestments} freeCash={freeCash} debtBurden={debtBurden} />
        <MonthlyBudgetForm
          income={{ salary: { label: "Salary", value: budget.salary, onChange: (v) => setBudget({ ...budget, salary: v }) }, sideIncome: { label: "Side Income", value: budget.sideIncome, onChange: (v) => setBudget({ ...budget, sideIncome: v }) }, otherIncome: { label: "Other", value: budget.otherIncome, onChange: (v) => setBudget({ ...budget, otherIncome: v }) } }}
          fixedExpenses={{ rent: { label: "Rent", value: budget.rent, onChange: (v) => setBudget({ ...budget, rent: v }) }, food: { label: "Food", value: budget.food, limit: budget.foodLimit, onChange: (v) => setBudget({ ...budget, food: v }), onLimitChange: (v) => setBudget({ ...budget, foodLimit: v }) }, transport: { label: "Transport", value: budget.transport, onChange: (v) => setBudget({ ...budget, transport: v }) }, utilities: { label: "Utilities", value: budget.utilities, onChange: (v) => setBudget({ ...budget, utilities: v }) }, school: { label: "School", value: budget.school, onChange: (v) => setBudget({ ...budget, school: v }) }, subscriptions: { label: "Subscriptions", value: budget.subscriptions, onChange: (v) => setBudget({ ...budget, subscriptions: v }) }, insurance: { label: "Insurance", value: budget.insurance, onChange: (v) => setBudget({ ...budget, insurance: v }) } }}
          variableExpenses={{ eatingOut: { label: "Eating Out", value: budget.eatingOut, limit: budget.eatingOutLimit, onChange: (v) => setBudget({ ...budget, eatingOut: v }), onLimitChange: (v) => setBudget({ ...budget, eatingOutLimit: v }) }, shopping: { label: "Shopping", value: budget.shopping, limit: budget.shoppingLimit, onChange: (v) => setBudget({ ...budget, shopping: v }), onLimitChange: (v) => setBudget({ ...budget, shoppingLimit: v }) }, travel: { label: "Travel", value: budget.travel, limit: budget.travelLimit, onChange: (v) => setBudget({ ...budget, travel: v }), onLimitChange: (v) => setBudget({ ...budget, travelLimit: v }) }, other: { label: "Other", value: budget.otherVariable, onChange: (v) => setBudget({ ...budget, otherVariable: v }) } }}
          savingsInvestments={{ label: "Savings", value: budget.savingsInvestments, onChange: (v) => setBudget({ ...budget, savingsInvestments: v }) }}
          totalEMI={totalEMI}
        />
        <Card><CardHeader><CardTitle className="flex gap-2"><Sparkles className="h-5 w-5" />AI Recommendations</CardTitle><CardDescription>Based on detailed budget</CardDescription></CardHeader><CardContent className="space-y-3">{getAISuggestions().map((s, i) => <Alert key={i} variant={s.type === "critical" ? "destructive" : "default"} className={s.type === "success" ? "border-success bg-success/10" : s.type === "warning" ? "border-warning bg-warning/10" : ""}>{s.type === "critical" ? <ArrowDownCircle className="h-4 w-4" /> : s.type === "success" ? <ArrowUpCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}<AlertDescription>{s.message}</AlertDescription></Alert>)}</CardContent></Card>
        <FutureMonthsPlanner forecasts={futureForecasts} />
        <LoanStrategies strategies={strategies} onSelectStrategy={(s) => { setBudget({ ...budget, strategy: s, extraEMI: strategies[s].extraEMIAmount }); toast.success(`${strategies[s].name} selected`); }} />
        <BudgetReports monthlyReport={[{ category: "Income", budgeted: totalIncome, actual: totalIncome, difference: 0 }, { category: "Expenses", budgeted: totalExpenses, actual: totalExpenses * 0.9, difference: totalExpenses * 0.1 }]} cashFlowForecast={futureForecasts.slice(0, 6).map((f) => ({ month: f.month, income: f.income, expenses: f.otherExpenses, emis: f.emis, netCashFlow: f.freeCash }))} debtReport={loans.map((l) => ({ loanName: l.loan_name, plannedExtraEMI: budget.extraEMI, actualExtraEMI: budget.extraEMI * 0.8, interestSaved: budget.extraEMI * 12 * 0.15 }))} />
      </FadeInStagger>
    </div>
  );
}
