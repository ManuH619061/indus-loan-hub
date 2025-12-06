import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  Calendar,
  Clock,
  Wallet,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Building2,
  ChevronRight,
  ArrowRight,
  Bell,
  Zap,
  Ban,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatPercent } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  fetchLoansWithAmortization,
  calculatePortfolioStatsFromAmortization,
  calculateThisMonthEMI,
  calculateUpcoming7DaysEMI,
  countOverdueEMIs,
  calculatePayoffProgress,
  calculateOutstandingFromAmortization,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, addDays, differenceInDays, isWithinInterval, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalOutstandingPrincipal: number;
  activeLoans: number;
  thisMonthEMI: number;
  thisMonthEMICount: number;
  paidThisMonthCount: number;
  overdueCount: number;
  overdueAmount: number;
  nextEMIDate: string | null;
  nextEMIAmount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  highInterestLoans: { count: number; outstanding: number };
  closingIn90Days: { count: number; emiTotal: number };
  missedLastSixMonths: number;
}

interface EMICalendarItem {
  id: string;
  date: string;
  loanName: string;
  amount: number;
  status: 'paid' | 'upcoming' | 'overdue';
  loanId: string;
}

interface LenderExposure {
  lenderId: string;
  lenderName: string;
  outstanding: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  tag?: string;
  route?: string;
}

