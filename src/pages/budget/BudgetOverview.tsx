import { useState, useEffect, useMemo } from "react";
import { format, addMonths } from "date-fns";
import { LineChart, AlertTriangle, TrendingUp, RefreshCw, Zap, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import FadeInStagger from "@/components/FadeInStagger";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area
} from "recharts";

interface MonthForecast {
  month: string;
  monthLabel: string;
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  emiTotal: number;
  savings: number;
  freeCash: number;
  debtBurden: number;
  isNegative: boolean;
  isHighDebt: boolean;
}

export default function BudgetOverview() {
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<MonthForecast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Simulation state
  const [salaryIncrease, setSalaryIncrease] = useState(0);
  const [bonusMonth, setBonusMonth] = useState(0);
  const [bonusAmount, setBonusAmount] = useState(0);

  const fetchForecastData = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentMonth = format(new Date(), 'yyyy-MM');
      
      const { data: budget } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .maybeSingle();

      const { data: loans } = await supabase
        .from('loans')
        .select('*, amortization_rows(*)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      const { data: incomeSources } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { data: recurringExpenses } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const forecastData: MonthForecast[] = [];
      const baseIncome = (budget?.salary || 0) + (budget?.side_income || 0) + (budget?.other_income || 0);
      const additionalIncome = incomeSources?.reduce((sum, src) => sum + (src.amount || 0), 0) || 0;
      
      const fixedExp = (budget?.rent || 0) + (budget?.utilities || 0) + (budget?.insurance || 0) + 
                       (budget?.subscriptions || 0) + (budget?.school || 0) + (budget?.transport || 0);
      const variableExp = (budget?.food || 0) + (budget?.eating_out || 0) + (budget?.shopping || 0) + 
                          (budget?.travel || 0) + (budget?.other_variable || 0);
      const savings = budget?.savings_investments || 0;
      
      const recurringTotal = recurringExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM yyyy');
        const monthIndex = i + 1;

        const salaryBoost = baseIncome * (salaryIncrease / 100) * Math.floor(i / 12);
        const bonus = bonusMonth === monthIndex ? bonusAmount : 0;
        const totalIncome = baseIncome + additionalIncome + salaryBoost + bonus;

        let emiTotal = 0;
        loans?.forEach(loan => {
          const row = loan.amortization_rows?.find((r: any) => 
            format(new Date(r.due_on), 'yyyy-MM') === monthKey
          );
          if (row) {
            emiTotal += row.scheduled_emi;
          }
        });

        const totalExpenses = fixedExp + variableExp + recurringTotal + emiTotal + savings;
        const freeCash = totalIncome - totalExpenses;
        const debtBurden = totalIncome > 0 ? (emiTotal / totalIncome) * 100 : 0;

        forecastData.push({
          month: monthKey,
          monthLabel,
          income: totalIncome,
          fixedExpenses: fixedExp,
          variableExpenses: variableExp + recurringTotal,
          emiTotal,
          savings,
          freeCash,
          debtBurden,
          isNegative: freeCash < 0,
          isHighDebt: debtBurden > 40,
        });
      }

      setForecast(forecastData);
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, []);

  const stats = useMemo(() => {
    if (forecast.length === 0) return null;
    const avgFreeCash = forecast.reduce((sum, m) => sum + m.freeCash, 0) / forecast.length;
    const negativeMonths = forecast.filter(m => m.isNegative).length;
    const highDebtMonths = forecast.filter(m => m.isHighDebt).length;
    const totalSavings = forecast.reduce((sum, m) => sum + m.savings, 0);
    return { avgFreeCash, negativeMonths, highDebtMonths, totalSavings };
  }, [forecast]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <LineChart className="h-7 w-7 text-primary" />
            Overview & Forecast
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            12-month financial projection with what-if simulations
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchForecastData}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Avg. Free Cash</p>
              <p className={`text-xl font-bold ${stats.avgFreeCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatINR(stats.avgFreeCash)}
              </p>
            </CardContent>
          </Card>
          <Card className={stats.negativeMonths > 0 ? 'border-l-4 border-l-red-500' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Negative Months</p>
              <p className="text-xl font-bold">{stats.negativeMonths}</p>
            </CardContent>
          </Card>
          <Card className={stats.highDebtMonths > 0 ? 'border-l-4 border-l-amber-500' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">High Debt Months</p>
              <p className="text-xl font-bold">{stats.highDebtMonths}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">12-Month Savings</p>
              <p className="text-xl font-bold text-primary">{formatINR(stats.totalSavings)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Alert */}
      {stats && (stats.negativeMonths > 0 || stats.highDebtMonths > 2) && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Financial Risk Detected</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {stats.negativeMonths > 0 && `${stats.negativeMonths} month(s) show negative cash flow. `}
                {stats.highDebtMonths > 2 && `Debt burden exceeds 40% for ${stats.highDebtMonths} months.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary" className="text-xs md:text-sm">
            <TrendingUp className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs md:text-sm">
            <LineChart className="h-4 w-4 mr-1.5 hidden sm:inline" />
            12-Month Forecast
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-xs md:text-sm">
            <Zap className="h-4 w-4 mr-1.5 hidden sm:inline" />
            What-If
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Flow Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatINR(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="income" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" name="Income" />
                    <Bar dataKey="emiTotal" fill="hsl(var(--destructive))" name="EMI" opacity={0.7} />
                    <Line type="monotone" dataKey="freeCash" stroke="#22c55e" strokeWidth={2} name="Free Cash" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 12-Month Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Month</th>
                    <th className="text-right p-2">Income</th>
                    <th className="text-right p-2">Expenses</th>
                    <th className="text-right p-2">EMI</th>
                    <th className="text-right p-2">Free Cash</th>
                    <th className="text-right p-2">Debt %</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((m) => (
                    <tr key={m.month} className={`border-b ${m.isNegative ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <td className="p-2 font-medium">{m.monthLabel}</td>
                      <td className="text-right p-2">{formatINR(m.income)}</td>
                      <td className="text-right p-2">{formatINR(m.fixedExpenses + m.variableExpenses)}</td>
                      <td className="text-right p-2">{formatINR(m.emiTotal)}</td>
                      <td className={`text-right p-2 font-medium ${m.freeCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatINR(m.freeCash)}
                      </td>
                      <td className="text-right p-2">
                        <Badge variant={m.isHighDebt ? 'destructive' : 'secondary'} className="text-xs">
                          {m.debtBurden.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Debt Burden Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Debt Burden Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Bar dataKey="debtBurden" fill="hsl(var(--primary))" name="Debt Burden %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* What-If Simulation Tab */}
        <TabsContent value="simulation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                What-If Simulation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salaryIncrease">Annual Salary Increase (%)</Label>
                  <Input
                    id="salaryIncrease"
                    type="number"
                    value={salaryIncrease}
                    onChange={(e) => setSalaryIncrease(Number(e.target.value))}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonusMonth">Bonus Month (1-12)</Label>
                  <Input
                    id="bonusMonth"
                    type="number"
                    min={0}
                    max={12}
                    value={bonusMonth}
                    onChange={(e) => setBonusMonth(Number(e.target.value))}
                    placeholder="e.g., 3 for March"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonusAmount">Bonus Amount</Label>
                  <Input
                    id="bonusAmount"
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(Number(e.target.value))}
                    placeholder="e.g., 50000"
                  />
                </div>
              </div>
              <Button onClick={fetchForecastData} className="w-full md:w-auto">
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </Button>
            </CardContent>
          </Card>

          {/* Simulation Results Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Simulated Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatINR(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="income" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" name="Income" />
                    <Line type="monotone" dataKey="freeCash" stroke="#22c55e" strokeWidth={2} name="Free Cash" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FadeInStagger>
  );
}
