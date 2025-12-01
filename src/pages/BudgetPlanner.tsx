import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { Calendar, Save, TrendingUp, TrendingDown, DollarSign, Target, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";
import IncomeStep from "@/components/budget/wizard/IncomeStep";
import FixedExpensesStep from "@/components/budget/wizard/FixedExpensesStep";
import VariableExpensesStep from "@/components/budget/wizard/VariableExpensesStep";
import SavingsGoalsStep from "@/components/budget/wizard/SavingsGoalsStep";
import SummaryStep from "@/components/budget/wizard/SummaryStep";
import FutureMonthsPlanner from "@/components/budget/FutureMonthsPlanner";
import { calculateSnowball, calculateAvalanche } from "@/lib/debt-optimizer";

interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  start_month: string;
}

interface SalarySettings {
  base_salary: number;
  increment_month: number;
  increment_type: string;
  increment_value: number;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string;
  current_amount: number;
  monthly_contribution: number;
}

interface BudgetData {
  salary: number;
  rent: number;
  food: number;
  transport: number;
  utilities: number;
  school: number;
  subscriptions: number;
  insurance: number;
  eating_out: number;
  eating_out_limit: number;
  shopping: number;
  shopping_limit: number;
  travel: number;
  travel_limit: number;
  other_variable: number;
  savings_investments: number;
}

