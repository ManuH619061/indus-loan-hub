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
  calculateThisMonthEMI,
  calculateNextMonthEMI,
  calculateLastMonthEMI,
  calculateTotalPaidToDate,
  calculateWeightedAvgInterest,
  calculate6MonthProjection,
  calculateUpcoming7DaysEMI,
  countOverdueEMIs,
  calculatePayoffProgress,
  type MonthlyProjection,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface DashboardStats {
  totalOutstanding: number;
  activeLoans: number;
  avgInterestRate: number;
  thisMonthEMI: number;
  thisMonthEMICount: number;
  nextMonthEMI: number;
  nextMonthEMICount: number;
  lastMonthEMI: number;
  lastMonthEMICount: number;
  totalPaidToDate: number;
  overdueCount: number;
  totalBankBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  lastMonthExpenses: number;
  netBalance: number;
  lastMonthNetBalance: number;
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
    thisMonthEMI: 0,
    thisMonthEMICount: 0,
    nextMonthEMI: 0,
    nextMonthEMICount: 0,
    lastMonthEMI: 0,
    lastMonthEMICount: 0,
    totalPaidToDate: 0,
    overdueCount: 0,
    totalBankBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    lastMonthExpenses: 0,
    netBalance: 0,
    lastMonthNetBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcoming7DaysEMIs, setUpcoming7DaysEMIs] = useState<any[]>([]);
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
      
      // Calculate this month & next month & last month EMI
      const thisMonth = calculateThisMonthEMI(loans);
      const nextMonth = calculateNextMonthEMI(loans);
      const lastMonth = calculateLastMonthEMI(loans);
      
      // Calculate total paid to date
      const totalPaid = calculateTotalPaidToDate(loans);
      
      // Calculate weighted average interest rate
      const weightedAvgRate = calculateWeightedAvgInterest(loans);
      
      // Calculate 6-month projection
      const projection = calculate6MonthProjection(loans);
      
      // Calculate upcoming 7 days for alerts
      const upcoming7Days = calculateUpcoming7DaysEMI(loans);
      
      // Count overdue EMIs
      const overdueCount = countOverdueEMIs(loans);
      
      // Calculate payoff progress
      const progress = calculatePayoffProgress(loans);
      
      // Generate risk alerts
      const alerts = generateRiskAlerts(loans, upcoming7Days.payments);
      
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
      
      // Fetch last month's expenses
      const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
      
      const { data: lastMonthTransactions } = await supabase
        .from('transactions')
        .select('debit, credit')
        .eq('user_id', user!.id)
        .gte('transaction_date', lastMonthStart)
        .lte('transaction_date', lastMonthEnd);
      
      const lastMonthExpenses = lastMonthTransactions?.reduce((sum, txn) => sum + (txn.debit || 0), 0) || 0;
      
      const netBalance = monthlyIncome - monthlyExpenses - thisMonth.total;
      const lastMonthNetBalance = monthlyIncome - lastMonthExpenses - lastMonth.total;
      
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
        avgInterestRate: weightedAvgRate,
        thisMonthEMI: thisMonth.total,
        thisMonthEMICount: thisMonth.count,
        nextMonthEMI: nextMonth.total,
        nextMonthEMICount: nextMonth.count,
        lastMonthEMI: lastMonth.total,
        lastMonthEMICount: lastMonth.count,
        totalPaidToDate: totalPaid,
        overdueCount: overdueCount,
        totalBankBalance,
        monthlyIncome,
        monthlyExpenses,
        lastMonthExpenses,
        netBalance,
        lastMonthNetBalance,
      });
      
      setUpcoming7DaysEMIs(upcoming7Days.payments);
      setMonthlyProjection(projection);
      setRiskAlerts(alerts);
      setPayoffProgress(progress);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRiskAlerts = (loans: LoanWithAmortization[], upcoming7Days: any[]): RiskAlert[] => {
    const alerts: RiskAlert[] = [];

    // Overdue EMIs already handled in main alerts section
    
    // Upcoming EMIs within 7 days
    if (upcoming7Days.length > 0) {
      alerts.push({
        id: 'upcoming-7-days',
        severity: 'medium',
        title: `${upcoming7Days.length} EMI${upcoming7Days.length > 1 ? 's' : ''} Due Within 7 Days`,
        description: `Total ${formatINR(upcoming7Days.reduce((sum, p) => sum + p.amount, 0))} due soon`,
      });
    }

    loans.forEach(loan => {
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

    // Budget stress alert (EMI > 40% of income)
    const emiToIncomeRatio = stats.monthlyIncome > 0 
      ? (stats.thisMonthEMI / stats.monthlyIncome) * 100 
      : 0;
    
    if (emiToIncomeRatio > 40) {
      alerts.push({
        id: 'budget-stress',
        severity: 'high',
        title: 'Budget Stress Alert',
        description: `EMI is ${emiToIncomeRatio.toFixed(0)}% of your income (>40% threshold)`,
      });
    }

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
          {/* Top Summary Row - 6 Cards */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Total Outstanding */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.totalOutstanding)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Principal + Interest remaining
                </p>
              </CardContent>
            </Card>

            {/* EMIs Due This Month */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">EMIs Due This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.thisMonthEMI)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.thisMonthEMICount} {stats.thisMonthEMICount === 1 ? 'payment' : 'payments'} this month
                </p>
              </CardContent>
            </Card>

            {/* EMIs Due Next Month */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">EMIs Due Next Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatINR(stats.nextMonthEMI)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.nextMonthEMICount} {stats.nextMonthEMICount === 1 ? 'payment' : 'payments'} next month
                </p>
              </CardContent>
            </Card>

            {/* Total Paid Till Date */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Paid Till Date</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold text-green-600">{formatINR(stats.totalPaidToDate)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All EMI payments made
                </p>
              </CardContent>
            </Card>

            {/* Average Interest Rate */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Interest Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{formatPercent(stats.avgInterestRate, 2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Weighted by outstanding balance
                </p>
              </CardContent>
            </Card>

            {/* Active Loans */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{stats.activeLoans}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently running
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Month-over-Month Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                This Month vs Last Month
              </CardTitle>
              <CardDescription>
                Compare EMI payments, expenses, and net balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* EMI Comparison */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">EMI Payments</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{formatINR(stats.thisMonthEMI)}</span>
                    {stats.lastMonthEMI > 0 && (
                      <span className={`text-sm flex items-center gap-1 ${
                        stats.thisMonthEMI > stats.lastMonthEMI ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {stats.thisMonthEMI > stats.lastMonthEMI ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {Math.abs(((stats.thisMonthEMI - stats.lastMonthEMI) / stats.lastMonthEMI) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last month: {formatINR(stats.lastMonthEMI)}
                  </p>
                </div>

                {/* Expenses Comparison */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Expenses</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{formatINR(stats.monthlyExpenses)}</span>
                    {stats.lastMonthExpenses > 0 && (
                      <span className={`text-sm flex items-center gap-1 ${
                        stats.monthlyExpenses > stats.lastMonthExpenses ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {stats.monthlyExpenses > stats.lastMonthExpenses ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {Math.abs(((stats.monthlyExpenses - stats.lastMonthExpenses) / stats.lastMonthExpenses) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last month: {formatINR(stats.lastMonthExpenses)}
                  </p>
                </div>

                {/* Net Balance Comparison */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Net Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatINR(stats.netBalance)}
                    </span>
                    {stats.lastMonthNetBalance !== 0 && (
                      <span className={`text-sm flex items-center gap-1 ${
                        stats.netBalance > stats.lastMonthNetBalance ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stats.netBalance > stats.lastMonthNetBalance ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {stats.lastMonthNetBalance !== 0 
                          ? Math.abs(((stats.netBalance - stats.lastMonthNetBalance) / Math.abs(stats.lastMonthNetBalance)) * 100).toFixed(1)
                          : '∞'}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last month: {formatINR(stats.lastMonthNetBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
            {/* Upcoming EMIs - Next 7 Days */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming EMIs (Next 7 Days)
                </CardTitle>
                <CardDescription>Immediate attention required</CardDescription>
              </CardHeader>
              <CardContent>
                {upcoming7DaysEMIs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No EMIs due in the next 7 days</p>
                ) : (
                  <div className="space-y-3">
                    {upcoming7DaysEMIs.slice(0, 5).map((emi) => (
                      <div key={emi.id || `${emi.loanId}-${emi.dueDate}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{emi.loanName}</p>
                            {emi.interestRate > 18 && (
                              <Badge variant="destructive" className="text-xs">High Interest</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{emi.lenderName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {format(new Date(emi.dueDate), 'MMM dd, yyyy')} 
                            <span className="ml-2 font-medium">({emi.daysUntilDue} {emi.daysUntilDue === 1 ? 'day' : 'days'})</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatINR(emi.amount)}</p>
                        </div>
                      </div>
                    ))}
                    {upcoming7DaysEMIs.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/emi-calendar")}>
                        View All {upcoming7DaysEMIs.length} EMIs
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

                  {(stats.totalBankBalance < stats.thisMonthEMI) && (
                    <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">Low bank balance:</span> Your current balance may not cover this month's EMIs.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 6-Month EMI Timeline - Full Width */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                6-Month EMI Timeline
              </CardTitle>
              <CardDescription>EMI projection with payment counts for the next 6 months</CardDescription>
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
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${label} - ${data.count} EMI${data.count > 1 ? 's' : ''}` : label;
                    }}
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
              
              {/* Monthly breakdown below chart */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {monthlyProjection.map((proj, index) => (
                  <div key={index} className="text-center p-3 border rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground">{proj.month}</p>
                    <p className="text-lg font-bold mt-1">{formatINR(proj.emi)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{proj.count} EMI{proj.count > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
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
