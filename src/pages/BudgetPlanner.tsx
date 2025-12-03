import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  Calendar, 
  Save, 
  ArrowLeft, 
  ArrowRight, 
  ChevronDown,
  Copy,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";
import IncomeStep from "@/components/budget/wizard/IncomeStep";
import FixedExpensesStep from "@/components/budget/wizard/FixedExpensesStep";
import VariableExpensesStep from "@/components/budget/wizard/VariableExpensesStep";
import SavingsGoalsStep from "@/components/budget/wizard/SavingsGoalsStep";
import SummaryStep from "@/components/budget/wizard/SummaryStep";
import BudgetClickableSummaryCards from "@/components/budget/BudgetClickableSummaryCards";
import BudgetHealthWidgets from "@/components/budget/BudgetHealthWidgets";
import EnhancedForecastTable from "@/components/budget/EnhancedForecastTable";
import BudgetInsightsPanel from "@/components/budget/BudgetInsightsPanel";
import DebtPayoffSummary from "@/components/budget/DebtPayoffSummary";
import WizardStepIndicator from "@/components/budget/WizardStepIndicator";
import { format, addMonths } from "date-fns";

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

  // Refs for scrolling
  const incomeRef = useRef<HTMLDivElement>(null);
  const expensesRef = useRef<HTMLDivElement>(null);
  const forecastRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

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
  const [wizardOpen, setWizardOpen] = useState(true);

  // Scroll to section handler
  const scrollToSection = (section: string) => {
    const refs: Record<string, React.RefObject<HTMLDivElement>> = {
      income: incomeRef,
      expenses: expensesRef,
      forecast: forecastRef,
      insights: insightsRef,
    };

    if (section === "income") {
      setWizardOpen(true);
      setCurrentStep(0);
      setTimeout(() => {
        wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else if (section === "expenses") {
      setWizardOpen(true);
      setCurrentStep(1);
      setTimeout(() => {
        wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else {
      refs[section]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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

  const duplicateToNextMonth = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const nextDate = new Date(year, month);
      const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

      await supabase.from("monthly_budgets").upsert({
        user_id: user.id,
        month_year: nextMonth,
        ...budget,
      });

      toast.success(`Budget duplicated to ${format(nextDate, "MMMM yyyy")}`);
    } catch (error) {
      toast.error("Failed to duplicate budget");
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

  // Generate 12-month forecast with enhanced data
  const generateForecasts = () => {
    const forecasts = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      // Calculate salary with increment
      let forecastSalary = budget.salary;
      if (salarySettings && date.getMonth() + 1 === salarySettings.increment_month) {
        if (salarySettings.increment_type === "percentage") {
          forecastSalary = budget.salary * (1 + salarySettings.increment_value / 100);
        } else {
          forecastSalary = budget.salary + salarySettings.increment_value;
        }
      }

      const forecastIncome = forecastSalary + otherIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0);
      const forecastEMI = totalEMI;

      forecasts.push({
        month: format(date, "MMM yyyy"),
        monthKey,
        income: forecastIncome,
        emis: forecastEMI,
        fixedExpenses: totalFixedExpenses,
        lifestyleBudget: totalVariableExpenses,
        plannedSavings: totalSavings,
        freeCash: forecastIncome - totalFixedExpenses - totalVariableExpenses - forecastEMI - totalSavings,
        debtBurden: forecastIncome > 0 ? (forecastEMI / forecastIncome) * 100 : 0,
      });
    }
    return forecasts;
  };

  const forecasts = generateForecasts();

  const steps = [
    { title: "Income", description: "Salary & other sources" },
    { title: "Fixed Expenses", description: "Monthly bills" },
    { title: "Lifestyle", description: "Variable spending" },
    { title: "Savings & Goals", description: "Future planning" },
    { title: "Review", description: "Summary & confirm" },
  ];

  const handleMonthClick = (monthKey: string) => {
    setSelectedMonth(monthKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Get month label for display
  const getMonthLabel = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return format(new Date(year, month - 1), "MMMM yyyy");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Budget Planner</h1>
          <p className="text-muted-foreground mt-1">
            This month: <span className="font-medium text-foreground">{getMonthLabel()}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
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
                    {format(date, "MMMM yyyy")}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={saveBudget} disabled={saving} size="default">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Budget
          </Button>
        </div>
      </div>

      <FadeInStagger>
        {/* Clickable Summary Cards */}
        <BudgetClickableSummaryCards
          totalIncome={totalIncome}
          totalExpenses={totalFixedExpenses + totalVariableExpenses}
          totalEMI={totalEMI}
          freeCash={freeCash}
          debtBurden={debtBurden}
          monthLabel={getMonthLabel()}
          onScrollToSection={scrollToSection}
        />

        {/* Budget Health Widgets */}
        <BudgetHealthWidgets
          totalIncome={totalIncome}
          totalEMI={totalEMI}
          totalFixedExpenses={totalFixedExpenses}
          totalVariableExpenses={totalVariableExpenses}
          totalSavings={totalSavings}
          freeCash={freeCash}
        />

        {/* Budget Setup Wizard - Collapsible */}
        <div ref={wizardRef}>
          <Collapsible open={wizardOpen} onOpenChange={setWizardOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Budget Setup Wizard
                      <ChevronDown className={`h-5 w-5 transition-transform ${wizardOpen ? "rotate-180" : ""}`} />
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Step {currentStep + 1} of {steps.length}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {/* Step Indicator */}
                  <div className="mb-6">
                    <WizardStepIndicator
                      steps={steps}
                      currentStep={currentStep}
                      onStepClick={setCurrentStep}
                    />
                  </div>

                  {/* Step Content */}
                  <div ref={incomeRef}>
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
                  </div>
                  <div ref={expensesRef}>
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
                  </div>
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

                  {/* Navigation */}
                  <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                    <div className="flex gap-2">
                      {currentStep === steps.length - 1 && (
                        <Button variant="outline" onClick={duplicateToNextMonth} disabled={saving}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate to Next Month
                        </Button>
                      )}
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
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* 12-Month Forecast */}
        <div ref={forecastRef}>
          <EnhancedForecastTable
            forecasts={forecasts}
            onLifestyleChange={(monthKey, value) => {
              // For now, just update current month if it matches
              if (monthKey === selectedMonth) {
                const newTotal = value;
                // Distribute proportionally (simplified)
                setBudget({ ...budget, eating_out: newTotal * 0.3, shopping: newTotal * 0.3, travel: newTotal * 0.3, other_variable: newTotal * 0.1 });
              }
            }}
            onSavingsChange={(monthKey, value) => {
              if (monthKey === selectedMonth) {
                setBudget({ ...budget, savings_investments: value });
              }
            }}
            onMonthClick={handleMonthClick}
          />
        </div>

        {/* Budget Insights */}
        <div ref={insightsRef}>
          <BudgetInsightsPanel
            totalIncome={totalIncome}
            totalEMI={totalEMI}
            totalFixedExpenses={totalFixedExpenses}
            totalVariableExpenses={totalVariableExpenses}
            totalSavings={totalSavings}
            freeCash={freeCash}
            debtBurden={debtBurden}
            forecasts={forecasts}
            savingsGoals={savingsGoals}
          />
        </div>

        {/* Debt Payoff Calculator Summary */}
        {loans.length > 0 && (
          <DebtPayoffSummary
            freeCash={freeCash}
            totalEMI={totalEMI}
            loansCount={loans.length}
          />
        )}
      </FadeInStagger>
    </div>
  );
}
