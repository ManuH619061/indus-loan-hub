import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  ArrowRight,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, formatPercent } from "@/lib/currency";
import FadeInStagger from "@/components/FadeInStagger";

interface ExpenseAdvice {
  category: string;
  severity: "info" | "warning" | "error" | "success";
  title: string;
  description: string;
  action?: string;
  impact?: number;
}

export default function ExpenseAIAdvice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<ExpenseAdvice[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [totalEMI, setTotalEMI] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user.id)
        .single();

      setMonthlyIncome(profile?.monthly_income || 0);

      // Fetch expenses (last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const { data: expensesData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", threeMonthsAgo.toISOString().split("T")[0])
        .gt("debit", 0)
        .order("transaction_date", { ascending: false });

      setExpenses(expensesData || []);

      // Fetch budgets
      const { data: budgetsData } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .order("month_year", { ascending: false })
        .limit(1);

      setBudgets(budgetsData || []);

      // Fetch active loans
      const { data: loansData } = await supabase
        .from("loans")
        .select("emi_amount")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      const emiSum = (loansData || []).reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
      setTotalEMI(emiSum);
      setLoans(loansData || []);

      // Generate advice
      generateAdvice(
        expensesData || [],
        budgetsData || [],
        profile?.monthly_income || 0,
        emiSum
      );
    } catch (error) {
      toast.error("Failed to fetch expense data");
    } finally {
      setLoading(false);
    }
  };

  const generateAdvice = (
    expensesData: any[],
    budgetsData: any[],
    income: number,
    emi: number
  ) => {
    const adviceList: ExpenseAdvice[] = [];

    if (expensesData.length === 0) {
      adviceList.push({
        category: "Getting Started",
        severity: "info",
        title: "Start tracking your expenses",
        description: "Begin recording your daily expenses to get personalized spending insights.",
        action: "Add Expense",
      });
      setAdvice(adviceList);
      return;
    }

    // Analyze spending by category
    const categorySpending: Record<string, number> = {};
    expensesData.forEach((exp) => {
      const cat = exp.category || "Other";
      categorySpending[cat] = (categorySpending[cat] || 0) + (exp.debit || 0);
    });

    // Total expenses
    const totalExpenses = Object.values(categorySpending).reduce((sum, val) => sum + val, 0);
    const avgMonthlyExpenses = totalExpenses / 3; // Last 3 months

    // Check if expenses are too high relative to income
    if (income > 0) {
      const expenseRatio = (avgMonthlyExpenses / income) * 100;
      if (expenseRatio > 70) {
        adviceList.push({
          category: "Spending Alert",
          severity: "error",
          title: "Expenses are too high",
          description: `Your monthly expenses (${formatINR(avgMonthlyExpenses)}) consume ${expenseRatio.toFixed(1)}% of your income. Aim to keep it below 70%.`,
          action: "Review Budget",
        });
      }

      // Check EMI + Expenses vs Income
      const totalCommitment = avgMonthlyExpenses + emi;
      const commitmentRatio = (totalCommitment / income) * 100;
      if (commitmentRatio > 80) {
        adviceList.push({
          category: "Financial Pressure",
          severity: "error",
          title: "High financial commitment",
          description: `Your EMIs (${formatINR(emi)}) + Expenses (${formatINR(avgMonthlyExpenses)}) take up ${commitmentRatio.toFixed(1)}% of your income. This leaves little room for savings.`,
          action: "Reduce Debt or Expenses",
        });
      }
    }

    // Find top spending categories
    const sortedCategories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories[0];
    if (topCategory) {
      const [catName, catAmount] = topCategory;
      const catPercentage = (catAmount / totalExpenses) * 100;
      if (catPercentage > 40) {
        adviceList.push({
          category: "Category Focus",
          severity: "warning",
          title: `${catName} spending is very high`,
          description: `${catName} accounts for ${catPercentage.toFixed(1)}% of your total expenses (${formatINR(catAmount)} over 3 months). Consider ways to reduce this.`,
          impact: catAmount * 0.2, // 20% potential reduction
        });
      }
    }

    // Compare with budget (if available)
    if (budgetsData.length > 0) {
      const budget = budgetsData[0];
      const budgetLimits: Record<string, number> = {
        Food: budget.food_limit || 0,
        "Eating Out": budget.eating_out_limit || 0,
        Shopping: budget.shopping_limit || 0,
        Travel: budget.travel_limit || 0,
      };

      Object.entries(budgetLimits).forEach(([cat, limit]) => {
        if (limit > 0 && categorySpending[cat]) {
          const monthlyAvg = categorySpending[cat] / 3;
          if (monthlyAvg > limit) {
            const overspend = monthlyAvg - limit;
            adviceList.push({
              category: "Budget Overspend",
              severity: "warning",
              title: `${cat} exceeds budget`,
              description: `You're spending ${formatINR(monthlyAvg)}/month on ${cat}, which is ${formatINR(overspend)} over your budget of ${formatINR(limit)}.`,
              action: "Set Spending Cap",
              impact: overspend,
            });
          }
        }
      });
    }

    // Detect high-frequency small transactions (potential waste)
    const smallTransactions = expensesData.filter((exp) => exp.debit < 500);
    if (smallTransactions.length > 50) {
      const smallTotal = smallTransactions.reduce((sum, exp) => sum + exp.debit, 0);
      adviceList.push({
        category: "Small Expenses",
        severity: "info",
        title: "Many small transactions detected",
        description: `You have ${smallTransactions.length} transactions under ₹500, totaling ${formatINR(smallTotal)}. These add up quickly and are often overlooked.`,
        action: "Track Small Spends",
        impact: smallTotal * 0.3,
      });
    }

    // Suggest savings target based on 50/30/20 rule
    if (income > 0) {
      const needs = avgMonthlyExpenses + emi;
      const needsPercentage = (needs / income) * 100;
      if (needsPercentage < 50) {
        adviceList.push({
          category: "Savings Opportunity",
          severity: "success",
          title: "Room for more savings",
          description: `Your essential expenses are only ${needsPercentage.toFixed(1)}% of income. You have room to increase savings or investments.`,
          action: "Increase Savings",
        });
      }
    }

    // Transportation spending check
    if (categorySpending["Transport"]) {
      const transportMonthly = categorySpending["Transport"] / 3;
      if (income > 0 && (transportMonthly / income) * 100 > 15) {
        adviceList.push({
          category: "Transport",
          severity: "warning",
          title: "High transport costs",
          description: `Transport expenses are ${formatINR(transportMonthly)}/month. Consider carpooling, public transport, or optimizing routes.`,
          impact: transportMonthly * 0.25,
        });
      }
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
        return <Target className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge variant="secondary">Warning</Badge>;
      case "success":
        return <Badge variant="default">Good</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
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
            Expense AI Advice
          </h1>
          <p className="text-muted-foreground mt-2">
            Smart insights to optimize your spending and increase savings
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <Sparkles className="h-4 w-4 mr-2" />
          Refresh Advice
        </Button>
      </div>

      <FadeInStagger>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(monthlyIncome)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total EMI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalEMI)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tracked Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expenses.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Last 3 months</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{advice.length}</div>
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
                {item.impact && (
                  <div className="flex items-center gap-2 text-success">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-semibold">
                      Potential savings: {formatINR(item.impact)}/month
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
              <p>No expense data available to generate advice.</p>
              <p className="text-sm mt-2">Track your expenses to get personalized recommendations.</p>
            </CardContent>
          </Card>
        )}
      </FadeInStagger>
    </div>
  );
}
