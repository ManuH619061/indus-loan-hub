import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Target,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ComposedChart, Legend } from 'recharts';
import { motion } from "framer-motion";
import {
  fetchLoansWithAmortization,
  calculateThisMonthEMI,
} from "@/lib/portfolio-stats";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  emi: number;
  savings: number;
}

export default function CashflowBudgetDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyEMI: 0,
    freeCash: 0,
    burnRate: 0,
    savingsRate: 0,
    budgetUsed: 0,
    budgetTotal: 0,
    disciplineScore: 0,
    varianceAmount: 0,
    variancePercent: 0,
  });
  const [trendData, setTrendData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const currentMonthYear = format(today, 'yyyy-MM');

      // Fetch profile for income
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user.id)
        .single();

      const monthlyIncome = profile?.monthly_income || 0;

      // Fetch monthly budget
      const { data: budgetData } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonthYear)
        .single();

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('monthly_expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('expense_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('expense_date', format(monthEnd, 'yyyy-MM-dd'));

      const monthlyExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

      // Fetch EMI
      const loansData = await fetchLoansWithAmortization(user.id);
      const emiData = calculateThisMonthEMI(loansData);
      const monthlyEMI = emiData.total;

      // Calculate stats
      const freeCash = monthlyIncome - monthlyExpenses - monthlyEMI;
      const totalOutflow = monthlyExpenses + monthlyEMI;
      const burnRate = monthlyIncome > 0 ? (totalOutflow / monthlyIncome) * 100 : 0;
      const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - totalOutflow) / monthlyIncome) * 100 : 0;

      const budgetTotal = budgetData ? 
        (budgetData.salary || 0) + (budgetData.side_income || 0) + (budgetData.other_income || 0) : monthlyIncome;
      const budgetUsed = totalOutflow;
      
      const varianceAmount = budgetTotal - budgetUsed;
      const variancePercent = budgetTotal > 0 ? (varianceAmount / budgetTotal) * 100 : 0;

      // Spending discipline score (0-100)
      // Based on: staying within budget, savings rate, expense consistency
      let disciplineScore = 50;
      if (varianceAmount >= 0) disciplineScore += 20; // Under budget
      if (savingsRate >= 20) disciplineScore += 15;
      else if (savingsRate >= 10) disciplineScore += 10;
      if (burnRate <= 70) disciplineScore += 15;

      setStats({
        monthlyIncome,
        monthlyExpenses,
        monthlyEMI,
        freeCash,
        burnRate,
        savingsRate: Math.max(0, savingsRate),
        budgetUsed,
        budgetTotal,
        disciplineScore: Math.min(100, Math.max(0, disciplineScore)),
        varianceAmount,
        variancePercent,
      });

      // Fetch trend data for last 6 months
      const trend: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const mMonthYear = format(monthDate, 'yyyy-MM');

        const { data: mExpenses } = await supabase
          .from('monthly_expenses')
          .select('amount')
          .eq('user_id', user.id)
          .gte('expense_date', format(mStart, 'yyyy-MM-dd'))
          .lte('expense_date', format(mEnd, 'yyyy-MM-dd'));

        const mTotalExpenses = mExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

        // Get EMI for that month from amortization
        let mEMI = 0;
        loansData.forEach(loan => {
          loan.amortization_rows?.forEach(row => {
            const dueDate = new Date(row.due_on);
            if (dueDate >= mStart && dueDate <= mEnd && row.is_paid) {
              mEMI += row.scheduled_emi;
            }
          });
        });

        trend.push({
          month: format(monthDate, 'MMM'),
          income: monthlyIncome,
          expenses: mTotalExpenses,
          emi: mEMI,
          savings: Math.max(0, monthlyIncome - mTotalExpenses - mEMI),
        });
      }
      setTrendData(trend);
    } catch (error) {
      console.error("Error fetching cashflow data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return "Excellent";
    if (score >= 50) return "Good";
    if (score >= 25) return "Needs Work";
    return "Critical";
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cashflow & Budget</h1>
          <p className="text-muted-foreground text-sm">Monitor your income, expenses, and savings</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-bold">{formatINR(stats.monthlyIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <ArrowDownRight className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-bold">{formatINR(stats.monthlyExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EMI</p>
                <p className="text-lg font-bold">{formatINR(stats.monthlyEMI)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(stats.freeCash < 0 && "border-destructive/50")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", stats.freeCash >= 0 ? "bg-emerald-500/10" : "bg-destructive/10")}>
                <PiggyBank className={cn("h-5 w-5", stats.freeCash >= 0 ? "text-emerald-500" : "text-destructive")} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Free Cash</p>
                <p className={cn("text-lg font-bold", stats.freeCash < 0 && "text-destructive")}>
                  {formatINR(stats.freeCash)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discipline Score and Budget Progress */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spending Discipline</CardTitle>
            <CardDescription>Based on budget adherence and savings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    className="text-muted/20"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className={getScoreColor(stats.disciplineScore)}
                    strokeWidth="8"
                    strokeDasharray={`${(stats.disciplineScore / 100) * 352} 352`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-3xl font-bold", getScoreColor(stats.disciplineScore))}>
                    {stats.disciplineScore}
                  </span>
                  <span className="text-xs text-muted-foreground">{getScoreLabel(stats.disciplineScore)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budget Usage</CardTitle>
            <CardDescription>Current month spending vs budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Used: {formatINR(stats.budgetUsed)}</span>
                <span>Budget: {formatINR(stats.budgetTotal)}</span>
              </div>
              <Progress 
                value={stats.budgetTotal > 0 ? Math.min(100, (stats.budgetUsed / stats.budgetTotal) * 100) : 0} 
                className={cn("h-3", stats.budgetUsed > stats.budgetTotal && "[&>div]:bg-destructive")}
              />
            </div>
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              stats.varianceAmount >= 0 ? "bg-green-500/10" : "bg-destructive/10"
            )}>
              {stats.varianceAmount >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm">
                {stats.varianceAmount >= 0 
                  ? `${formatINR(stats.varianceAmount)} under budget` 
                  : `${formatINR(Math.abs(stats.varianceAmount))} over budget`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">6-Month Trend</CardTitle>
          <CardDescription>Income vs expenses vs EMI over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  labelStyle={{ color: '#888' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={4} />
                <Bar dataKey="emi" name="EMI" fill="hsl(var(--primary))" radius={4} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Burn Rate and Savings */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Burn Rate</p>
                <p className="text-2xl font-bold">{stats.burnRate.toFixed(0)}%</p>
              </div>
              <TrendingDown className={cn("h-8 w-8", stats.burnRate > 90 ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.burnRate <= 70 ? "Healthy spending" : stats.burnRate <= 90 ? "Moderate spending" : "High spending"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Savings Rate</p>
                <p className="text-2xl font-bold">{stats.savingsRate.toFixed(0)}%</p>
              </div>
              <Target className={cn("h-8 w-8", stats.savingsRate >= 20 ? "text-green-500" : "text-muted-foreground")} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.savingsRate >= 20 ? "Great savings!" : stats.savingsRate >= 10 ? "Good progress" : "Room for improvement"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
