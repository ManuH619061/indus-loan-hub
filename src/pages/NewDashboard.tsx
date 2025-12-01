import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  Calendar,
  Clock,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Building2,
  Receipt,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatPercent } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  fetchLoansWithAmortization,
  calculatePortfolioStatsFromAmortization,
  calculateNext30DaysEMI,
  calculate6MonthProjection,
  countOverdueEMIs,
  calculatePayoffProgress,
  type MonthlyProjection,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface DashboardStats {
  totalOutstanding: number;
  activeLoans: number;
  avgInterestRate: number;
  upcomingEMI: number;
  upcomingEMICount: number;
  overdueCount: number;
  totalBankBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyEMI: number;
  netBalance: number;
}

interface RiskAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  loanId?: string;
}

interface BankTransaction {
  id: string;
  transaction_date: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  category: string | null;
}

interface ExpenseCategory {
  category: string;
  amount: number;
}

export default function NewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOutstanding: 0,
    activeLoans: 0,
    avgInterestRate: 0,
    upcomingEMI: 0,
    upcomingEMICount: 0,
    overdueCount: 0,
    totalBankBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyEMI: 0,
    netBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingEMIs, setUpcomingEMIs] = useState<any[]>([]);
  const [monthlyProjection, setMonthlyProjection] = useState<MonthlyProjection[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [payoffProgress, setPayoffProgress] = useState({
    totalPrincipal: 0,
    paidPrincipal: 0,
    remainingPrincipal: 0,
    progressPercent: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<BankTransaction[]>([]);
  const [topExpenses, setTopExpenses] = useState<ExpenseCategory[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Subscribe to real-time changes
      const channel = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchDashboardData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amortization_rows' }, fetchDashboardData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchDashboardData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, fetchDashboardData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchDashboardData)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const loans = await fetchLoansWithAmortization(user!.id);
      
      // Calculate portfolio stats
      const portfolioStats = calculatePortfolioStatsFromAmortization(loans);
      
      // Calculate next 30 days EMI
      const next30Days = calculateNext30DaysEMI(loans);
      
      // Calculate 6-month projection
      const projection = calculate6MonthProjection(loans);
      
      // Count overdue EMIs
      const overdueCount = countOverdueEMIs(loans);
      
      // Calculate payoff progress
      const progress = calculatePayoffProgress(loans);
      
      // Generate risk alerts
      const alerts = generateRiskAlerts(loans);
      
      // Fetch bank balances
      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('book_balance')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      
      const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + (acc.book_balance || 0), 0) || 0;
      
      // Fetch monthly income from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user!.id)
        .single();
      
      const monthlyIncome = profile?.monthly_income || 0;
      
      // Fetch this month's expenses
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data: transactions } = await supabase
        .from('transactions')
        .select('debit, credit')
        .eq('user_id', user!.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      
      const monthlyExpenses = transactions?.reduce((sum, txn) => sum + (txn.debit || 0), 0) || 0;
      
      // Calculate this month's EMI total
      const thisMonthEMI = loans.reduce((sum, loan) => {
        const thisMonthRows = loan.amortization_rows?.filter(row => {
          const dueDate = new Date(row.due_on);
          return dueDate >= new Date(startDate) && dueDate <= new Date(endDate) && !row.is_paid;
        }) || [];
        return sum + thisMonthRows.reduce((rowSum, row) => rowSum + row.scheduled_emi, 0);
      }, 0);
      
      const netBalance = monthlyIncome - monthlyExpenses - thisMonthEMI;
      
      // Fetch recent transactions
      const { data: recentTxns } = await supabase
        .from('transactions')
        .select('id, transaction_date, narration, debit, credit, balance, category')
        .eq('user_id', user!.id)
        .order('transaction_date', { ascending: false })
        .limit(10);
      
      setRecentTransactions(recentTxns || []);
      
      // Calculate top 3 expense categories this month
      const { data: categoryTxns } = await supabase
        .from('transactions')
        .select('category, debit')
        .eq('user_id', user!.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .not('category', 'is', null);
      
      const categoryMap = new Map<string, number>();
      categoryTxns?.forEach(txn => {
        if (txn.category && txn.debit) {
          categoryMap.set(txn.category, (categoryMap.get(txn.category) || 0) + txn.debit);
        }
      });
      
      const topCats = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      
      setTopExpenses(topCats);
      
      setStats({
        totalOutstanding: portfolioStats.totalOutstanding,
        activeLoans: portfolioStats.activeLoansCount,
        avgInterestRate: portfolioStats.avgInterestRate,
        upcomingEMI: next30Days.total,
        upcomingEMICount: next30Days.count,
        overdueCount: overdueCount,
        totalBankBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlyEMI: thisMonthEMI,
        netBalance,
      });
      
      setUpcomingEMIs(next30Days.payments);
      setMonthlyProjection(projection);
      setRiskAlerts(alerts);
      setPayoffProgress(progress);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRiskAlerts = (loans: LoanWithAmortization[]): RiskAlert[] => {
    const alerts: RiskAlert[] = [];

    loans.forEach(loan => {
      // Check for high outstanding (>80% of principal remaining)
      const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
      const remainingPrincipal = unpaidRows.reduce((sum, row) => sum + row.principal_component, 0);
      
      if (remainingPrincipal > loan.principal_amount * 0.8) {
        alerts.push({
          id: `high-outstanding-${loan.id}`,
          severity: 'medium',
          title: `High Outstanding - ${loan.loan_name}`,
          description: `${formatPercent((remainingPrincipal / loan.principal_amount) * 100, 0)} of principal remaining`,
          loanId: loan.id,
        });
      }

      // Check for high interest rate
      if (loan.interest_rate_apy > 18) {
        alerts.push({
          id: `high-interest-${loan.id}`,
          severity: 'high',
          title: `High Interest Rate - ${loan.loan_name}`,
          description: `${formatPercent(loan.interest_rate_apy, 1)} APY - Consider refinancing`,
          loanId: loan.id,
        });
      }
    });

    return alerts;
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Complete overview of your financial health</p>
        </div>
        <Button onClick={() => navigate("/loans/new")} size="lg" className="w-full md:w-auto">
          <Plus className="mr-2 h-5 w-5" />
          Add Loan
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Top Summary Row - 4 Cards */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Outstanding */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.totalOutstanding)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Principal + Interest across {stats.activeLoans} {stats.activeLoans === 1 ? 'loan' : 'loans'}
                </p>
              </CardContent>
            </Card>

            {/* Next 30 Days EMI */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next 30 Days EMI</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.upcomingEMI)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.upcomingEMICount} {stats.upcomingEMICount === 1 ? 'payment' : 'payments'} due
                </p>
              </CardContent>
            </Card>

            {/* Total Bank Balance */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bank Balance</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.totalBankBalance)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All active accounts
                </p>
              </CardContent>
            </Card>

            {/* This Month Net Balance */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month Net</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl md:text-3xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatINR(stats.netBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Income - Expenses - EMIs
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payoff Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overall Payoff Progress
              </CardTitle>
              <CardDescription>
                Principal paid, interest paid, and total remaining
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{payoffProgress.progressPercent.toFixed(1)}% Paid Off</span>
                </div>
                <Progress value={payoffProgress.progressPercent} className="h-3" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Principal</p>
                    <p className="text-lg font-semibold">{formatINR(payoffProgress.totalPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Principal Paid</p>
                    <p className="text-lg font-semibold text-green-600">{formatINR(payoffProgress.paidPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining Total</p>
                    <p className="text-lg font-semibold text-orange-600">{formatINR(stats.totalOutstanding)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Grid - 2 columns on desktop */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming EMIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming EMIs (Next 30 Days)
                </CardTitle>
                <CardDescription>Next payments due with details</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingEMIs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No upcoming EMIs in the next 30 days</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingEMIs.slice(0, 5).map((emi) => (
                      <div key={emi.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{emi.loanName}</p>
                            {emi.interestRate > 18 && (
                              <Badge variant="destructive" className="text-xs">High Interest</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{emi.lenderName}</p>
                          <p className="text-xs text-muted-foreground mt-1">Due: {format(new Date(emi.dueDate), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatINR(emi.amount)}</p>
                        </div>
                      </div>
                    ))}
                    {upcomingEMIs.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/emi-calendar")}>
                        View All {upcomingEMIs.length} EMIs
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Bank Activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Recent Bank Activity
                    </CardTitle>
                    <CardDescription>Last 10 transactions</CardDescription>
                  </div>
                  <Link to="/expenses">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No recent transactions</p>
                ) : (
                  <div className="space-y-2">
                    {recentTransactions.slice(0, 8).map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-2 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{txn.narration}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">{format(new Date(txn.transaction_date), 'MMM dd')}</p>
                            {txn.category && (
                              <Badge variant="outline" className="text-xs">{txn.category}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          {txn.credit ? (
                            <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                              <ArrowDownRight className="h-3 w-3" />
                              {formatINR(txn.credit)}
                            </p>
                          ) : (
                            <p className="text-sm font-semibold text-red-600 flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3" />
                              {formatINR(txn.debit || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Expenses This Month */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Top Expenses This Month
                </CardTitle>
                <CardDescription>Highest spending categories</CardDescription>
              </CardHeader>
              <CardContent>
                {topExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No expense data for this month</p>
                ) : (
                  <div className="space-y-4">
                    {topExpenses.map((expense, index) => (
                      <div key={expense.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-muted-foreground">#{index + 1}</span>
                            <span className="font-medium">{expense.category}</span>
                          </div>
                          <span className="font-semibold">{formatINR(expense.amount)}</span>
                        </div>
                        <Progress 
                          value={Math.min((expense.amount / (topExpenses[0]?.amount || 1)) * 100, 100)} 
                          className="h-2" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alerts & Warnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Alerts & Warnings
                </CardTitle>
                <CardDescription>Action items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.overdueCount > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {stats.overdueCount} overdue {stats.overdueCount === 1 ? 'EMI' : 'EMIs'} - immediate action required
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {riskAlerts.slice(0, 4).map((alert) => (
                    <Alert 
                      key={alert.id}
                      variant={alert.severity === 'high' ? 'destructive' : 'default'}
                      className={
                        alert.severity === 'medium' 
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                          : ''
                      }
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">{alert.title}:</span> {alert.description}
                      </AlertDescription>
                    </Alert>
                  ))}
                  
                  {riskAlerts.length === 0 && stats.overdueCount === 0 && (
                    <p className="text-sm text-muted-foreground py-4">
                      All good! No alerts at the moment.
                    </p>
                  )}

                  {(stats.netBalance < 0) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">Negative net balance this month:</span> Your expenses and EMIs exceed your income. Review your budget.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(stats.totalBankBalance < stats.upcomingEMI) && (
                    <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">Low bank balance:</span> Your current balance may not cover upcoming EMIs.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 6-Month EMI Projection - Full Width */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                6-Month EMI Projection
              </CardTitle>
              <CardDescription>Upcoming EMI payments over the next 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyProjection}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    fontSize={12}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    fontSize={12}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatINR(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="emi" radius={[8, 8, 0, 0]}>
                    {monthlyProjection.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/loans/new")}>
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Add Loan</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/payments")}>
                  <CreditCard className="h-5 w-5" />
                  <span className="text-sm">Record Payment</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/emi-calendar")}>
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm">EMI Calendar</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/financial-insights")}>
                  <Activity className="h-5 w-5" />
                  <span className="text-sm">Full Insights</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
