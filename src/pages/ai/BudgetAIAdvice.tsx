import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle,
  Lightbulb,
  Loader2,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";
import FadeInStagger from "@/components/FadeInStagger";

interface BudgetAdvice {
  category: string;
  severity: "info" | "warning" | "error" | "success";
  title: string;
  description: string;
  action?: string;
  savings?: number;
}

export default function BudgetAIAdvice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<BudgetAdvice[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch profile for income
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user.id)
        .single();

      setMonthlyIncome(profile?.monthly_income || 0);

      // Fetch recent budgets
      const { data: budgetsData } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .order("month_year", { ascending: false })
        .limit(6);

      setBudgets(budgetsData || []);

      // Fetch recent expenses
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      const { data: expensesData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .gt("debit", 0);

      setExpenses(expensesData || []);

      // Generate advice
      generateAdvice(budgetsData || [], expensesData || [], profile?.monthly_income || 0);
    } catch (error) {
      toast.error("Failed to fetch budget data");
    } finally {
      setLoading(false);
    }
  };

  const generateAdvice = (budgetsData: any[], expensesData: any[], income: number) => {
    const adviceList: BudgetAdvice[] = [];

    if (budgetsData.length === 0) {
      adviceList.push({
        category: "Getting Started",
        severity: "info",
        title: "Create your first budget",
        description: "Start tracking your income and expenses by creating a monthly budget plan.",
        action: "Go to Budget Planner",
      });
      setAdvice(adviceList);
      return;
    }

    const latestBudget = budgetsData[0];
    
    // Calculate totals
    const totalIncome = (latestBudget.salary || 0) + (latestBudget.side_income || 0) + (latestBudget.other_income || 0);
    const totalExpenses = 
      (latestBudget.rent || 0) +
      (latestBudget.food || 0) +
      (latestBudget.transport || 0) +
      (latestBudget.utilities || 0) +
      (latestBudget.school || 0) +
      (latestBudget.subscriptions || 0) +
      (latestBudget.insurance || 0) +
      (latestBudget.eating_out || 0) +
      (latestBudget.shopping || 0) +
      (latestBudget.travel || 0) +
      (latestBudget.other_variable || 0);

    const savingsInvest = latestBudget.savings_investments || 0;
    const extraEMI = latestBudget.extra_emi_amount || 0;
    const surplus = totalIncome - totalExpenses - savingsInvest - extraEMI;

    // Check if over budget
    if (surplus < 0) {
      adviceList.push({
        category: "Budget Alert",
        severity: "error",
        title: "Budget deficit detected",
        description: `Your expenses exceed your income by ${formatINR(Math.abs(surplus))}. You need to reduce spending or increase income.`,
        action: "Review Budget Categories",
      });
    }

    // Check savings rate
    const savingsRate = totalIncome > 0 ? ((savingsInvest + extraEMI) / totalIncome) * 100 : 0;
    if (savingsRate < 20 && totalIncome > 0) {
      adviceList.push({
        category: "Savings",
        severity: "warning",
        title: "Low savings rate",
        description: `You're saving only ${savingsRate.toFixed(1)}% of your income. Financial experts recommend saving at least 20%.`,
        action: "Increase Savings Goal",
        savings: totalIncome * 0.2 - (savingsInvest + extraEMI),
      });
    } else if (savingsRate >= 20) {
      adviceList.push({
        category: "Savings",
        severity: "success",
        title: "Great savings rate!",
        description: `You're saving ${savingsRate.toFixed(1)}% of your income, which is above the recommended 20%. Keep it up!`,
      });
    }

    // Check eating out vs food budget
    if (latestBudget.eating_out > latestBudget.food * 0.5) {
      const potentialSavings = latestBudget.eating_out - latestBudget.food * 0.3;
      adviceList.push({
        category: "Eating Out",
        severity: "warning",
        title: "High eating out expenses",
        description: `You're spending more on eating out than home cooking. Consider cooking more at home to save money.`,
        action: "Reduce Eating Out",
        savings: potentialSavings,
      });
    }

    // Check variable expenses
    const variableExpenses = (latestBudget.eating_out || 0) + (latestBudget.shopping || 0) + (latestBudget.travel || 0);
    const variablePercentage = totalIncome > 0 ? (variableExpenses / totalIncome) * 100 : 0;
    if (variablePercentage > 30) {
      adviceList.push({
        category: "Variable Expenses",
        severity: "warning",
        title: "High variable spending",
        description: `Variable expenses (eating out, shopping, travel) consume ${variablePercentage.toFixed(1)}% of your income. Consider setting stricter limits.`,
        action: "Set Spending Limits",
      });
    }

    // Check if budgets are being tracked
    const monthsWithBudgets = budgetsData.length;
    if (monthsWithBudgets >= 3) {
      adviceList.push({
        category: "Tracking",
        severity: "success",
        title: "Consistent budget tracking",
        description: `You've been tracking your budget for ${monthsWithBudgets} months. This consistency helps identify spending patterns.`,
      });
    }

    // Suggest budget reallocation based on surplus
    if (surplus > income * 0.1) {
      adviceList.push({
        category: "Optimization",
        severity: "info",
        title: "Surplus available for optimization",
        description: `You have ${formatINR(surplus)} surplus each month. Consider allocating this to debt repayment or investments.`,
        action: "Allocate Surplus",
      });
    }

    // Check subscription spending
    if (latestBudget.subscriptions > income * 0.05) {
      adviceList.push({
        category: "Subscriptions",
        severity: "warning",
        title: "Review subscription expenses",
        description: `Subscriptions are consuming ${((latestBudget.subscriptions / income) * 100).toFixed(1)}% of your income. Review and cancel unused services.`,
        savings: latestBudget.subscriptions * 0.3,
      });
    }

    setAdvice(adviceList);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      default:
        return <Lightbulb className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Action Required</Badge>;
      case "warning":
        return <Badge variant="secondary">Needs Attention</Badge>;
      case "success":
        return <Badge variant="default">Well Done</Badge>;
      default:
        return <Badge variant="outline">Suggestion</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            Budget AI Advice
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered insights to optimize your budget and save money
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <Sparkles className="h-4 w-4 mr-2" />
          Refresh Advice
        </Button>
      </div>

      <FadeInStagger>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatINR(monthlyIncome)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Budgets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{budgets.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Tracked months</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Insights Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{advice.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Recommendations</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {advice.map((item, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(item.severity)}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        {getSeverityBadge(item.severity)}
                      </div>
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{item.description}</p>
                {item.savings && (
                  <div className="flex items-center gap-2 text-success">
                    <TrendingDown className="h-4 w-4" />
                    <span className="font-semibold">
                      Potential savings: {formatINR(item.savings)}/month
                    </span>
                  </div>
                )}
                {item.action && (
                  <Button variant="outline" size="sm">
                    {item.action}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {advice.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No budget data available to generate advice.</p>
              <p className="text-sm mt-2">Create a budget to get personalized recommendations.</p>
            </CardContent>
          </Card>
        )}
      </FadeInStagger>
    </div>
  );
}
