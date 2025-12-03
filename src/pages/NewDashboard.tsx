import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Activity,
  ChevronRight,
  Percent,
  BarChart3,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatPercent } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
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
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

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
  route?: string;
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

// Clickable Card Component
interface ClickableCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
  className?: string;
}

function ClickableCard({ children, onClick, tooltip, className }: ClickableCardProps) {
  const cardContent = (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5",
        "active:scale-[0.98] active:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {children}
      {onClick && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
}

export default function NewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isNewUser, isLoading: onboardingLoading, refreshStatus } = useOnboardingStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
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
    interestPaid: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<BankTransaction[]>([]);
  const [topExpenses, setTopExpenses] = useState<ExpenseCategory[]>([]);

  // Show onboarding for new users
  useEffect(() => {
    if (!onboardingLoading && isNewUser && !onboardingDismissed) {
      const dismissed = localStorage.getItem(`onboarding_dismissed_${user?.id}`);
      if (!dismissed) {
        setShowOnboarding(true);
      }
    }
  }, [isNewUser, onboardingLoading, onboardingDismissed, user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingDismissed(true);
    refreshStatus();
    fetchDashboardData();
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    setOnboardingDismissed(true);
    if (user) {
      localStorage.setItem(`onboarding_dismissed_${user.id}`, "true");
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();

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
      
      const portfolioStats = calculatePortfolioStatsFromAmortization(loans);
      const thisMonth = calculateThisMonthEMI(loans);
      const nextMonth = calculateNextMonthEMI(loans);
      const lastMonth = calculateLastMonthEMI(loans);
      const totalPaid = calculateTotalPaidToDate(loans);
      const weightedAvgRate = calculateWeightedAvgInterest(loans);
      const projection = calculate6MonthProjection(loans);
      const upcoming7Days = calculateUpcoming7DaysEMI(loans);
      const overdueCount = countOverdueEMIs(loans);
      const progress = calculatePayoffProgress(loans);
      const alerts = generateRiskAlerts(loans, upcoming7Days.payments);
      
      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('book_balance')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      
      const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + (acc.book_balance || 0), 0) || 0;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user!.id)
        .single();
      
      const monthlyIncome = profile?.monthly_income || 0;
      
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data: transactions } = await supabase
        .from('transactions')
        .select('debit, credit')
        .eq('user_id', user!.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      
      const monthlyExpenses = transactions?.reduce((sum, txn) => sum + (txn.debit || 0), 0) || 0;
      
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
      
      const { data: recentTxns } = await supabase
        .from('transactions')
        .select('id, transaction_date, narration, debit, credit, balance, category')
        .eq('user_id', user!.id)
        .order('transaction_date', { ascending: false })
        .limit(10);
      
      setRecentTransactions(recentTxns || []);
      
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
      
      // Calculate interest paid (estimate from total paid - principal paid)
      const interestPaid = totalPaid - progress.paidPrincipal;
      
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
      setPayoffProgress({ ...progress, interestPaid });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRiskAlerts = (loans: LoanWithAmortization[], upcoming7Days: any[]): RiskAlert[] => {
    const alerts: RiskAlert[] = [];
    
    if (upcoming7Days.length > 0) {
      alerts.push({
        id: 'upcoming-7-days',
        severity: 'medium',
        title: `${upcoming7Days.length} EMI${upcoming7Days.length > 1 ? 's' : ''} Due Within 7 Days`,
        description: `Total ${formatINR(upcoming7Days.reduce((sum, p) => sum + p.amount, 0))} due soon`,
        route: '/emi-calendar',
      });
    }

    loans.forEach(loan => {
      if (loan.interest_rate_apy > 18) {
        alerts.push({
          id: `high-interest-${loan.id}`,
          severity: 'high',
          title: `High Interest Rate - ${loan.loan_name}`,
          description: `${formatPercent(loan.interest_rate_apy, 1)} APY - Consider refinancing`,
          loanId: loan.id,
          route: `/loans/${loan.id}`,
        });
      }
    });

    const emiToIncomeRatio = stats.monthlyIncome > 0 
      ? (stats.thisMonthEMI / stats.monthlyIncome) * 100 
      : 0;
    
    if (emiToIncomeRatio > 40) {
      alerts.push({
        id: 'budget-stress',
        severity: 'high',
        title: 'Budget Stress Alert',
        description: `EMI is ${emiToIncomeRatio.toFixed(0)}% of your income (>40% threshold)`,
        route: '/budget',
      });
    }

    return alerts;
  };

  // Navigate to EMI calendar with specific month
  const navigateToMonth = (monthIndex: number) => {
    const targetDate = addMonths(new Date(), monthIndex);
    const monthParam = format(targetDate, 'yyyy-MM');
    navigate(`/emi-calendar?month=${monthParam}`);
  };

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
      
      <div className="space-y-5 md:space-y-6 max-w-[1440px] mx-auto px-1 md:px-0">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-3 -mx-1 px-1 md:mx-0 md:px-0 md:relative md:bg-transparent md:backdrop-blur-none">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Financial Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your complete financial overview at a glance</p>
          </div>
          <Button onClick={() => navigate("/loans/new")} size="default" className="w-full md:w-auto shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Add New Loan
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-7 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards - 6 columns on desktop, 2 on mobile */}
            <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {/* Total Outstanding */}
              <ClickableCard
                onClick={() => navigate("/loans?status=active")}
                tooltip="View all active loans and balances"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatINR(stats.totalOutstanding)}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    Principal + Interest
                  </p>
                </CardContent>
              </ClickableCard>

              {/* EMIs Due This Month */}
              <ClickableCard
                onClick={() => navigateToMonth(0)}
                tooltip="See full EMI schedule for this month"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">EMIs This Month</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatINR(stats.thisMonthEMI)}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    {stats.thisMonthEMICount} payment{stats.thisMonthEMICount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </ClickableCard>

              {/* EMIs Due Next Month */}
              <ClickableCard
                onClick={() => navigateToMonth(1)}
                tooltip="Plan for upcoming month's EMIs"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">EMIs Next Month</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatINR(stats.nextMonthEMI)}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    {stats.nextMonthEMICount} payment{stats.nextMonthEMICount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </ClickableCard>

              {/* Total Paid Till Date */}
              <ClickableCard
                onClick={() => navigate("/payments")}
                tooltip="View all payments you have made"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold text-green-600">{formatINR(stats.totalPaidToDate)}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    All time payments
                  </p>
                </CardContent>
              </ClickableCard>

              {/* Average Interest Rate */}
              <ClickableCard
                onClick={() => navigate("/loan-comparison")}
                tooltip="Compare interest rates across lenders"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Avg Interest</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Percent className="h-4 w-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatPercent(stats.avgInterestRate, 2)}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    Weighted average
                  </p>
                </CardContent>
              </ClickableCard>

              {/* Active Loans */}
              <ClickableCard
                onClick={() => navigate("/loans?status=active")}
                tooltip="List of all currently running loans"
                className="relative"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-lg md:text-2xl font-bold">{stats.activeLoans}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    Currently running
                  </p>
                </CardContent>
              </ClickableCard>
            </div>

            {/* Month-over-Month Comparison */}
            <Card className="w-full">
              <CardHeader className="p-4 md:p-6 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      This Month vs Last Month
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm mt-1">
                      Track your financial changes
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* EMI Comparison - Clickable */}
                  <ClickableCard
                    onClick={() => navigateToMonth(0)}
                    tooltip="View EMI calendar for current month"
                    className="bg-muted/30"
                  >
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">EMI Payments</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl md:text-2xl font-bold">{formatINR(stats.thisMonthEMI)}</span>
                        {stats.lastMonthEMI > 0 && (
                          <span className={`text-sm flex items-center gap-0.5 ${
                            stats.thisMonthEMI > stats.lastMonthEMI ? 'text-red-500' : 'text-green-500'
                          }`}>
                            {stats.thisMonthEMI > stats.lastMonthEMI ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {Math.abs(((stats.thisMonthEMI - stats.lastMonthEMI) / stats.lastMonthEMI) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {formatINR(stats.lastMonthEMI)}
                      </p>
                    </CardContent>
                  </ClickableCard>

                  {/* Expenses Comparison - Clickable */}
                  <ClickableCard
                    onClick={() => navigate("/budget/monthly-expenses")}
                    tooltip="View monthly expenses breakdown"
                    className="bg-muted/30"
                  >
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Expenses</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl md:text-2xl font-bold">{formatINR(stats.monthlyExpenses)}</span>
                        {stats.lastMonthExpenses > 0 && (
                          <span className={`text-sm flex items-center gap-0.5 ${
                            stats.monthlyExpenses > stats.lastMonthExpenses ? 'text-red-500' : 'text-green-500'
                          }`}>
                            {stats.monthlyExpenses > stats.lastMonthExpenses ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {Math.abs(((stats.monthlyExpenses - stats.lastMonthExpenses) / stats.lastMonthExpenses) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {formatINR(stats.lastMonthExpenses)}
                      </p>
                    </CardContent>
                  </ClickableCard>

                  {/* Net Balance Comparison - Clickable */}
                  <ClickableCard
                    onClick={() => navigate("/banking/brs-report")}
                    tooltip="View detailed BRS report"
                    className="bg-muted/30"
                  >
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Net Balance</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl md:text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatINR(stats.netBalance)}
                        </span>
                        {stats.lastMonthNetBalance !== 0 && (
                          <span className={`text-sm flex items-center gap-0.5 ${
                            stats.netBalance > stats.lastMonthNetBalance ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {stats.netBalance > stats.lastMonthNetBalance ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {stats.lastMonthNetBalance !== 0 
                              ? Math.abs(((stats.netBalance - stats.lastMonthNetBalance) / Math.abs(stats.lastMonthNetBalance)) * 100).toFixed(1)
                              : '∞'}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {formatINR(stats.lastMonthNetBalance)}
                      </p>
                    </CardContent>
                  </ClickableCard>
                </div>
              </CardContent>
            </Card>

            {/* Payoff Progress - Clickable */}
            <ClickableCard
              onClick={() => navigate("/loans")}
              tooltip="View all loans with payoff progress"
              className="w-full"
            >
              <CardHeader className="p-4 md:p-6 pb-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                  Overall Payoff Progress
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Track your debt reduction journey
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-green-600">{payoffProgress.progressPercent.toFixed(1)}% Paid Off</span>
                  </div>
                  
                  {/* Multi-segment progress bar */}
                  <div className="relative h-4 w-full rounded-full overflow-hidden bg-muted">
                    <div 
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${Math.min(payoffProgress.progressPercent, 100)}%` }}
                    />
                    <div 
                      className="absolute top-0 h-full bg-orange-400/50 transition-all duration-500"
                      style={{ 
                        left: `${Math.min(payoffProgress.progressPercent, 100)}%`,
                        width: `${Math.min(100 - payoffProgress.progressPercent, 100)}%` 
                      }}
                    />
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-500" />
                      <span className="text-muted-foreground">Paid</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-orange-400/50" />
                      <span className="text-muted-foreground">Remaining</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Total Principal</p>
                      <p className="text-sm md:text-lg font-semibold mt-1">{formatINR(payoffProgress.totalPrincipal)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Principal Paid</p>
                      <p className="text-sm md:text-lg font-semibold text-green-600 mt-1">{formatINR(payoffProgress.paidPrincipal)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-orange-500/10">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Remaining</p>
                      <p className="text-sm md:text-lg font-semibold text-orange-600 mt-1">{formatINR(stats.totalOutstanding)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </ClickableCard>

            {/* Main Content Grid - 2 columns on desktop */}
            <div className="grid gap-4 lg:grid-cols-2 w-full">
              {/* Upcoming EMIs - Next 7 Days */}
              <Card className="w-full">
                <CardHeader className="p-4 md:p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                        Upcoming EMIs
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">Next 7 days</CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => navigate("/emi-calendar")}
                    >
                      View All <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2">
                  {upcoming7DaysEMIs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No EMIs due in the next 7 days</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming7DaysEMIs.slice(0, 5).map((emi) => (
                        <div 
                          key={emi.id || `${emi.loanId}-${emi.dueDate}`} 
                          className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 hover:border-primary/30 cursor-pointer transition-all group"
                          onClick={() => navigate(`/loans/${emi.loanId}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">{emi.loanName}</p>
                              {emi.daysUntilDue === 0 && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Due Today</Badge>
                              )}
                              {emi.daysUntilDue === 1 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600">Tomorrow</Badge>
                              )}
                              {emi.interestRate > 18 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/50 text-red-500">High Interest</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{emi.lenderName}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(emi.dueDate), 'MMM dd')} • {emi.daysUntilDue} day{emi.daysUntilDue !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <p className="font-semibold">{formatINR(emi.amount)}</p>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Bank Activity */}
              <Card className="w-full">
                <CardHeader className="p-4 md:p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Building2 className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">Last 10 transactions</CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => navigate("/expenses?period=all_time")}
                    >
                      View All <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2">
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recent transactions</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentTransactions.slice(0, 6).map((txn) => (
                        <div 
                          key={txn.id} 
                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-all group"
                          onClick={() => navigate(`/expenses?id=${txn.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{txn.narration}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">{format(new Date(txn.transaction_date), 'MMM dd')}</p>
                              {txn.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{txn.category}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-2 flex items-center gap-1">
                            {txn.credit ? (
                              <p className="text-sm font-semibold text-green-600 flex items-center">
                                <ArrowDownRight className="h-3 w-3 mr-0.5" />
                                {formatINR(txn.credit)}
                              </p>
                            ) : (
                              <p className="text-sm font-semibold text-red-600 flex items-center">
                                <ArrowUpRight className="h-3 w-3 mr-0.5" />
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

              {/* Top Expenses This Month - Clickable */}
              <ClickableCard
                onClick={() => navigate("/expenses?period=current_month")}
                tooltip="View all expenses and transactions"
                className="w-full"
              >
                <CardHeader className="p-4 md:p-6 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Receipt className="h-4 w-4 md:h-5 md:w-5 text-rose-500" />
                    Top Expenses This Month
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Highest spending categories</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2">
                  {topExpenses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No expense data this month</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {topExpenses.map((expense, index) => (
                        <div key={expense.category} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                index === 0 ? "bg-rose-500/10 text-rose-500" :
                                index === 1 ? "bg-orange-500/10 text-orange-500" :
                                "bg-amber-500/10 text-amber-500"
                              )}>
                                {index + 1}
                              </span>
                              <span className="font-medium text-sm">{expense.category}</span>
                            </div>
                            <span className="font-semibold">{formatINR(expense.amount)}</span>
                          </div>
                          <Progress 
                            value={Math.min((expense.amount / (topExpenses[0]?.amount || 1)) * 100, 100)} 
                            className="h-1.5" 
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </ClickableCard>

              {/* Alerts & Warnings */}
              <Card className="w-full">
                <CardHeader className="p-4 md:p-6 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                    Alerts & Warnings
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Action items requiring attention</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2">
                  <div className="space-y-2">
                    {stats.overdueCount > 0 && (
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/15 transition-colors"
                        onClick={() => navigate("/emi-calendar")}
                      >
                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-red-600">Overdue EMIs</p>
                          <p className="text-xs text-red-500/80">{stats.overdueCount} EMI{stats.overdueCount > 1 ? 's' : ''} - Immediate action required</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    
                    {riskAlerts.slice(0, 4).map((alert) => (
                      <div 
                        key={alert.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                          alert.severity === 'high' 
                            ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/15" 
                            : "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
                        )}
                        onClick={() => alert.route && navigate(alert.route)}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          alert.severity === 'high' ? "bg-red-500/20" : "bg-amber-500/20"
                        )}>
                          <AlertCircle className={cn(
                            "h-4 w-4",
                            alert.severity === 'high' ? "text-red-500" : "text-amber-500"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium text-sm",
                            alert.severity === 'high' ? "text-red-600" : "text-amber-600"
                          )}>{alert.title}</p>
                          <p className={cn(
                            "text-xs",
                            alert.severity === 'high' ? "text-red-500/80" : "text-amber-500/80"
                          )}>{alert.description}</p>
                        </div>
                        <ChevronRight className={cn(
                          "h-4 w-4",
                          alert.severity === 'high' ? "text-red-500" : "text-amber-500"
                        )} />
                      </div>
                    ))}
                    
                    {(stats.netBalance < 0) && (
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/15 transition-colors"
                        onClick={() => navigate("/budget")}
                      >
                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                          <DollarSign className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-red-600">Negative Balance</p>
                          <p className="text-xs text-red-500/80">Expenses exceed income this month</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-red-500" />
                      </div>
                    )}

                    {(stats.totalBankBalance < stats.thisMonthEMI) && (
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15 transition-colors"
                        onClick={() => navigate("/banking")}
                      >
                        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-amber-600">Low Bank Balance</p>
                          <p className="text-xs text-amber-500/80">May not cover this month's EMIs</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-amber-500" />
                      </div>
                    )}

                    {riskAlerts.length === 0 && stats.overdueCount === 0 && stats.netBalance >= 0 && stats.totalBankBalance >= stats.thisMonthEMI && (
                      <div className="text-center py-6 text-muted-foreground">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-green-600">All Clear!</p>
                        <p className="text-xs">No alerts at the moment</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 6-Month EMI Timeline - Full Width with Clickable Bars */}
            <Card className="w-full">
              <CardHeader className="p-4 md:p-6 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      6-Month EMI Timeline
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">Click on any month to view details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="w-full overflow-x-auto -mx-2 px-2">
                  <ResponsiveContainer width="100%" height={280} minWidth={300}>
                    <BarChart data={monthlyProjection}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        fontSize={11}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        fontSize={11}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <RechartsTooltip 
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
                      <Bar 
                        dataKey="emi" 
                        radius={[8, 8, 0, 0]}
                        cursor="pointer"
                        onClick={(data, index) => navigateToMonth(index)}
                      >
                        {monthlyProjection.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'}
                            className="hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Monthly breakdown below chart - Clickable */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {monthlyProjection.map((proj, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "text-center p-3 border rounded-xl cursor-pointer transition-all",
                        "hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm",
                        index === 0 && "bg-primary/5 border-primary/30"
                      )}
                      onClick={() => navigateToMonth(index)}
                    >
                      <p className="text-xs font-medium text-muted-foreground">{proj.month}</p>
                      <p className="text-base md:text-lg font-bold mt-1">{formatINR(proj.emi)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{proj.count} EMI{proj.count > 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions - Large Icon Buttons */}
            <Card className="w-full">
              <CardHeader className="p-4 md:p-6 pb-2">
                <CardTitle className="text-base md:text-lg">Quick Actions</CardTitle>
                <CardDescription className="text-xs md:text-sm">Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-3 py-6 hover:bg-primary/5 hover:border-primary/30 transition-all group" 
                    onClick={() => navigate("/loans/new")}
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <span className="font-medium">Add Loan</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-3 py-6 hover:bg-green-500/5 hover:border-green-500/30 transition-all group" 
                    onClick={() => navigate("/payments")}
                  >
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                      <CreditCard className="h-6 w-6 text-green-500" />
                    </div>
                    <span className="font-medium">Record Payment</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-3 py-6 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all group" 
                    onClick={() => navigate("/emi-calendar")}
                  >
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Calendar className="h-6 w-6 text-blue-500" />
                    </div>
                    <span className="font-medium">EMI Calendar</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-3 py-6 hover:bg-purple-500/5 hover:border-purple-500/30 transition-all group" 
                    onClick={() => navigate("/financial-insights")}
                  >
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                      <Activity className="h-6 w-6 text-purple-500" />
                    </div>
                    <span className="font-medium">Full Insights</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
