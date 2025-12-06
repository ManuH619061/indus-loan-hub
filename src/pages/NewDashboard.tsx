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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  Calendar,
  Clock,
  Wallet,
  AlertTriangle,
  DollarSign,
  Building2,
  ChevronRight,
  ArrowRight,
  Bell,
  Zap,
  Ban,
  CheckCircle2,
  Download,
  Moon,
  Sun,
  PieChart,
  BarChart3,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { exportDashboardToPDF } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LineChart, Line, ComposedChart, Legend } from 'recharts';
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
  nextEMILoanId: string | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  highInterestLoans: { count: number; outstanding: number };
  closingIn90Days: { count: number; emiTotal: number };
  missedLastSixMonths: number;
  emiToIncomeRatio: number;
  budgetExceeded: boolean;
  budgetAmount: number;
}

interface EMICalendarItem {
  id: string;
  date: string;
  loanName: string;
  amount: number;
  status: 'paid' | 'upcoming' | 'overdue';
  loanId: string;
  paymentId?: string;
}

interface LenderExposure {
  lenderId: string;
  lenderName: string;
  outstanding: number;
  loanIds: string[];
}

interface AlertItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  tag?: string;
  route?: string;
  entityType?: 'payment' | 'loan' | 'budget';
  entityId?: string;
}

interface MonthlyEMITrend {
  month: string;
  monthKey: string;
  emiPaid: number;
  income: number;
}