export default function BudgetPlanner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [budget, setBudget] = useState<BudgetData>({
    salary: 0,
    rent: 0,
    food: 0,
    transport: 0,
    utilities: 0,
    school: 0,
    subscriptions: 0,
    insurance: 0,
    eating_out: 0,
    eating_out_limit: 0,
    shopping: 0,
    shopping_limit: 0,
    travel: 0,
    travel_limit: 0,
    other_variable: 0,
    savings_investments: 0,
  });

  const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);
  const [otherIncome, setOtherIncome] = useState<IncomeSource[]>([]);
  const [customExpenses, setCustomExpenses] = useState<FixedExpense[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    fetchData();
  }, [user, selectedMonth]);

  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch loans
      const { data: loansData } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");
      setLoans(loansData || []);

      // Fetch budget data
      const { data: budgetData } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", selectedMonth)
        .maybeSingle();

      if (budgetData) {
        setBudget({
          salary: budgetData.salary || 0,
          rent: budgetData.rent || 0,
          food: budgetData.food || 0,
          transport: budgetData.transport || 0,
          utilities: budgetData.utilities || 0,
          school: budgetData.school || 0,
          subscriptions: budgetData.subscriptions || 0,
          insurance: budgetData.insurance || 0,
          eating_out: budgetData.eating_out || 0,
          eating_out_limit: budgetData.eating_out_limit || 0,
          shopping: budgetData.shopping || 0,
          shopping_limit: budgetData.shopping_limit || 0,
          travel: budgetData.travel || 0,
          travel_limit: budgetData.travel_limit || 0,
          other_variable: budgetData.other_variable || 0,
          savings_investments: budgetData.savings_investments || 0,
        });
      }

      // Fetch salary settings
      const { data: salaryData } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (salaryData) {
        setSalarySettings(salaryData);
      }

      // Fetch income sources
      const { data: incomeData } = await supabase
        .from("income_sources")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      setOtherIncome(incomeData || []);

      // Fetch savings goals
      const { data: goalsData } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      setSavingsGoals(goalsData || []);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const saveBudget = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save budget
      await supabase.from("monthly_budgets").upsert({
        user_id: user.id,
        month_year: selectedMonth,
        ...budget,
      });

      // Save salary settings
      if (salarySettings) {
        await supabase.from("salary_settings").upsert({
          user_id: user.id,
          ...salarySettings,
        });
      }

      // Save income sources
      for (const income of otherIncome) {
        if (income.name && income.amount > 0) {
          await supabase.from("income_sources").upsert({
            ...income,
            user_id: user.id,
          });
        }
      }

      // Save savings goals
      for (const goal of savingsGoals) {
        if (goal.name && goal.target_amount > 0) {
          await supabase.from("savings_goals").upsert({
            ...goal,
            user_id: user.id,
          });
        }
      }

      toast.success("Budget saved successfully");
    } catch (error) {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals
  const totalIncome = budget.salary + otherIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalFixedExpenses =
    budget.rent +
    budget.food +
    budget.transport +
    budget.utilities +
    budget.school +
    budget.subscriptions +
    budget.insurance +
    customExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalVariableExpenses =
    budget.eating_out + budget.shopping + budget.travel + budget.other_variable;
  const totalEMI = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
  const totalSavings =
    budget.savings_investments +
    savingsGoals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);
  const freeCash =
    totalIncome - totalFixedExpenses - totalVariableExpenses - totalEMI - totalSavings;
  const debtBurden = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;

  // Generate 12-month forecast
  const generateForecasts = () => {
    const forecasts = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      // Calculate salary with increment
      let forecastSalary = budget.salary;
      if (salarySettings && date.getMonth() + 1 === salarySettings.increment_month) {
        if (salarySettings.increment_type === "percentage") {
          forecastSalary = budget.salary * (1 + salarySettings.increment_value / 100);
        } else {
          forecastSalary = budget.salary + salarySettings.increment_value;
        }
      }

      const forecastIncome = forecastSalary + otherIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
      const forecastEMI = totalEMI; // Simplified - would need amortization table for accuracy
      const forecastExpenses = totalFixedExpenses + totalVariableExpenses;

      forecasts.push({
        month: date.toLocaleDateString("en-IN", { year: "numeric", month: "short" }),
        income: forecastIncome,
        emis: forecastEMI,
        otherExpenses: forecastExpenses,
        plannedSavings: totalSavings,
        freeCash: forecastIncome - forecastExpenses - forecastEMI - totalSavings,
        debtBurden: forecastIncome > 0 ? (forecastEMI / forecastIncome) * 100 : 0,
        onIncomeChange: (v: number) => {},
        onExpensesChange: (v: number) => {},
        onSavingsChange: (v: number) => {},
      });
    }
    return forecasts;
  };

  const steps = [
    { title: "Income", component: IncomeStep },
    { title: "Fixed Expenses", component: FixedExpensesStep },
    { title: "Variable Expenses", component: VariableExpensesStep },
    { title: "Savings & Goals", component: SavingsGoalsStep },
    { title: "Summary", component: SummaryStep },
  ];

  const CurrentStepComponent = steps[currentStep].component;

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Budget Planner</h1>
          <p className="text-muted-foreground mt-2">Monthly wizard-based budget planning</p>
        </div>
        <div className="flex gap-3 items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() + i);
                const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                return (
                  <SelectItem key={value} value={value}>
                    {date.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={saveBudget} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Budget"}
          </Button>
        </div>
      </div>

      <FadeInStagger>
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatINR(totalIncome)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalFixedExpenses + totalVariableExpenses)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total EMI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatINR(totalEMI)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Free Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${freeCash >= 0 ? "text-success" : "text-destructive"}`}>
                {formatINR(freeCash)}
                {freeCash >= 0 ? (
                  <TrendingUp className="inline h-5 w-5 ml-1" />
                ) : (
                  <TrendingDown className="inline h-5 w-5 ml-1" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Debt Burden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${debtBurden < 40 ? "text-success" : "text-destructive"}`}>
                {formatPercent(debtBurden)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wizard Steps */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Budget Setup Wizard</CardTitle>
              <div className="flex gap-2">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`h-2 w-16 rounded-full transition-all ${
                      index === currentStep
                        ? "bg-primary"
                        : index < currentStep
                        ? "bg-success"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </p>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && (
              <IncomeStep
                salary={budget.salary}
                salarySettings={salarySettings}
                otherIncome={otherIncome}
                onSalaryChange={(v) => setBudget({ ...budget, salary: v })}
                onSalarySettingsChange={setSalarySettings}
                onOtherIncomeChange={setOtherIncome}
              />
            )}
            {currentStep === 1 && (
              <FixedExpensesStep
                rent={budget.rent}
                food={budget.food}
                transport={budget.transport}
                utilities={budget.utilities}
                insurance={budget.insurance}
                subscriptions={budget.subscriptions}
                school={budget.school}
                customExpenses={customExpenses}
                onFieldChange={(field, value) => setBudget({ ...budget, [field]: value })}
                onCustomExpensesChange={setCustomExpenses}
              />
            )}
            {currentStep === 2 && (
              <VariableExpensesStep
                eating_out={budget.eating_out}
                eating_out_limit={budget.eating_out_limit}
                shopping={budget.shopping}
                shopping_limit={budget.shopping_limit}
                travel={budget.travel}
                travel_limit={budget.travel_limit}
                other_variable={budget.other_variable}
                onFieldChange={(field, value) => setBudget({ ...budget, [field]: value })}
              />
            )}
            {currentStep === 3 && (
              <SavingsGoalsStep
                savings_investments={budget.savings_investments}
                goals={savingsGoals}
                onSavingsChange={(v) => setBudget({ ...budget, savings_investments: v })}
                onGoalsChange={setSavingsGoals}
              />
            )}
            {currentStep === 4 && (
              <SummaryStep
                totalIncome={totalIncome}
                totalFixedExpenses={totalFixedExpenses}
                totalVariableExpenses={totalVariableExpenses}
                totalEMI={totalEMI}
                totalSavings={totalSavings}
                freeCash={freeCash}
                debtBurden={debtBurden}
              />
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                onClick={() => {
                  if (currentStep < steps.length - 1) {
                    setCurrentStep(currentStep + 1);
                  } else {
                    saveBudget();
                  }
                }}
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Budget
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 12-Month Forecast */}
        <FutureMonthsPlanner forecasts={generateForecasts()} />

        {/* Debt Payoff Calculator Embedded */}
        {loans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Debt Payoff Calculator</CardTitle>
              <p className="text-sm text-muted-foreground">Compare strategies to pay off your loans faster</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the dedicated Debt Payoff Calculator page for detailed analysis and comparison.
              </p>
            </CardContent>
          </Card>
        )}
      </FadeInStagger>
    </div>
  );
}
