import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FolderTree, History, Plus, ChevronRight, TrendingUp, Calendar, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { format, subMonths } from "date-fns";
import FadeInStagger from "@/components/FadeInStagger";

interface BudgetSummary {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  status: "on-track" | "overspent" | "underspent";
}

export default function BudgetPlannerHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("budgets");
  const [loading, setLoading] = useState(true);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentMonth = format(new Date(), 'yyyy-MM');

      // Fetch current budget
      const { data: budget } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .maybeSingle();

      if (budget) {
        const income = (budget.salary || 0) + (budget.side_income || 0) + (budget.other_income || 0);
        const expenses = (budget.rent || 0) + (budget.utilities || 0) + (budget.insurance || 0) +
                        (budget.subscriptions || 0) + (budget.school || 0) + (budget.transport || 0) +
                        (budget.food || 0) + (budget.eating_out || 0) + (budget.shopping || 0) +
                        (budget.travel || 0) + (budget.other_variable || 0);
        const savings = budget.savings_investments || 0;
        
        let status: "on-track" | "overspent" | "underspent" = "on-track";
        if (income - expenses - savings < 0) status = "overspent";
        else if (income - expenses - savings > income * 0.2) status = "underspent";

        setBudgetSummary({ month: currentMonth, income, expenses, savings, status });
      }

      // Count categories
      const { count: groupCount } = await supabase
        .from('expense_groups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setCategoriesCount(groupCount || 0);

      // Count history months
      const { count: budgetCount } = await supabase
        .from('monthly_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setHistoryCount(budgetCount || 0);

    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Planner
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage budgets, categories, and view history
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/budget-planner')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </Button>
      </div>

      {/* Quick Summary */}
      {budgetSummary && (
        <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">This Month's Budget</span>
              <Badge variant={budgetSummary.status === "on-track" ? "default" : budgetSummary.status === "overspent" ? "destructive" : "secondary"}>
                {budgetSummary.status === "on-track" ? "On Track" : budgetSummary.status === "overspent" ? "Overspent" : "Under Budget"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-bold text-green-600">{formatINR(budgetSummary.income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-bold">{formatINR(budgetSummary.expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings</p>
                <p className="text-lg font-bold text-primary">{formatINR(budgetSummary.savings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="budgets" className="text-xs md:text-sm">
            <ClipboardList className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Budgets
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs md:text-sm">
            <FolderTree className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs md:text-sm">
            <History className="h-4 w-4 mr-1.5 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-3 mt-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget-planner')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Monthly Budget Planner</h3>
                  <p className="text-xs text-muted-foreground">Set income, expenses, and savings goals</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/forecast')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Forecast & Projections</h3>
                  <p className="text-xs text-muted-foreground">12-month financial outlook</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground px-1">
            💡 Tip: Auto-suggest budget based on last 3 months avg spending available in Budget Planner.
          </p>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3 mt-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/category-manager')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                  <FolderTree className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Category Manager</h3>
                  <p className="text-xs text-muted-foreground">
                    {categoriesCount > 0 ? `${categoriesCount} groups configured` : 'Organize expense categories'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-medium text-sm mb-2">Category Tags</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Tag categories as Needs, Wants, or EMI & Debt to see spending breakdown.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Needs</Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Wants</Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">EMI & Debt</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget-history')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <History className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Budget History</h3>
                  <p className="text-xs text-muted-foreground">
                    {historyCount > 0 ? `${historyCount} months recorded` : 'View past monthly budgets'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-medium text-sm mb-2">Insights</h4>
              <p className="text-xs text-muted-foreground">
                Compare Budget vs Actual spending across months. See which categories you frequently overspend.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FadeInStagger>
  );
}