export default function NewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isNewUser, isLoading: onboardingLoading, refreshStatus } = useOnboardingStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanWithAmortization[]>([]);
  const [lenders, setLenders] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOutstandingPrincipal: 0,
    activeLoans: 0,
    thisMonthEMI: 0,
    thisMonthEMICount: 0,
    paidThisMonthCount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    nextEMIDate: null,
    nextEMIAmount: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    highInterestLoans: { count: 0, outstanding: 0 },
    closingIn90Days: { count: 0, emiTotal: 0 },
    missedLastSixMonths: 0,
  });
  const [emiCalendar, setEmiCalendar] = useState<EMICalendarItem[]>([]);
  const [lenderExposure, setLenderExposure] = useState<LenderExposure[]>([]);
  const [payoffProgress, setPayoffProgress] = useState({
    totalPrincipal: 0,
    paidPrincipal: 0,
    remainingPrincipal: 0,
    progressPercent: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [calendarTab, setCalendarTab] = useState<'week' | 'month' | 'all'>('month');

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
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const loansData = await fetchLoansWithAmortization(user.id);
      setLoans(loansData);

      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // Fetch lenders
      const { data: lendersData } = await supabase
        .from('lenders')
        .select('id, name')
        .eq('user_id', user.id);
      setLenders(lendersData || []);

      // Calculate portfolio stats
      const portfolioStats = calculatePortfolioStatsFromAmortization(loansData);
      const thisMonth = calculateThisMonthEMI(loansData);
      const overdueCount = countOverdueEMIs(loansData);
      const progress = calculatePayoffProgress(loansData);

      // Calculate outstanding principal (sum of closing_principal for last unpaid row per loan)
      let totalOutstandingPrincipal = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        if (unpaidRows.length > 0) {
          // Use the closing principal of the first unpaid row (which represents current outstanding)
          const sortedUnpaid = unpaidRows.sort((a, b) => a.period_no - b.period_no);
          totalOutstandingPrincipal += sortedUnpaid[0].closing_principal + sortedUnpaid[0].principal_component;
        }
      });

      // Calculate paid EMIs this month
      let paidThisMonthCount = 0;
      loansData.forEach(loan => {
        const paidRows = loan.amortization_rows?.filter(r => r.is_paid) || [];
        paidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
            paidThisMonthCount++;
          }
        });
      });

      // Calculate overdue amount
      let overdueAmount = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (isBefore(dueDate, today)) {
            overdueAmount += row.scheduled_emi;
          }
        });
      });

      // Find next upcoming EMI
      let nextEMIDate: string | null = null;
      let nextEMIAmount = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (dueDate >= today) {
            if (!nextEMIDate || new Date(row.due_on) < new Date(nextEMIDate)) {
              nextEMIDate = row.due_on;
              nextEMIAmount = row.scheduled_emi;
            }
          }
        });
      });

      // High interest loans (>30%)
      const highInterestLoans = loansData.filter(l => l.interest_rate_apy > 30);
      let highInterestOutstanding = 0;
      highInterestLoans.forEach(loan => {
        const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
        highInterestOutstanding += outstanding.total;
      });

      // Loans closing in next 90 days
      const next90Days = addDays(today, 90);
      let closingLoansCount = 0;
      let closingEmiTotal = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        if (unpaidRows.length > 0) {
          const lastRow = unpaidRows.sort((a, b) => b.period_no - a.period_no)[0];
          const lastDueDate = new Date(lastRow.due_on);
          if (lastDueDate <= next90Days) {
            closingLoansCount++;
            closingEmiTotal += unpaidRows.reduce((sum, r) => sum + r.scheduled_emi, 0);
          }
        }
      });

      // Missed EMIs in last 6 months (rough estimate - unpaid rows with due_on in past 6 months)
      const sixMonthsAgo = subMonths(today, 6);
      let missedCount = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (isBefore(dueDate, today) && dueDate >= sixMonthsAgo) {
            missedCount++;
          }
        });
      });

      // Fetch income and expenses
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user.id)
        .single();

      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      const { data: transactions } = await supabase
        .from('transactions')
        .select('debit')
        .eq('user_id', user.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      const monthlyExpenses = transactions?.reduce((sum, txn) => sum + (txn.debit || 0), 0) || 0;

      // Build EMI calendar data
      const calendarItems: EMICalendarItem[] = [];
      loansData.forEach(loan => {
        const rows = loan.amortization_rows || [];
        rows.forEach(row => {
          const dueDate = new Date(row.due_on);
          let status: 'paid' | 'upcoming' | 'overdue' = 'upcoming';
          if (row.is_paid) {
            status = 'paid';
          } else if (isBefore(dueDate, today)) {
            status = 'overdue';
          }
          calendarItems.push({
            id: row.id,
            date: row.due_on,
            loanName: loan.loan_name,
            amount: row.scheduled_emi,
            status,
            loanId: loan.id,
          });
        });
      });
      setEmiCalendar(calendarItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

      // Calculate lender exposure
      const lenderMap = new Map<string, { name: string; outstanding: number }>();
      loansData.forEach(loan => {
        if (loan.lender_id) {
          const lender = lendersData?.find(l => l.id === loan.lender_id);
          const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
          const existing = lenderMap.get(loan.lender_id);
          if (existing) {
            existing.outstanding += outstanding.total;
          } else {
            lenderMap.set(loan.lender_id, {
              name: lender?.name || 'Unknown',
              outstanding: outstanding.total,
            });
          }
        }
      });
      const exposureData = Array.from(lenderMap.entries()).map(([id, data]) => ({
        lenderId: id,
        lenderName: data.name,
        outstanding: data.outstanding,
      })).sort((a, b) => b.outstanding - a.outstanding);
      setLenderExposure(exposureData);

      // Build alerts
      const alertsList: AlertItem[] = [];
      
      // Upcoming EMIs within 7 days
      const upcoming7 = calculateUpcoming7DaysEMI(loansData);
      if (upcoming7.payments.length > 0) {
        upcoming7.payments.forEach(p => {
          const daysUntil = differenceInDays(new Date(p.dueDate), today);
          alertsList.push({
            id: `upcoming-${p.loanId}-${p.dueDate}`,
            type: 'warning',
            title: `EMI Due: ${p.loanName}`,
            description: `${formatINR(p.amount)} due on ${format(new Date(p.dueDate), 'MMM d')}`,
            tag: daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`,
            route: `/loans/${p.loanId}`,
          });
        });
      }

      // Overdue EMIs
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (isBefore(dueDate, today)) {
            const daysOverdue = differenceInDays(today, dueDate);
            alertsList.push({
              id: `overdue-${loan.id}-${row.due_on}`,
              type: 'danger',
              title: `Overdue: ${loan.loan_name}`,
              description: `${formatINR(row.scheduled_emi)} was due on ${format(dueDate, 'MMM d')}`,
              tag: `Overdue by ${daysOverdue} days`,
              route: `/loans/${loan.id}`,
            });
          }
        });
      });

      // High EMI-to-income ratio
      const income = profile?.monthly_income || 0;
      if (income > 0 && thisMonth.total > 0) {
        const emiToIncomeRatio = (thisMonth.total / income) * 100;
        if (emiToIncomeRatio > 40) {
          alertsList.push({
            id: 'high-emi-ratio',
            type: 'warning',
            title: 'High EMI-to-Income Ratio',
            description: `Your EMIs are ${emiToIncomeRatio.toFixed(0)}% of your income (above 40% threshold)`,
            tag: 'Budget Alert',
            route: '/budget',
          });
        }
      }

      setAlerts(alertsList.slice(0, 10)); // Limit to 10 alerts

      setStats({
        totalOutstandingPrincipal,
        activeLoans: portfolioStats.activeLoansCount,
        thisMonthEMI: thisMonth.total,
        thisMonthEMICount: thisMonth.count,
        paidThisMonthCount,
        overdueCount,
        overdueAmount,
        nextEMIDate,
        nextEMIAmount,
        monthlyIncome: income,
        monthlyExpenses,
        highInterestLoans: { count: highInterestLoans.length, outstanding: highInterestOutstanding },
        closingIn90Days: { count: closingLoansCount, emiTotal: closingEmiTotal },
        missedLastSixMonths: missedCount,
      });

      setPayoffProgress(progress);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter EMI calendar based on selected tab
  const filteredEmiCalendar = useMemo(() => {
    const today = new Date();
    
    switch (calendarTab) {
      case 'week':
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        return emiCalendar.filter(item => {
          const date = new Date(item.date);
          return isWithinInterval(date, { start: weekStart, end: weekEnd });
        });
      case 'month':
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        return emiCalendar.filter(item => {
          const date = new Date(item.date);
          return isWithinInterval(date, { start: monthStart, end: monthEnd });
        });
      case 'all':
        return emiCalendar;
      default:
        return emiCalendar;
    }
  }, [emiCalendar, calendarTab]);

  // Calculate chart data for cash flow
  const cashFlowData = useMemo(() => [
    { name: 'Income', value: stats.monthlyIncome, fill: 'hsl(var(--success))' },
    { name: 'EMIs', value: stats.thisMonthEMI, fill: 'hsl(var(--primary))' },
    { name: 'Expenses', value: stats.monthlyExpenses, fill: 'hsl(var(--warning))' },
  ], [stats]);

  const lenderChartData = useMemo(() => 
    lenderExposure.slice(0, 6).map((l, i) => ({
      name: l.lenderName.length > 10 ? l.lenderName.slice(0, 10) + '...' : l.lenderName,
      value: l.outstanding,
      fill: `hsl(var(--chart-${(i % 5) + 1}))`,
    }))
  , [lenderExposure]);

  const totalLenderExposure = useMemo(() => 
    lenderExposure.reduce((sum, l) => sum + l.outstanding, 0)
  , [lenderExposure]);

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
      
      <div className="space-y-6 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Financial Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/loans/new")} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Add New Loan
            </Button>
            <Button onClick={() => navigate("/payments/new")} variant="outline" className="flex-1 sm:flex-none">
              <DollarSign className="mr-2 h-4 w-4" />
              Add Payment
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-20" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Section 1: Key Summary - 3 cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {/* Card 1: Total Outstanding Loans */}
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Active Loans: {stats.activeLoans}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total Outstanding Loans</p>
                <p className="text-3xl font-bold">{formatINR(stats.totalOutstandingPrincipal)}</p>
                <p className="text-xs text-muted-foreground mt-1">Principal still to pay</p>
              </Card>

              {/* Card 2: This Month's EMIs */}
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-chart-1/10">
                    <Calendar className="h-5 w-5 text-chart-1" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">This Month's EMIs</p>
                <p className="text-3xl font-bold">{formatINR(stats.thisMonthEMI)}</p>
                <p className="text-xs text-muted-foreground mt-2 mb-2">EMIs due this month</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Paid</span>
                    <span>{stats.paidThisMonthCount} / {stats.thisMonthEMICount}</span>
                  </div>
                  <Progress 
                    value={stats.thisMonthEMICount > 0 ? (stats.paidThisMonthCount / stats.thisMonthEMICount) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </Card>

              {/* Card 3: Overdue & Next EMI */}
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Overdue & Next EMI</p>
                <div className="space-y-3">
                  <div className={cn(stats.overdueCount > 0 ? "text-destructive" : "text-muted-foreground")}>
                    <p className="text-sm font-medium">
                      Overdue EMIs: {stats.overdueCount} {stats.overdueCount > 0 && `– ${formatINR(stats.overdueAmount)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Next EMI: </span>
                      {stats.nextEMIDate ? (
                        <span className="font-medium">
                          {format(new Date(stats.nextEMIDate), 'MMM d, yyyy')} – {formatINR(stats.nextEMIAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">None scheduled</span>
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Section 2: Loan Health & Cash Flow - 2 columns */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* Loan Risk Overview */}
              <Card className="p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Loan Risk Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-destructive/10">
                        <Zap className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">High-interest loans (&gt;30%)</p>
                        <p className="text-xs text-muted-foreground">Requires attention</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={stats.highInterestLoans.count > 0 ? "destructive" : "secondary"}>
                        {stats.highInterestLoans.count}
                      </Badge>
                      {stats.highInterestLoans.count > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatINR(stats.highInterestLoans.outstanding)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-success/10">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Closing in 90 days</p>
                        <p className="text-xs text-muted-foreground">Upcoming completions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{stats.closingIn90Days.count}</Badge>
                      {stats.closingIn90Days.count > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatINR(stats.closingIn90Days.emiTotal)} EMIs
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-warning/10">
                        <Ban className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Missed/bounced EMIs</p>
                        <p className="text-xs text-muted-foreground">Last 6 months</p>
                      </div>
                    </div>
                    <Badge variant={stats.missedLastSixMonths > 0 ? "destructive" : "secondary"}>
                      {stats.missedLastSixMonths}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* This Month's Cash Flow */}
              <Card className="p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    This Month's Cash Flow
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-success/10">
                      <p className="text-xs text-muted-foreground">Income</p>
                      <p className="text-lg font-bold text-success">{formatINR(stats.monthlyIncome)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-primary/10">
                      <p className="text-xs text-muted-foreground">EMIs</p>
                      <p className="text-lg font-bold text-primary">{formatINR(stats.thisMonthEMI)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-warning/10">
                      <p className="text-xs text-muted-foreground">Expenses</p>
                      <p className="text-lg font-bold text-warning">{formatINR(stats.monthlyExpenses)}</p>
                    </div>
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlowData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                        <RechartsTooltip 
                          formatter={(value: number) => formatINR(value)}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {cashFlowData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 3: EMI Calendar */}
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    EMI Calendar
                  </CardTitle>
                  <Tabs value={calendarTab} onValueChange={(v) => setCalendarTab(v as 'week' | 'month' | 'all')}>
                    <TabsList className="grid w-full sm:w-auto grid-cols-3">
                      <TabsTrigger value="week" className="text-xs sm:text-sm">This Week</TabsTrigger>
                      <TabsTrigger value="month" className="text-xs sm:text-sm">This Month</TabsTrigger>
                      <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredEmiCalendar.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No EMIs found for this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Loan Name</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">EMI Amount</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmiCalendar.slice(0, 10).map((item) => (
                          <tr 
                            key={item.id} 
                            className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/loans/${item.loanId}`)}
                          >
                            <td className="py-3 px-4 text-sm">
                              {format(new Date(item.date), 'MMM d, yyyy')}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium">
                              {item.loanName}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-mono">
                              {formatINR(item.amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant={
                                  item.status === 'paid' ? 'default' :
                                  item.status === 'overdue' ? 'destructive' : 'secondary'
                                }
                                className={cn(
                                  "text-xs",
                                  item.status === 'paid' && "bg-success hover:bg-success/80",
                                  item.status === 'upcoming' && "bg-warning/20 text-warning-foreground border-warning/50"
                                )}
                              >
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredEmiCalendar.length > 10 && (
                      <div className="text-center py-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate('/emi-calendar')}
                        >
                          View all {filteredEmiCalendar.length} EMIs
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 4: Lender Exposure & Loan Progress */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* Lender Exposure */}
              <Card className="p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-chart-2" />
                    Lender Exposure
                  </CardTitle>
                  <CardDescription>Outstanding by lender</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {lenderExposure.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No lender data available</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={lenderChartData}>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                            <RechartsTooltip 
                              formatter={(value: number) => formatINR(value)}
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {lenderChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Outstanding</span>
                          <span className="font-bold">{formatINR(totalLenderExposure)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Loan Closure Progress */}
              <Card className="p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    Loan Closure Progress
                  </CardTitle>
                  <CardDescription>Overall repayment progress</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{payoffProgress.progressPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={payoffProgress.progressPercent} className="h-3" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-lg bg-success/10">
                      <p className="text-xs text-muted-foreground">Paid so far</p>
                      <p className="text-xl font-bold text-success mt-1">
                        {formatINR(payoffProgress.paidPrincipal)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({payoffProgress.progressPercent.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <p className="text-xl font-bold mt-1">
                        {formatINR(payoffProgress.remainingPrincipal)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({(100 - payoffProgress.progressPercent).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 5: Alerts & Reminders */}
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-warning" />
                  Alerts & Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success opacity-70" />
                    <p className="text-sm">All caught up! No pending alerts.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          alert.type === 'danger' && "border-destructive/30 bg-destructive/5",
                          alert.type === 'warning' && "border-warning/30 bg-warning/5",
                          alert.type === 'info' && "border-primary/30 bg-primary/5"
                        )}
                        onClick={() => alert.route && navigate(alert.route)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            alert.type === 'danger' && "bg-destructive/10",
                            alert.type === 'warning' && "bg-warning/10",
                            alert.type === 'info' && "bg-primary/10"
                          )}>
                            {alert.type === 'danger' ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : alert.type === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            ) : (
                              <Bell className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className="text-xs text-muted-foreground">{alert.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.tag && (
                            <Badge 
                              variant={alert.type === 'danger' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {alert.tag}
                            </Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
