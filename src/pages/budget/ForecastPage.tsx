import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  AlertCircle, TrendingDown, CheckCircle, Calendar, RefreshCw, 
  TrendingUp, Wallet, ArrowLeft, BarChart3, PieChart, LineChart,
  Target, Lightbulb, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addMonths, startOfMonth, differenceInMonths } from "date-fns";
import { useNavigate } from "react-router-dom";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart as RechartsPie, Pie, Cell,
  ComposedChart, Line
} from "recharts";
import FadeInStagger from "@/components/FadeInStagger";

interface MonthForecast {
  month: string;
  monthKey: string;
  income: number;
  emis: number;
  fixedExpenses: number;
  lifestyleBudget: number;
  plannedSavings: number;
  freeCash: number;
  debtBurden: number;
  hasBudget: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--muted))'];

export default function ForecastPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<MonthForecast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchForecastData();
    }
  }, [user]);

  const fetchForecastData = async () => {
    if (!user) return;
    
    try {
      setRefreshing(true);
      
      const [
        { data: budgets },
        { data: loans },
        { data: salarySettings },
        { data: incomeSources },
        { data: goals },
        { data: recurringExpenses },
        { data: amortizationRows }
      ] = await Promise.all([
        supabase.from("monthly_budgets").select("*").eq("user_id", user.id),
        supabase.from("loans").select("*").eq("user_id", user.id).eq("status", "ACTIVE"),
        supabase.from("salary_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("income_sources").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("savings_goals").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("recurring_expenses").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("amortization_rows").select("*, loans!inner(user_id, status)").eq("loans.user_id", user.id).eq("loans.status", "ACTIVE")
      ]);

      setSavingsGoals(goals || []);

      const forecastData: MonthForecast[] = [];
      const today = startOfMonth(new Date());

      for (let i = 0; i < 12; i++) {
        const date = addMonths(today, i);
        const monthKey = format(date, "yyyy-MM");
        const monthLabel = format(date, "MMM yyyy");

        const monthBudget = budgets?.find(b => b.month_year === monthKey);
        const hasBudget = !!monthBudget;

        let income = 0;
        if (monthBudget?.salary) {
          income += monthBudget.salary;
        } else if (salarySettings?.base_salary) {
          let baseSalary = salarySettings.base_salary;
          if (salarySettings.increment_month && date.getMonth() + 1 >= salarySettings.increment_month) {
            if (salarySettings.increment_type === "percentage") {
              baseSalary = baseSalary * (1 + (salarySettings.increment_value || 0) / 100);
            } else {
              baseSalary = baseSalary + (salarySettings.increment_value || 0);
            }
          }
          income += baseSalary;
        }

        if (incomeSources) {
          for (const source of incomeSources) {
            const startDate = source.start_month ? new Date(source.start_month) : null;
            const endDate = source.end_month ? new Date(source.end_month) : null;
            if (startDate && date < startDate) continue;
            if (endDate && date > endDate) continue;
            if (source.frequency === "monthly") income += source.amount || 0;
            else if (source.frequency === "quarterly" && date.getMonth() % 3 === 0) income += source.amount || 0;
            else if (source.frequency === "yearly" && date.getMonth() === 0) income += source.amount || 0;
          }
        }

        let emis = 0;
        if (amortizationRows) {
          const monthEmis = amortizationRows.filter(row => {
            const dueDate = new Date(row.due_on);
            return format(dueDate, "yyyy-MM") === monthKey && !row.is_paid;
          });
          emis = monthEmis.reduce((sum, row) => sum + (row.scheduled_emi || 0), 0);
        }
        if (emis === 0 && loans) {
          emis = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
        }

        let fixedExpenses = 0;
        if (monthBudget) {
          fixedExpenses = (monthBudget.rent || 0) + (monthBudget.food || 0) + (monthBudget.transport || 0) + 
                         (monthBudget.utilities || 0) + (monthBudget.school || 0) + 
                         (monthBudget.subscriptions || 0) + (monthBudget.insurance || 0);
        }

        if (recurringExpenses) {
          for (const expense of recurringExpenses) {
            const startDate = expense.start_date ? new Date(expense.start_date) : null;
            const endDate = expense.end_date ? new Date(expense.end_date) : null;
            if (startDate && date < startDate) continue;
            if (endDate && date > endDate) continue;
            if (expense.frequency === "monthly") fixedExpenses += expense.amount || 0;
            else if (expense.frequency === "quarterly" && date.getMonth() % 3 === 0) fixedExpenses += expense.amount || 0;
            else if (expense.frequency === "yearly" && date.getMonth() === 0) fixedExpenses += expense.amount || 0;
          }
        }

        let lifestyleBudget = 0;
        if (monthBudget) {
          lifestyleBudget = (monthBudget.eating_out || 0) + (monthBudget.shopping || 0) + 
                           (monthBudget.travel || 0) + (monthBudget.other_variable || 0);
        }

        let plannedSavings = monthBudget?.savings_investments || 0;
        if (goals) {
          plannedSavings += goals.reduce((sum, goal) => sum + (goal.monthly_contribution || 0), 0);
        }

        const freeCash = income - emis - fixedExpenses - lifestyleBudget - plannedSavings;
        const debtBurden = income > 0 ? (emis / income) * 100 : 0;

        forecastData.push({
          month: monthLabel,
          monthKey,
          income,
          emis,
          fixedExpenses,
          lifestyleBudget,
          plannedSavings,
          freeCash,
          debtBurden,
          hasBudget
        });
      }

      setForecasts(forecastData);
    } catch (error) {
      console.error("Error fetching forecast data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Computed values
  const totals = useMemo(() => forecasts.reduce(
    (acc, f) => ({
      income: acc.income + f.income,
      emis: acc.emis + f.emis,
      fixedExpenses: acc.fixedExpenses + f.fixedExpenses,
      lifestyleBudget: acc.lifestyleBudget + f.lifestyleBudget,
      plannedSavings: acc.plannedSavings + f.plannedSavings,
      freeCash: acc.freeCash + f.freeCash,
    }),
    { income: 0, emis: 0, fixedExpenses: 0, lifestyleBudget: 0, plannedSavings: 0, freeCash: 0 }
  ), [forecasts]);

  const avgDebtBurden = totals.income > 0 ? (totals.emis / totals.income) * 100 : 0;
  const negativeMonths = forecasts.filter(f => f.freeCash < 0).length;
  const healthyMonths = forecasts.filter(f => f.freeCash > 0 && f.debtBurden < 40).length;
  const monthsWithBudget = forecasts.filter(f => f.hasBudget).length;

  // Chart data
  const cashFlowChartData = forecasts.map(f => ({
    month: f.month.substring(0, 3),
    income: f.income,
    expenses: f.emis + f.fixedExpenses + f.lifestyleBudget,
    savings: f.plannedSavings,
    freeCash: f.freeCash
  }));

  const expenseBreakdownData = [
    { name: "EMIs", value: totals.emis, color: "hsl(var(--primary))" },
    { name: "Fixed", value: totals.fixedExpenses, color: "hsl(var(--destructive))" },
    { name: "Lifestyle", value: totals.lifestyleBudget, color: "hsl(var(--warning))" },
    { name: "Savings", value: totals.plannedSavings, color: "hsl(var(--success))" },
  ].filter(d => d.value > 0);

  const debtTrendData = forecasts.map(f => ({
    month: f.month.substring(0, 3),
    debtBurden: f.debtBurden,
    threshold: 40
  }));

  // Goal progress calculations
  const goalProjections = savingsGoals.map(goal => {
    const remaining = (goal.target_amount || 0) - (goal.current_amount || 0);
    const monthlyContrib = goal.monthly_contribution || 0;
    const monthsNeeded = monthlyContrib > 0 ? Math.ceil(remaining / monthlyContrib) : Infinity;
    const achieveDate = addMonths(new Date(), monthsNeeded);
    const targetDate = goal.target_date ? new Date(goal.target_date) : null;
    const isOnTrack = targetDate ? achieveDate <= targetDate : monthsNeeded <= 12;
    
    return {
      ...goal,
      remaining,
      monthsNeeded,
      achieveDate,
      isOnTrack,
      progress: goal.target_amount > 0 ? ((goal.current_amount || 0) / goal.target_amount) * 100 : 0
    };
  });

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/budget-planner")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">12-Month Forecast</h1>
            <p className="text-muted-foreground mt-1">
              Detailed financial projections & analysis
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchForecastData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      <FadeInStagger>
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-4 w-4" />
                Budgets Set
              </div>
              <div className="text-2xl font-bold">{monthsWithBudget}/12</div>
              <p className="text-xs text-muted-foreground">months planned</p>
            </CardContent>
          </Card>
          <Card className="bg-success/10 border-success/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-success mb-1">
                <CheckCircle className="h-4 w-4" />
                Healthy Months
              </div>
              <div className="text-2xl font-bold text-success">{healthyMonths}</div>
              <p className="text-xs text-muted-foreground">positive cash flow</p>
            </CardContent>
          </Card>
          <Card className={negativeMonths > 0 ? "bg-destructive/10 border-destructive/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-destructive mb-1">
                <AlertCircle className="h-4 w-4" />
                Deficit Months
              </div>
              <div className="text-2xl font-bold text-destructive">{negativeMonths}</div>
              <p className="text-xs text-muted-foreground">need attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-1">
                <TrendingUp className="h-4 w-4" />
                Avg Debt Burden
              </div>
              <div className="text-2xl font-bold">{formatPercent(avgDebtBurden)}</div>
              <p className="text-xs text-muted-foreground">{avgDebtBurden > 40 ? "Above target" : "Healthy range"}</p>
            </CardContent>
          </Card>
        </div>

        {/* 12-Month Totals Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">12-Month Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total Income</p>
                <p className="text-lg font-bold text-success">{formatINR(totals.income)}</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total EMIs</p>
                <p className="text-lg font-bold text-primary">{formatINR(totals.emis)}</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Fixed Expenses</p>
                <p className="text-lg font-bold">{formatINR(totals.fixedExpenses)}</p>
              </div>
              <div className="text-center p-3 bg-warning/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Lifestyle</p>
                <p className="text-lg font-bold text-warning">{formatINR(totals.lifestyleBudget)}</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Savings</p>
                <p className="text-lg font-bold text-blue-600">{formatINR(totals.plannedSavings)}</p>
              </div>
              <div className={`text-center p-3 rounded-lg ${totals.freeCash >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                <p className="text-xs text-muted-foreground mb-1">Free Cash</p>
                <p className={`text-lg font-bold ${totals.freeCash >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatINR(totals.freeCash)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Section */}
        <Tabs defaultValue="cashflow" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cashflow" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Breakdown
            </TabsTrigger>
            <TabsTrigger value="debt" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Debt Trend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cashflow">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses Trend</CardTitle>
                <CardDescription>Monthly cash flow projection over 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cashFlowChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatINR(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="income" fill="hsl(var(--success)/0.2)" stroke="hsl(var(--success))" name="Income" />
                      <Area type="monotone" dataKey="expenses" fill="hsl(var(--destructive)/0.2)" stroke="hsl(var(--destructive))" name="Expenses" />
                      <Line type="monotone" dataKey="freeCash" stroke="hsl(var(--primary))" strokeWidth={2} name="Free Cash" dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown">
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
                <CardDescription>How your money is allocated over 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={expenseBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {expenseBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatINR(value)} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {expenseBreakdownData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatINR(item.value)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatINR(item.value / 12)}/mo avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debt">
            <Card>
              <CardHeader>
                <CardTitle>Debt Burden Trend</CardTitle>
                <CardDescription>Monthly debt-to-income ratio (target: below 40%)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={debtTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} domain={[0, 60]} />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar 
                        dataKey="debtBurden" 
                        name="Debt Burden"
                        radius={[4, 4, 0, 0]}
                      >
                        {debtTrendData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.debtBurden > 40 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} 
                          />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="threshold" stroke="hsl(var(--destructive))" strokeDasharray="5 5" name="Target (40%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Goals Progress */}
        {goalProjections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Savings Goals Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goalProjections.map((goal) => (
                  <div 
                    key={goal.id} 
                    className={`p-4 rounded-lg border ${goal.isOnTrack ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{goal.name}</h4>
                      <Badge variant={goal.isOnTrack ? "default" : "secondary"}>
                        {goal.isOnTrack ? "On Track" : "Behind"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{goal.progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${goal.isOnTrack ? "bg-success" : "bg-warning"}`}
                          style={{ width: `${Math.min(goal.progress, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatINR(goal.current_amount || 0)}</span>
                        <span>{formatINR(goal.target_amount)}</span>
                      </div>
                      <p className="text-xs mt-2">
                        {goal.monthsNeeded < Infinity 
                          ? `Achievable by ${format(goal.achieveDate, "MMM yyyy")} (${goal.monthsNeeded} months)`
                          : "Set monthly contribution to track"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Month-by-Month Breakdown
            </CardTitle>
            <CardDescription>Click any row to edit that month's budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Month</TableHead>
                    <TableHead className="font-semibold text-right">Income</TableHead>
                    <TableHead className="font-semibold text-right">EMIs</TableHead>
                    <TableHead className="font-semibold text-right">Fixed</TableHead>
                    <TableHead className="font-semibold text-right">Lifestyle</TableHead>
                    <TableHead className="font-semibold text-right">Savings</TableHead>
                    <TableHead className="font-semibold text-right">Free Cash</TableHead>
                    <TableHead className="font-semibold text-center">Debt %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecasts.map((forecast, index) => {
                    const isNegativeCash = forecast.freeCash < 0;
                    const isHighDebt = forecast.debtBurden > 40;
                    const isHealthy = forecast.freeCash > 0 && forecast.debtBurden < 40;

                    return (
                      <TableRow
                        key={forecast.monthKey}
                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                          isNegativeCash ? "bg-destructive/10" : isHealthy ? "bg-success/5" : ""
                        }`}
                        onClick={() => navigate(`/budget-planner?month=${forecast.monthKey}`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{forecast.month}</span>
                            {index === 0 && <Badge variant="outline" className="text-[10px]">Now</Badge>}
                            {!forecast.hasBudget && <Badge variant="secondary" className="text-[10px]">No Budget</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          {forecast.income > 0 ? formatINR(forecast.income) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-primary font-medium">
                          {forecast.emis > 0 ? formatINR(forecast.emis) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.fixedExpenses > 0 ? formatINR(forecast.fixedExpenses) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.lifestyleBudget > 0 ? formatINR(forecast.lifestyleBudget) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.plannedSavings > 0 ? formatINR(forecast.plannedSavings) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${isNegativeCash ? "text-destructive" : "text-success"}`}>
                            {forecast.income > 0 ? formatINR(forecast.freeCash) : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {forecast.income > 0 ? (
                            <Badge variant={isHighDebt ? "destructive" : "default"} className="text-xs">
                              {formatPercent(forecast.debtBurden)}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted font-semibold">
                    <TableCell>Total / Avg</TableCell>
                    <TableCell className="text-right text-success">{formatINR(totals.income)}</TableCell>
                    <TableCell className="text-right text-primary">{formatINR(totals.emis)}</TableCell>
                    <TableCell className="text-right">{formatINR(totals.fixedExpenses)}</TableCell>
                    <TableCell className="text-right">{formatINR(totals.lifestyleBudget)}</TableCell>
                    <TableCell className="text-right">{formatINR(totals.plannedSavings)}</TableCell>
                    <TableCell className={`text-right ${totals.freeCash >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatINR(totals.freeCash)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={avgDebtBurden > 40 ? "destructive" : "default"} className="text-xs">
                        ~{formatPercent(avgDebtBurden)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {negativeMonths > 0 && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Cash Flow Warning</p>
                    <p className="text-xs text-muted-foreground">
                      {negativeMonths} month(s) have negative cash flow. Review your budget to avoid financial stress.
                    </p>
                  </div>
                </div>
              )}
              {forecasts.filter(f => f.debtBurden > 40).length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <TrendingUp className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">High Debt Burden</p>
                    <p className="text-xs text-muted-foreground">
                      Debt burden exceeds 40% in some months. Consider accelerating loan payoff.
                    </p>
                  </div>
                </div>
              )}
              {totals.freeCash > 0 && (
                <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/30">
                  <ArrowUpRight className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Surplus Available</p>
                    <p className="text-xs text-muted-foreground">
                      You'll have {formatINR(totals.freeCash)} surplus over 12 months. Consider investing or prepaying loans.
                    </p>
                  </div>
                </div>
              )}
              {monthsWithBudget < 12 && (
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Complete Your Planning</p>
                    <p className="text-xs text-muted-foreground">
                      Only {monthsWithBudget} of 12 months have budgets set. Complete planning for better forecasts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}