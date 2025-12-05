import { useState, useEffect, useMemo, useRef } from "react";
import { format, addMonths } from "date-fns";
import { 
  LineChart, AlertTriangle, TrendingUp, RefreshCw, Zap, Play, 
  ShieldCheck, Gauge, Target, Wallet, CreditCard, AlertCircle,
  ArrowRight, CheckCircle, XCircle, ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Scenario {
  id: string;
  name: string;
  salaryIncrease: number;
  bonusMonth: number;
  bonusAmount: number;
  extraEmi: number;
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "current", name: "Current", salaryIncrease: 0, bonusMonth: 0, bonusAmount: 0, extraEmi: 0 },
  { id: "salary_10", name: "Salary +10%", salaryIncrease: 10, bonusMonth: 0, bonusAmount: 0, extraEmi: 0 },
  { id: "bonus_50k", name: "Bonus ₹50K", salaryIncrease: 0, bonusMonth: 3, bonusAmount: 50000, extraEmi: 0 },
  { id: "extra_emi", name: "Extra EMI ₹5K/mo", salaryIncrease: 0, bonusMonth: 0, bonusAmount: 0, extraEmi: 5000 },
];

export default function BudgetOverview() {
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<MonthForecast[]>([]);
  const [baseForecast, setBaseForecast] = useState<MonthForecast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"12-month" | "3-month">("12-month");
  
  // Simulation state
  const [activeScenario, setActiveScenario] = useState<string>("current");
  const [salaryIncrease, setSalaryIncrease] = useState(0);
  const [bonusMonth, setBonusMonth] = useState(0);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [extraEmi, setExtraEmi] = useState(0);
  
  // Base data for comparison
  const baseDataRef = useRef<{
    baseIncome: number;
    fixedExp: number;
    variableExp: number;
    savings: number;
    recurringTotal: number;
  } | null>(null);

  const fetchForecastData = async (scenario?: Scenario) => {
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

      // Store base data
      baseDataRef.current = { baseIncome: baseIncome + additionalIncome, fixedExp, variableExp, savings, recurringTotal };

      // Use scenario values if provided, otherwise use state
      const scenarioSalaryIncrease = scenario?.salaryIncrease ?? salaryIncrease;
      const scenarioBonusMonth = scenario?.bonusMonth ?? bonusMonth;
      const scenarioBonusAmount = scenario?.bonusAmount ?? bonusAmount;
      const scenarioExtraEmi = scenario?.extraEmi ?? extraEmi;

      for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM yyyy');
        const monthIndex = i + 1;

        const salaryBoost = (baseIncome + additionalIncome) * (scenarioSalaryIncrease / 100);
        const bonus = scenarioBonusMonth === monthIndex ? scenarioBonusAmount : 0;
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

        const totalExpenses = fixedExp + variableExp + recurringTotal + emiTotal + savings + scenarioExtraEmi;
        const freeCash = totalIncome - totalExpenses;
        const debtBurden = totalIncome > 0 ? ((emiTotal + scenarioExtraEmi) / totalIncome) * 100 : 0;

        forecastData.push({
          month: monthKey,
          monthLabel,
          income: totalIncome,
          fixedExpenses: fixedExp,
          variableExpenses: variableExp + recurringTotal,
          emiTotal: emiTotal + scenarioExtraEmi,
          savings,
          freeCash,
          debtBurden,
          isNegative: freeCash < 0,
          isHighDebt: debtBurden > 40,
        });
      }

      setForecast(forecastData);
      
      // Store base forecast for comparison (only on initial load)
      if (!scenario || scenario.id === "current") {
        setBaseForecast(forecastData);
      }
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

  const handleScenarioChange = (scenarioId: string) => {
    setActiveScenario(scenarioId);
    const scenario = DEFAULT_SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      setSalaryIncrease(scenario.salaryIncrease);
      setBonusMonth(scenario.bonusMonth);
      setBonusAmount(scenario.bonusAmount);
      setExtraEmi(scenario.extraEmi);
      fetchForecastData(scenario);
    }
  };

  const runCustomSimulation = () => {
    fetchForecastData();
  };

  const stats = useMemo(() => {
    if (forecast.length === 0) return null;
    const avgFreeCash = forecast.reduce((sum, m) => sum + m.freeCash, 0) / forecast.length;
    const negativeMonths = forecast.filter(m => m.isNegative).length;
    const highDebtMonths = forecast.filter(m => m.isHighDebt).length;
    const totalSavings = forecast.reduce((sum, m) => sum + m.savings, 0);
    const avgDebtBurden = forecast.reduce((sum, m) => sum + m.debtBurden, 0) / forecast.length;
    const totalIncome = forecast.reduce((sum, m) => sum + m.income, 0);
    const savingsPercent = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
    
    // Budget Health Score calculation
    const positiveMonthsScore = ((12 - negativeMonths) / 12) * 40; // 40 points max
    const savingsScore = Math.min(savingsPercent * 2, 30); // 30 points max (15% savings = full score)
    const debtBurdenScore = Math.max(0, 30 - avgDebtBurden); // 30 points max (0% burden = full score)
    const healthScore = Math.round(positiveMonthsScore + savingsScore + debtBurdenScore);
    
    return { avgFreeCash, negativeMonths, highDebtMonths, totalSavings, avgDebtBurden, healthScore, savingsPercent };
  }, [forecast]);

  const baseStats = useMemo(() => {
    if (baseForecast.length === 0) return null;
    const avgFreeCash = baseForecast.reduce((sum, m) => sum + m.freeCash, 0) / baseForecast.length;
    const negativeMonths = baseForecast.filter(m => m.isNegative).length;
    const avgDebtBurden = baseForecast.reduce((sum, m) => sum + m.debtBurden, 0) / baseForecast.length;
    return { avgFreeCash, negativeMonths, avgDebtBurden };
  }, [baseForecast]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-950/30";
    if (score >= 60) return "bg-amber-100 dark:bg-amber-950/30";
    return "bg-red-100 dark:bg-red-950/30";
  };

  const displayForecast = viewMode === "3-month" ? forecast.slice(0, 3) : forecast;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Future Cash-Flow
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Forecast your financial position for the next 12 months
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchForecastData()}
            disabled={refreshing}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Warning Card */}
      {stats && (stats.negativeMonths > 0 || stats.highDebtMonths > 2) && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Warning: {stats.negativeMonths} month(s) with negative free cash
                {stats.highDebtMonths > 2 && ` and EMI risk`}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Review your budget or run a simulation to improve your financial outlook.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Budget Health Score */}
          <Card className={`border-l-4 ${stats.healthScore >= 80 ? 'border-l-green-500' : stats.healthScore >= 60 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Health Score</p>
                <Gauge className={`h-4 w-4 ${getHealthColor(stats.healthScore)}`} />
              </div>
              <p className={`text-2xl font-bold ${getHealthColor(stats.healthScore)}`}>
                {stats.healthScore}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </p>
              <Progress value={stats.healthScore} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          {/* Avg Free Cash */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Avg Free Cash</p>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-xl font-bold ${stats.avgFreeCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatINR(stats.avgFreeCash)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">per month</p>
            </CardContent>
          </Card>

          {/* Negative Months */}
          <Card className={stats.negativeMonths > 0 ? 'border-l-4 border-l-red-500' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Negative Months</p>
                {stats.negativeMonths > 0 ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-xl font-bold">{stats.negativeMonths}</p>
              <p className="text-xs text-muted-foreground mt-1">of 12 months</p>
            </CardContent>
          </Card>

          {/* EMI Burden */}
          <Card className={stats.avgDebtBurden > 40 ? 'border-l-4 border-l-amber-500' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">EMI Burden</p>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold">{stats.avgDebtBurden.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">of income</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk & Alert Panel */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* EMI Risk */}
          <Card className="bg-gradient-to-br from-red-50 to-transparent dark:from-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <span className="font-medium text-sm">EMI Risk</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.negativeMonths > 0 
                  ? `${stats.negativeMonths} upcoming months where balance may be insufficient for EMIs.`
                  : "All EMIs are covered. No immediate risk detected."}
              </p>
            </CardContent>
          </Card>

          {/* Overspending Risk */}
          <Card className="bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-medium text-sm">Savings Status</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.savingsPercent >= 15 
                  ? `Saving ${stats.savingsPercent.toFixed(1)}% of income. Great job!`
                  : `Only saving ${stats.savingsPercent.toFixed(1)}% of income. Aim for 15-20%.`}
              </p>
            </CardContent>
          </Card>

          {/* Monthly Status */}
          <Card className="bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-sm">This Month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {forecast[0]?.isNegative 
                  ? "At risk. Review expenses to balance budget."
                  : "On track. Keep monitoring your spending."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="summary" className="text-xs">
              <LineChart className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="forecast" className="text-xs">
              <TrendingUp className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="simulation" className="text-xs">
              <Zap className="h-4 w-4 mr-1.5 hidden sm:inline" />
              What-If
            </TabsTrigger>
          </TabsList>
          
          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12-month">12 Months</SelectItem>
              <SelectItem value="3-month">Next 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Flow Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={displayForecast}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatINR(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="income" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" name="Income" />
                    <Bar dataKey="emiTotal" fill="hsl(var(--destructive))" name="EMI" opacity={0.7} />
                    <Line type="monotone" dataKey="freeCash" stroke="#22c55e" strokeWidth={2} name="Free Cash" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <table className="w-full text-xs md:text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Month</th>
                    <th className="text-right p-2 font-medium">Income</th>
                    <th className="text-right p-2 font-medium hidden sm:table-cell">Expenses</th>
                    <th className="text-right p-2 font-medium">EMI</th>
                    <th className="text-right p-2 font-medium">Free Cash</th>
                    <th className="text-right p-2 font-medium">Debt %</th>
                  </tr>
                </thead>
                <tbody>
                  {displayForecast.map((m) => (
                    <tr key={m.month} className={`border-b ${m.isNegative ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <td className="p-2 font-medium">{m.monthLabel}</td>
                      <td className="text-right p-2">{formatINR(m.income)}</td>
                      <td className="text-right p-2 hidden sm:table-cell">{formatINR(m.fixedExpenses + m.variableExpenses)}</td>
                      <td className="text-right p-2">{formatINR(m.emiTotal)}</td>
                      <td className={`text-right p-2 font-medium ${m.freeCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatINR(m.freeCash)}
                      </td>
                      <td className="text-right p-2">
                        <Badge variant={m.isHighDebt ? 'destructive' : 'secondary'} className="text-xs">
                          {m.debtBurden.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation" className="space-y-4 mt-4">
          {/* Scenario Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                What-If Simulation
              </CardTitle>
              <CardDescription>Choose a preset scenario or customize values</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Scenarios */}
              <div className="flex flex-wrap gap-2">
                {DEFAULT_SCENARIOS.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant={activeScenario === scenario.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleScenarioChange(scenario.id)}
                  >
                    {scenario.name}
                  </Button>
                ))}
              </div>

              {/* Custom Values */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Salary Increase (%)</Label>
                  <Input
                    type="number"
                    value={salaryIncrease}
                    onChange={(e) => {
                      setSalaryIncrease(Number(e.target.value));
                      setActiveScenario("custom");
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bonus Month (1-12)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    value={bonusMonth}
                    onChange={(e) => {
                      setBonusMonth(Number(e.target.value));
                      setActiveScenario("custom");
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bonus Amount</Label>
                  <Input
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => {
                      setBonusAmount(Number(e.target.value));
                      setActiveScenario("custom");
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Extra EMI/month</Label>
                  <Input
                    type="number"
                    value={extraEmi}
                    onChange={(e) => {
                      setExtraEmi(Number(e.target.value));
                      setActiveScenario("custom");
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              <Button onClick={runCustomSimulation} className="w-full sm:w-auto">
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </Button>
            </CardContent>
          </Card>

          {/* Comparison Strip */}
          {baseStats && stats && activeScenario !== "current" && (
            <Card className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scenario Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Negative Months</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg font-semibold">{baseStats.negativeMonths}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-lg font-semibold ${stats.negativeMonths < baseStats.negativeMonths ? 'text-green-600' : stats.negativeMonths > baseStats.negativeMonths ? 'text-red-600' : ''}`}>
                        {stats.negativeMonths}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Free Cash</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{formatINR(baseStats.avgFreeCash)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-sm font-semibold ${stats.avgFreeCash > baseStats.avgFreeCash ? 'text-green-600' : stats.avgFreeCash < baseStats.avgFreeCash ? 'text-red-600' : ''}`}>
                        {formatINR(stats.avgFreeCash)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">EMI Burden</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg font-semibold">{baseStats.avgDebtBurden.toFixed(0)}%</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-lg font-semibold ${stats.avgDebtBurden < baseStats.avgDebtBurden ? 'text-green-600' : stats.avgDebtBurden > baseStats.avgDebtBurden ? 'text-red-600' : ''}`}>
                        {stats.avgDebtBurden.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Simulated Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Simulated Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={displayForecast}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatINR(value)} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
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