export default function NewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isNewUser, isLoading: onboardingLoading, refreshStatus } = useOnboardingStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
    nextEMILoanId: null,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    highInterestLoans: { count: 0, outstanding: 0 },
    closingIn90Days: { count: 0, emiTotal: 0 },
    missedLastSixMonths: 0,
    emiToIncomeRatio: 0,
    budgetExceeded: false,
    budgetAmount: 0,
  });
  const [emiCalendar, setEmiCalendar] = useState<EMICalendarItem[]>([]);
  const [lenderExposure, setLenderExposure] = useState<LenderExposure[]>([]);
  const [payoffProgress, setPayoffProgress] = useState({
    totalPrincipal: 0,
    paidPrincipal: 0,
    remainingPrincipal: 0,
    progressPercent: 0,
    avgMonthsRemaining: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [calendarTab, setCalendarTab] = useState<'week' | 'month' | 'all'>('month');
  const [emiTrend, setEmiTrend] = useState<MonthlyEMITrend[]>([]);

  // Export dashboard to PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const fileName = exportDashboardToPDF({
        ...stats,
        payoffProgress,
        lenderExposure,
        alerts: alerts.map(a => ({ title: a.title, description: a.description, tag: a.tag })),
      });
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
      let nextEMILoanId: string | null = null;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (dueDate >= today) {
            if (!nextEMIDate || new Date(row.due_on) < new Date(nextEMIDate)) {
              nextEMIDate = row.due_on;
              nextEMIAmount = row.scheduled_emi;
              nextEMILoanId = loan.id;
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

      // Missed EMIs in last 6 months
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

      // Fetch budget data
      const currentMonthYear = format(today, 'yyyy-MM');
      const { data: budgetData } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonthYear)
        .single();

      const budgetAmount = budgetData ? 
        (budgetData.salary || 0) + (budgetData.side_income || 0) + (budgetData.other_income || 0) : 0;
      
      const totalExpensesWithEMI = monthlyExpenses + thisMonth.total;
      const budgetExceeded = budgetAmount > 0 && totalExpensesWithEMI > budgetAmount;

      // Calculate EMI to Income ratio
      const income = profile?.monthly_income || 0;
      const emiToIncomeRatio = income > 0 ? (thisMonth.total / income) * 100 : 0;

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

      // Calculate lender exposure with loan IDs for drill-down
      const lenderMap = new Map<string, { name: string; outstanding: number; loanIds: string[] }>();
      loansData.forEach(loan => {
        if (loan.lender_id) {
          const lender = lendersData?.find(l => l.id === loan.lender_id);
          const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
          const existing = lenderMap.get(loan.lender_id);
          if (existing) {
            existing.outstanding += outstanding.total;
            existing.loanIds.push(loan.id);
          } else {
            lenderMap.set(loan.lender_id, {
              name: lender?.name || 'Unknown',
              outstanding: outstanding.total,
              loanIds: [loan.id],
            });
          }
        }
      });
      const exposureData = Array.from(lenderMap.entries()).map(([id, data]) => ({
        lenderId: id,
        lenderName: data.name,
        outstanding: data.outstanding,
        loanIds: data.loanIds,
      })).sort((a, b) => b.outstanding - a.outstanding);
      setLenderExposure(exposureData);

      // Calculate EMI trend for last 6 months
      const trendData: MonthlyEMITrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        
        let emiPaidThisMonth = 0;
        loansData.forEach(loan => {
          const paidRows = loan.amortization_rows?.filter(r => r.is_paid) || [];
          paidRows.forEach(row => {
            const dueDate = new Date(row.due_on);
            if (isWithinInterval(dueDate, { start: mStart, end: mEnd })) {
              emiPaidThisMonth += row.scheduled_emi;
            }
          });
        });

        trendData.push({
          month: format(monthDate, 'MMM'),
          monthKey: format(monthDate, 'yyyy-MM'),
          emiPaid: emiPaidThisMonth,
          income: income, // Using current income as approximation
        });
      }
      setEmiTrend(trendData);

      // Calculate average months remaining
      let totalMonthsRemaining = 0;
      let loanCountWithMonths = 0;
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        if (unpaidRows.length > 0) {
          totalMonthsRemaining += unpaidRows.length;
          loanCountWithMonths++;
        }
      });
      const avgMonthsRemaining = loanCountWithMonths > 0 ? Math.round(totalMonthsRemaining / loanCountWithMonths) : 0;

      // Build alerts with 3-day window
      const alertsList: AlertItem[] = [];
      
      // EMIs due in next 3 days
      const next3Days = addDays(today, 3);
      loansData.forEach(loan => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        unpaidRows.forEach(row => {
          const dueDate = new Date(row.due_on);
          if (dueDate >= today && dueDate <= next3Days) {
            const daysUntil = differenceInDays(dueDate, today);
            alertsList.push({
              id: `upcoming-${loan.id}-${row.due_on}`,
              type: 'warning',
              title: `EMI Due: ${loan.loan_name}`,
              description: `${formatINR(row.scheduled_emi)} due on ${format(dueDate, 'MMM d')}`,
              tag: daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`,
              route: `/loans/${loan.id}`,
              entityType: 'loan',
              entityId: loan.id,
            });
          }
        });
      });

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
              entityType: 'loan',
              entityId: loan.id,
            });
          }
        });
      });

      // High-interest loan alerts
      if (highInterestLoans.length > 0) {
        highInterestLoans.slice(0, 2).forEach(loan => {
          alertsList.push({
            id: `high-interest-${loan.id}`,
            type: 'warning',
            title: `High Interest: ${loan.loan_name}`,
            description: `${loan.interest_rate_apy}% APY - consider refinancing`,
            tag: 'High Rate',
            route: `/loans/${loan.id}`,
            entityType: 'loan',
            entityId: loan.id,
          });
        });
      }

      // Budget exceeded alert
      if (budgetExceeded) {
        alertsList.push({
          id: 'budget-exceeded',
          type: 'danger',
          title: 'Budget Exceeded',
          description: `Total expenses (${formatINR(totalExpensesWithEMI)}) exceed budget (${formatINR(budgetAmount)})`,
          tag: 'Over Budget',
          route: '/budget',
          entityType: 'budget',
        });
      }

      // High EMI-to-income ratio
      if (emiToIncomeRatio > 40) {
        alertsList.push({
          id: 'high-emi-ratio',
          type: emiToIncomeRatio > 60 ? 'danger' : 'warning',
          title: 'High EMI-to-Income Ratio',
          description: `Your EMIs are ${emiToIncomeRatio.toFixed(0)}% of your income`,
          tag: emiToIncomeRatio > 60 ? 'Critical' : 'Warning',
          route: '/budget',
          entityType: 'budget',
        });
      }

      setAlerts(alertsList.slice(0, 10));

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
        nextEMILoanId,
        monthlyIncome: income,
        monthlyExpenses,
        highInterestLoans: { count: highInterestLoans.length, outstanding: highInterestOutstanding },
        closingIn90Days: { count: closingLoansCount, emiTotal: closingEmiTotal },
        missedLastSixMonths: missedCount,
        emiToIncomeRatio,
        budgetExceeded,
        budgetAmount,
      });

      setPayoffProgress({
        ...progress,
        avgMonthsRemaining,
      });
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

  // Lender chart data with click handlers
  const lenderChartData = useMemo(() => 
    lenderExposure.slice(0, 5).map((l, i) => ({
      name: l.lenderName.length > 10 ? l.lenderName.slice(0, 10) + '...' : l.lenderName,
      fullName: l.lenderName,
      value: l.outstanding,
      lenderId: l.lenderId,
      fill: `hsl(var(--chart-${(i % 5) + 1}))`,
    }))
  , [lenderExposure]);

  const totalLenderExposure = useMemo(() => 
    lenderExposure.reduce((sum, l) => sum + l.outstanding, 0)
  , [lenderExposure]);

  // EMI Burden ratio color
  const getRatioColor = (ratio: number) => {
    if (ratio < 40) return 'text-success';
    if (ratio < 60) return 'text-warning';
    return 'text-destructive';
  };

  const getRatioLabel = (ratio: number) => {
    if (ratio < 40) return 'Safe';
    if (ratio < 60) return 'Warning';
    return 'Risky';
  };

  // Handle lender bar click
  const handleLenderBarClick = (data: any) => {
    if (data?.lenderId) {
      navigate(`/lenders/${data.lenderId}`);
    }
  };

  // Handle EMI trend bar click
  const handleTrendBarClick = (data: any) => {
    if (data?.monthKey) {
      navigate(`/payments?month=${data.monthKey}`);
    }
  };

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-16">
      <div className="p-4 rounded-full bg-primary/10 inline-block mb-4">
        <Wallet className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No loans yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Start tracking your loans and EMIs to see your financial dashboard come to life.
      </p>
      <Button onClick={() => navigate('/loans/new')}>
        <Plus className="mr-2 h-4 w-4" />
        Add Your First Loan
      </Button>
    </div>
  );

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
      
      <div className="space-y-6 max-w-[1440px] mx-auto px-1 sm:px-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Financial Dashboard</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleExportPDF}
                  disabled={exporting || loading}
                  className="h-9 w-9"
                >
                  <Download className={cn("h-4 w-4", exporting && "animate-pulse")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Dashboard as PDF</TooltipContent>
            </Tooltip>

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
        ) : stats.activeLoans === 0 ? (
          <Card className="border-border/50">
            <EmptyState />
          </Card>
        ) : (
          <>
            {/* Section 1: Key Summary - 3 clickable cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {/* Card 1: Total Outstanding Loans */}
              <Card 
                className="p-6 border-border/50 bg-card hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate('/loans?status=active')}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 transition-colors">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-medium">
                      Active: {stats.activeLoans}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total Outstanding Loans</p>
                <p className="text-3xl font-bold tracking-tight">{formatINR(stats.totalOutstandingPrincipal)}</p>
                <p className="text-xs text-muted-foreground mt-2">Principal still to pay</p>
              </Card>

              {/* Card 2: This Month's EMIs */}
              <Card 
                className="p-6 border-border/50 bg-card hover:shadow-lg hover:border-chart-1/30 transition-all cursor-pointer group"
                onClick={() => navigate('/payments?scope=this-month')}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-chart-1/10 dark:bg-chart-1/20 group-hover:bg-chart-1/20 transition-colors">
                    <Calendar className="h-5 w-5 text-chart-1" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-chart-1 transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">This Month's EMIs</p>
                <p className="text-3xl font-bold tracking-tight">{formatINR(stats.thisMonthEMI)}</p>
                <p className="text-xs text-muted-foreground mt-2 mb-3">EMIs due this month</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Paid</span>
                    <span className="font-medium">{stats.paidThisMonthCount} / {stats.thisMonthEMICount}</span>
                  </div>
                  <Progress 
                    value={stats.thisMonthEMICount > 0 ? (stats.paidThisMonthCount / stats.thisMonthEMICount) * 100 : 0} 
                    className="h-2.5"
                  />
                </div>
              </Card>

              {/* Card 3: Overdue & Next EMI */}
              <Card 
                className="p-6 border-border/50 bg-card hover:shadow-lg hover:border-warning/30 transition-all cursor-pointer group"
                onClick={() => navigate(stats.overdueCount > 0 ? '/payments?filter=overdue' : '/payments?filter=upcoming')}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-warning/10 dark:bg-warning/20 group-hover:bg-warning/20 transition-colors">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-warning transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">Overdue & Next EMI</p>
                <div className="space-y-3">
                  <div className={cn(
                    "p-3 rounded-lg",
                    stats.overdueCount > 0 
                      ? "bg-destructive/10 dark:bg-destructive/20 border border-destructive/20" 
                      : "bg-muted/50"
                  )}>
                    <p className={cn(
                      "text-sm font-medium",
                      stats.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      Overdue: {stats.overdueCount} {stats.overdueCount > 0 && `– ${formatINR(stats.overdueAmount)}`}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Next EMI</p>
                    {stats.nextEMIDate ? (
                      <p className="text-sm font-semibold">
                        {format(new Date(stats.nextEMIDate), 'MMM d')} – {formatINR(stats.nextEMIAmount)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">None scheduled</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Section 2: Health & Insights - 2 columns */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* Loan Risk Overview - Each metric clickable */}
              <Card className="p-6 border-border/50 bg-card">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-warning/10 dark:bg-warning/20">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    </div>
                    Loan Risk Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-3">
                  {/* High-interest loans metric */}
                  <div 
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/50 hover:bg-muted/60 dark:hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate('/loans?filter=high-interest')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-destructive/10 dark:bg-destructive/20">
                        <Zap className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">High-interest loans (&gt;30%)</p>
                        <p className="text-xs text-muted-foreground">Requires attention</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <Badge variant={stats.highInterestLoans.count > 0 ? "destructive" : "secondary"} className="font-semibold">
                          {stats.highInterestLoans.count}
                        </Badge>
                        {stats.highInterestLoans.count > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {formatINR(stats.highInterestLoans.outstanding)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                    </div>
                  </div>

                  {/* Closing in 90 days metric */}
                  <div 
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/50 hover:bg-muted/60 dark:hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate('/loans?filter=closing-soon')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10 dark:bg-success/20">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Closing in 90 days</p>
                        <p className="text-xs text-muted-foreground">Upcoming completions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <Badge variant="secondary" className="font-semibold">{stats.closingIn90Days.count}</Badge>
                        {stats.closingIn90Days.count > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {formatINR(stats.closingIn90Days.emiTotal)} EMIs
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-success transition-colors" />
                    </div>
                  </div>

                  {/* Missed EMIs metric */}
                  <div 
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/50 hover:bg-muted/60 dark:hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate('/payments?filter=missed')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10 dark:bg-warning/20">
                        <Ban className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Missed/bounced EMIs</p>
                        <p className="text-xs text-muted-foreground">Last 6 months</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={stats.missedLastSixMonths > 0 ? "destructive" : "secondary"} className="font-semibold">
                        {stats.missedLastSixMonths}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-warning transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EMI Burden & Income Ratio - Clickable */}
              <Card 
                className="p-6 border-border/50 bg-card hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => navigate('/budget')}
              >
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-chart-2/10 dark:bg-chart-2/20">
                        <PieChart className="h-4 w-4 text-chart-2" />
                      </div>
                      EMI Burden & Income Ratio
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-chart-2 transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="text-center p-4 rounded-xl bg-success/10 dark:bg-success/15 border border-success/20">
                      <p className="text-xs text-muted-foreground mb-1">Income</p>
                      <p className="text-lg font-bold text-success">{formatINR(stats.monthlyIncome)}</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">EMIs</p>
                      <p className="text-lg font-bold text-primary">{formatINR(stats.thisMonthEMI)}</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-warning/10 dark:bg-warning/15 border border-warning/20">
                      <p className="text-xs text-muted-foreground mb-1">Ratio</p>
                      <p className={cn("text-lg font-bold", getRatioColor(stats.emiToIncomeRatio))}>
                        {stats.emiToIncomeRatio.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  
                  {/* EMI to Income Gauge */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">EMI to Income Ratio</span>
                      <Badge 
                        variant={stats.emiToIncomeRatio > 60 ? 'destructive' : stats.emiToIncomeRatio > 40 ? 'secondary' : 'default'}
                        className={cn(stats.emiToIncomeRatio < 40 && "bg-success hover:bg-success/80")}
                      >
                        {getRatioLabel(stats.emiToIncomeRatio)}
                      </Badge>
                    </div>
                    <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          stats.emiToIncomeRatio < 40 ? "bg-success" :
                          stats.emiToIncomeRatio < 60 ? "bg-warning" : "bg-destructive"
                        )}
                        style={{ width: `${Math.min(stats.emiToIncomeRatio, 100)}%` }}
                      />
                      {/* Threshold markers */}
                      <div className="absolute top-0 left-[40%] w-px h-full bg-muted-foreground/30" />
                      <div className="absolute top-0 left-[60%] w-px h-full bg-muted-foreground/30" />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0%</span>
                      <span>40%</span>
                      <span>60%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 3: EMI Calendar - Clickable rows */}
            <Card className="p-6 border-border/50 bg-card">
              <CardHeader className="p-0 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div 
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => navigate('/payments')}
                  >
                    <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 transition-colors">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      EMI Calendar
                    </CardTitle>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <Tabs value={calendarTab} onValueChange={(v) => setCalendarTab(v as 'week' | 'month' | 'all')}>
                    <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-muted/50 dark:bg-muted/30">
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
                            className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => navigate(`/loans/${item.loanId}`)}
                          >
                            <td className="py-3 px-4 text-sm">
                              {format(new Date(item.date), 'MMM d, yyyy')}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium group-hover:text-primary transition-colors">
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
                      <div className="text-center py-3 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate('/payments')}
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

            {/* Section 4: Trends & Lenders - Charts with click handlers */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* EMI Trend (Last 6 Months) - Clickable bars */}
              <Card className="p-6 border-border/50 bg-card">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-chart-3/10 dark:bg-chart-3/20">
                      <BarChart3 className="h-4 w-4 text-chart-3" />
                    </div>
                    EMI Trend (Last 6 Months)
                  </CardTitle>
                  <CardDescription>Click on a bar to view that month's payments</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {emiTrend.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No trend data available</p>
                    </div>
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={emiTrend}>
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis 
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                          />
                          <RechartsTooltip 
                            formatter={(value: number, name: string) => [formatINR(value), name === 'emiPaid' ? 'EMIs Paid' : 'Income']}
                            contentStyle={{ 
                              background: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Legend />
                          <Bar 
                            dataKey="emiPaid" 
                            name="EMIs Paid"
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                            cursor="pointer"
                            onClick={(data) => handleTrendBarClick(data)}
                          />
                          {stats.monthlyIncome > 0 && (
                            <Line 
                              type="monotone" 
                              dataKey="income" 
                              name="Income"
                              stroke="hsl(var(--success))" 
                              strokeWidth={2}
                              dot={{ fill: 'hsl(var(--success))', r: 4 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lender Exposure - Clickable bars with drill-down */}
              <Card className="p-6 border-border/50 bg-card">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-chart-2/10 dark:bg-chart-2/20">
                          <Building2 className="h-4 w-4 text-chart-2" />
                        </div>
                        Lender Exposure
                      </CardTitle>
                      <CardDescription>Click on a bar to view lender details</CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate('/lenders')}
                      className="text-xs"
                    >
                      View all
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
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
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                            <RechartsTooltip 
                              formatter={(value: number) => formatINR(value)}
                              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                              contentStyle={{ 
                                background: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar 
                              dataKey="value" 
                              radius={[6, 6, 0, 0]} 
                              cursor="pointer"
                              onClick={(data) => handleLenderBarClick(data)}
                            >
                              {lenderChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Outstanding</span>
                          <span className="font-bold text-lg">{formatINR(totalLenderExposure)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Section 5: Loan Closure Progress - Clickable */}
            <Card 
              className="p-6 border-border/50 bg-card hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate('/reports/payoff')}
            >
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-success/10 dark:bg-success/20 group-hover:bg-success/20 transition-colors">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                      Loan Closure Progress
                    </CardTitle>
                    <CardDescription>Overall repayment progress</CardDescription>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-success transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="p-0 space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-lg">{payoffProgress.progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={payoffProgress.progressPercent} className="h-4" />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-primary-foreground"
                      style={{ left: `calc(${Math.min(payoffProgress.progressPercent, 90)}% + 4px)` }}
                    >
                      {payoffProgress.progressPercent > 10 && `${payoffProgress.progressPercent.toFixed(0)}%`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-success/10 dark:bg-success/15 border border-success/20">
                    <p className="text-xs text-muted-foreground mb-1">Paid so far</p>
                    <p className="text-xl font-bold text-success">
                      {formatINR(payoffProgress.paidPrincipal)}
                    </p>
                    <p className="text-xs text-success/80 mt-1 font-medium">
                      {payoffProgress.progressPercent.toFixed(1)}% complete
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                    <p className="text-xl font-bold">
                      {formatINR(payoffProgress.remainingPrincipal)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {(100 - payoffProgress.progressPercent).toFixed(1)}% to go
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Avg. Months Left</p>
                    <p className="text-xl font-bold text-primary">
                      {payoffProgress.avgMonthsRemaining}
                    </p>
                    <p className="text-xs text-primary/80 mt-1 font-medium">
                      ~{Math.ceil(payoffProgress.avgMonthsRemaining / 12)} years
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Alerts & Reminders - Each item clickable */}
            <Card className="p-6 border-border/50 bg-card">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-warning/10 dark:bg-warning/20">
                    <Bell className="h-4 w-4 text-warning" />
                  </div>
                  Alerts & Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {alerts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="p-4 rounded-full bg-success/10 dark:bg-success/20 inline-block mb-3">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <p className="text-sm font-medium">All caught up!</p>
                    <p className="text-xs text-muted-foreground mt-1">No pending alerts or reminders.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md",
                          alert.type === 'danger' && "border-destructive/30 bg-destructive/5 dark:bg-destructive/10 hover:border-destructive/50",
                          alert.type === 'warning' && "border-warning/30 bg-warning/5 dark:bg-warning/10 hover:border-warning/50",
                          alert.type === 'info' && "border-primary/30 bg-primary/5 dark:bg-primary/10 hover:border-primary/50"
                        )}
                        onClick={() => alert.route && navigate(alert.route)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2.5 rounded-xl",
                            alert.type === 'danger' && "bg-destructive/10 dark:bg-destructive/20",
                            alert.type === 'warning' && "bg-warning/10 dark:bg-warning/20",
                            alert.type === 'info' && "bg-primary/10 dark:bg-primary/20"
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
                            <p className="text-sm font-semibold">{alert.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {alert.tag && (
                            <Badge 
                              variant={alert.type === 'danger' ? 'destructive' : 'secondary'}
                              className="text-xs font-medium"
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
