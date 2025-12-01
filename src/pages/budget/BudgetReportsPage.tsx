import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import BudgetVisualReports from "@/components/budget/BudgetVisualReports";

export default function BudgetReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user]);

  const fetchReportData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch current month budget
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const { data: budgetData } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .maybeSingle();

      // Fetch active loans
      const { data: loansData } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      // Fetch last 6 months expenses
      const { data: expensesData } = await supabase
        .from("monthly_expenses")
        .select("*, expense_groups(name, icon)")
        .eq("user_id", user.id)
        .gte("expense_date", new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString())
        .order("expense_date", { ascending: true });

      // Calculate totals
      const totalIncome = (budgetData?.salary || 0) + (budgetData?.side_income || 0) + (budgetData?.other_income || 0);
      const totalFixedExpenses =
        (budgetData?.rent || 0) +
        (budgetData?.food || 0) +
        (budgetData?.transport || 0) +
        (budgetData?.utilities || 0) +
        (budgetData?.school || 0) +
        (budgetData?.subscriptions || 0) +
        (budgetData?.insurance || 0);
      const totalVariableExpenses =
        (budgetData?.eating_out || 0) +
        (budgetData?.shopping || 0) +
        (budgetData?.travel || 0) +
        (budgetData?.other_variable || 0);
      const totalEMI = loansData?.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0) || 0;
      const totalSavings = budgetData?.savings_investments || 0;

      // Category breakdown from expenses
      const categoryMap = new Map<string, { name: string; value: number; icon?: string }>();
      expensesData?.forEach((expense: any) => {
        const groupName = expense.expense_groups?.name || "Other";
        const groupIcon = expense.expense_groups?.icon;
        if (categoryMap.has(groupName)) {
          categoryMap.get(groupName)!.value += expense.amount;
        } else {
          categoryMap.set(groupName, { name: groupName, value: expense.amount, icon: groupIcon });
        }
      });
      const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);

      // Monthly trends (last 6 months)
      const monthlyTrendsMap = new Map<string, any>();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        monthlyTrendsMap.set(monthKey, {
          month: monthLabel,
          income: 0,
          expenses: 0,
          emis: totalEMI,
          savings: 0,
        });
      }

      // Populate expense data
      expensesData?.forEach((expense: any) => {
        const monthKey = expense.expense_date.slice(0, 7);
        if (monthlyTrendsMap.has(monthKey)) {
          const trend = monthlyTrendsMap.get(monthKey);
          trend.expenses += expense.amount;
        }
      });

      // Add budget data for current month
      const currentMonthTrend = monthlyTrendsMap.get(currentMonth);
      if (currentMonthTrend) {
        currentMonthTrend.income = totalIncome;
        currentMonthTrend.savings = totalSavings;
      }

      const monthlyTrends = Array.from(monthlyTrendsMap.values());

      setReportData({
        totalIncome,
        totalFixedExpenses,
        totalVariableExpenses,
        totalEMI,
        totalSavings,
        categoryBreakdown,
        monthlyTrends,
      });
    } catch (error) {
      toast.error("Failed to load report data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Budget Reports</h1>
          <p className="text-muted-foreground">No budget data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Budget Reports</h1>
        <p className="text-muted-foreground">Visual analysis of your income, expenses, and savings</p>
      </div>

      <BudgetVisualReports {...reportData} />
    </div>
  );
}
