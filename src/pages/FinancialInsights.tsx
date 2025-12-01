import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatINR, formatPercent } from "@/lib/currency";
import { format } from "date-fns";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertTriangle,
  CreditCard,
  Shield,
  BarChart3,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  DollarSign,
  Receipt,
  Building2,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { cn } from "@/lib/utils";

export default function FinancialInsights() {
  const { loading, data } = useFinancialInsights();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Unable to load financial insights.</p>
      </div>
    );
  }

  const getDTIColor = (label: string) => {
    switch (label) {
      case "Excellent": return "text-green-600 dark:text-green-400";
      case "Good": return "text-blue-600 dark:text-blue-400";
      case "Risky": return "text-orange-600 dark:text-orange-400";
      case "Critical": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getDTIBadgeVariant = (label: string) => {
    switch (label) {
      case "Excellent": return "default";
      case "Good": return "secondary";
      case "Risky": return "outline";
      case "Critical": return "destructive";
      default: return "secondary";
    }
  };

  const getRiskTagColor = (tag: string) => {
    switch (tag) {
      case "Low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Medium": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "High": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case "error": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financial Insights</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Comprehensive view of your financial health and risk factors
        </p>
      </div>

      {/* Summary Cards - 3 columns on desktop, stacked on mobile */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Monthly Finance Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Income</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatINR(data.totalIncome)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <span className="font-semibold">{formatINR(data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">EMIs</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {formatINR(data.totalEMIThisMonth)}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-sm font-medium">Net Balance</span>
              <span className={cn(
                "font-bold",
                data.netBalance >= 0 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                {formatINR(data.netBalance)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Savings Rate:</span>
              <span className={cn(
                "font-semibold",
                data.savingsRate >= 20 
                  ? "text-green-600 dark:text-green-400" 
                  : data.savingsRate >= 10 
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-red-600 dark:text-red-400"
              )}>
                {formatPercent(data.savingsRate, 1)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Debt & Risk Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Debt & Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Debt-to-Income</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatPercent(data.debtToIncomeRatio, 1)}</span>
                  <Badge variant={getDTIBadgeVariant(data.dtiLabel)} className="text-xs">
                    {data.dtiLabel}
                  </Badge>
                </div>
              </div>
              <Progress 
                value={Math.min(data.debtToIncomeRatio, 100)} 
                className="h-2"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Credit Utilization</span>
                <span className={cn(
                  "font-semibold",
                  data.creditUtilization <= 30 
                    ? "text-green-600 dark:text-green-400" 
                    : data.creditUtilization <= 50 
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-red-600 dark:text-red-400"
                )}>
                  {formatPercent(data.creditUtilization, 1)}
                </span>
              </div>
              <Progress 
                value={Math.min(data.creditUtilization, 100)} 
                className="h-2"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">Emergency Fund</span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "font-bold text-lg",
                  data.emergencyFundMonths >= 6 
                    ? "text-green-600 dark:text-green-400" 
                    : data.emergencyFundMonths >= 3 
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-red-600 dark:text-red-400"
                )}>
                  {data.emergencyFundMonths.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">months</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Loan Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Loans</span>
              <span className="font-bold text-lg">{data.portfolioStats.activeLoansCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Outstanding</span>
              <span className="font-semibold">{formatINR(data.portfolioStats.totalOutstanding)}</span>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted-foreground">Payoff Progress</span>
                <span className="font-semibold text-primary">
                  {formatPercent(data.payoffProgress.progressPercent, 1)}
                </span>
              </div>
              <Progress value={data.payoffProgress.progressPercent} className="h-2" />
            </div>
            {data.overdueCount > 0 && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{data.overdueCount} Overdue EMI(s)</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout for desktop */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Spending Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Spending Insights
            </CardTitle>
            <CardDescription>Top 5 categories vs last month</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topSpendingCategories.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                No spending data available
              </div>
            ) : (
              <div className="space-y-4">
                {data.topSpendingCategories.map((cat, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatINR(cat.currentMonth)}</span>
                        {cat.change !== 0 && (
                          <div className={cn(
                            "flex items-center text-xs",
                            cat.change > 0 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-green-600 dark:text-green-400"
                          )}>
                            {cat.change > 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {formatPercent(Math.abs(cat.changePercent), 0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 h-2">
                      <div 
                        className="bg-primary rounded-full" 
                        style={{ width: `${Math.min((cat.currentMonth / (data.topSpendingCategories[0]?.currentMonth || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last month: {formatINR(cat.lastMonth)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loan Insights & Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Loan Insights
            </CardTitle>
            <CardDescription>Individual loan details with risk assessment</CardDescription>
          </CardHeader>
          <CardContent>
            {data.loanInsights.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                No active loans
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {data.loanInsights.map((loan) => (
                  <div key={loan.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{loan.loanName}</p>
                        {loan.lenderName && (
                          <p className="text-xs text-muted-foreground">{loan.lenderName}</p>
                        )}
                      </div>
                      <Badge className={cn("text-xs", getRiskTagColor(loan.riskTag))}>
                        {loan.riskTag} Risk
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Interest:</span>{" "}
                        <span className="font-medium">{formatPercent(loan.interestRate, 1)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">EMI:</span>{" "}
                        <span className="font-medium">{formatINR(loan.emi)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outstanding:</span>{" "}
                        <span className="font-medium">{formatINR(loan.outstanding)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Payoff:</span>{" "}
                        <span className="font-medium">
                          {loan.payoffDate ? format(new Date(loan.payoffDate), "MMM yyyy") : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Paid</span>
                        <span>{formatPercent(loan.paidPercent, 0)}</span>
                      </div>
                      <Progress value={loan.paidPercent} className="h-1.5" />
                    </div>
                  </div>
                ))}

                {/* Payoff Timeline */}
                {(data.earliestPayoff || data.latestPayoff) && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Payoff Timeline
                    </p>
                    {data.earliestPayoff && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Earliest:</span>
                        <span>
                          {data.earliestPayoff.loanName} - {format(new Date(data.earliestPayoff.date), "MMM yyyy")}
                        </span>
                      </div>
                    )}
                    {data.latestPayoff && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Latest:</span>
                        <span>
                          {data.latestPayoff.loanName} - {format(new Date(data.latestPayoff.date), "MMM yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Flow Projection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cash Flow Projection
            </CardTitle>
            <CardDescription>Next 6 months (Income - Expenses - EMIs)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                netFlow: { label: "Net Flow", color: "hsl(var(--primary))" },
                income: { label: "Income", color: "hsl(var(--chart-1))" },
                expenses: { label: "Expenses", color: "hsl(var(--chart-2))" },
                emis: { label: "EMIs", color: "hsl(var(--chart-3))" },
              }}
              className="h-[250px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cashFlowProjection} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatINR(value)}
                  />
                  <Bar dataKey="netFlow" radius={[4, 4, 0, 0]}>
                    {data.cashFlowProjection.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.netFlow >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-muted/50 rounded">
                <DollarSign className="h-4 w-4 mx-auto text-green-600 dark:text-green-400" />
                <p className="text-xs text-muted-foreground mt-1">Avg Income</p>
                <p className="font-semibold text-sm">
                  {formatINR(data.cashFlowProjection.reduce((sum, m) => sum + m.income, 0) / 6)}
                </p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <Receipt className="h-4 w-4 mx-auto text-orange-600 dark:text-orange-400" />
                <p className="text-xs text-muted-foreground mt-1">Avg Expenses</p>
                <p className="font-semibold text-sm">
                  {formatINR(data.cashFlowProjection.reduce((sum, m) => sum + m.expenses, 0) / 6)}
                </p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <CreditCard className="h-4 w-4 mx-auto text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-muted-foreground mt-1">Avg EMIs</p>
                <p className="font-semibold text-sm">
                  {formatINR(data.cashFlowProjection.reduce((sum, m) => sum + m.emis, 0) / 6)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alerts & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Alerts & Recommendations
            </CardTitle>
            <CardDescription>Action items to improve financial health</CardDescription>
          </CardHeader>
          <CardContent>
            {data.riskAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                  <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium text-green-600 dark:text-green-400">All Clear!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No major risk factors detected. Your finances are well-managed.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {data.riskAlerts.map((alert) => (
                  <Alert key={alert.id} variant={getAlertVariant(alert.type)}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">{alert.title}</AlertTitle>
                    <AlertDescription className="text-xs">
                      <p>{alert.message}</p>
                      <div className="flex items-start gap-1 mt-2 text-primary">
                        <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{alert.recommendation}</span>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
