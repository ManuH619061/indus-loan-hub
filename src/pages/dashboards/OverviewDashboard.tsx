import { useEffect, useState, useMemo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  TrendingUp,
  AlertCircle,
  Calendar,
  Clock,
  Wallet,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Zap,
  CheckCircle2,
  Sparkles,
  CreditCard,
  Receipt,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, isBefore, isWithinInterval, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  fetchLoansWithAmortization,
  calculateThisMonthEMI,
  countOverdueEMIs,
  calculatePayoffProgress,
  calculateOutstandingFromAmortization,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardHeader, DashboardGrid, WidgetSettingsSheet } from "@/components/dashboard";

interface QuickAction {
  icon: typeof Plus;
  label: string;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { icon: Plus, label: "Add Loan", href: "/loans/new", color: "bg-blue-500" },
  { icon: CreditCard, label: "Record EMI", href: "/payments", color: "bg-green-500" },
  { icon: Receipt, label: "Add Expense", href: "/expenses", color: "bg-amber-500" },
  { icon: FileText, label: "Upload Doc", href: "/documents?action=upload", color: "bg-purple-500" },
];

const DEFAULT_WIDGETS = [
  { id: "ai-summary", title: "AI Summary" },
  { id: "quick-stats", title: "Quick Stats" },
  { id: "payoff-progress", title: "Loan Payoff Progress" },
  { id: "upcoming-emis", title: "Upcoming EMIs" },
  { id: "quick-actions", title: "Quick Actions" },
  { id: "overdue-alert", title: "Overdue Alert" },
  { id: "next-emi", title: "Next EMI Reminder" },
];

export default function OverviewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanWithAmortization[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    activeLoans: 0,
    thisMonthEMI: 0,
    paidThisMonth: 0,
    overdueCount: 0,
    overdueAmount: 0,
    progressPercent: 0,
    nextEMIDate: null as string | null,
    nextEMIAmount: 0,
    nextEMILoan: "",
  });
  const [aiSummary, setAiSummary] = useState("");

  const {
    widgets,
    visibleWidgets,
    hiddenCount,
    reorderWidgets,
    toggleWidget,
    showAll,
    hideAll,
    resetToDefault,
  } = useDashboardWidgets({
    dashboardId: "overview",
    defaultWidgets: DEFAULT_WIDGETS,
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const loansData = await fetchLoansWithAmortization(user.id);
      setLoans(loansData);

      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const thisMonth = calculateThisMonthEMI(loansData);
      const overdueCount = countOverdueEMIs(loansData);
      const progress = calculatePayoffProgress(loansData);

      let totalOutstanding = 0;
      loansData.forEach(loan => {
        const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
        totalOutstanding += outstanding.total;
      });

      let paidThisMonth = 0;
      loansData.forEach(loan => {
        loan.amortization_rows?.filter(r => r.is_paid).forEach(row => {
          const dueDate = new Date(row.due_on);
          if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
            paidThisMonth++;
          }
        });
      });

      let overdueAmount = 0;
      loansData.forEach(loan => {
        loan.amortization_rows?.filter(r => !r.is_paid).forEach(row => {
          if (isBefore(new Date(row.due_on), today)) {
            overdueAmount += row.scheduled_emi;
          }
        });
      });

      let nextEMIDate: string | null = null;
      let nextEMIAmount = 0;
      let nextEMILoan = "";
      loansData.forEach(loan => {
        loan.amortization_rows?.filter(r => !r.is_paid).forEach(row => {
          const dueDate = new Date(row.due_on);
          if (dueDate >= today && (!nextEMIDate || dueDate < new Date(nextEMIDate))) {
            nextEMIDate = row.due_on;
            nextEMIAmount = row.scheduled_emi;
            nextEMILoan = loan.loan_name;
          }
        });
      });

      setStats({
        totalOutstanding,
        activeLoans: loansData.filter(l => l.status === "ACTIVE").length,
        thisMonthEMI: thisMonth.total,
        paidThisMonth,
        overdueCount,
        overdueAmount,
        progressPercent: progress.progressPercent,
        nextEMIDate,
        nextEMIAmount,
        nextEMILoan,
      });

      generateAISummary(loansData, totalOutstanding, thisMonth.total, overdueCount, progress.progressPercent);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const generateAISummary = (
    loans: LoanWithAmortization[],
    outstanding: number,
    monthlyEMI: number,
    overdue: number,
    progress: number
  ) => {
    let summary = "";
    
    if (loans.length === 0) {
      summary = "No active loans found. Add your first loan to start tracking your debt journey.";
    } else if (overdue > 0) {
      summary = `⚠️ You have ${overdue} overdue EMI${overdue > 1 ? 's' : ''}. Please prioritize clearing these to avoid penalties. Your total outstanding is ${formatINR(outstanding)}.`;
    } else if (progress > 50) {
      summary = `🎉 Great progress! You've paid off ${progress.toFixed(0)}% of your total debt. Keep up the momentum with your ${formatINR(monthlyEMI)} monthly EMI.`;
    } else {
      summary = `Your portfolio has ${loans.length} active loan${loans.length > 1 ? 's' : ''} with ${formatINR(outstanding)} outstanding. This month's EMI is ${formatINR(monthlyEMI)}.`;
    }
    
    setAiSummary(summary);
  };

  const upcomingEMIs = useMemo(() => {
    const today = new Date();
    const next7Days = addDays(today, 7);
    const emis: { loanName: string; amount: number; dueDate: string; loanId: string }[] = [];
    
    loans.forEach(loan => {
      loan.amortization_rows?.filter(r => !r.is_paid).forEach(row => {
        const dueDate = new Date(row.due_on);
        if (dueDate >= today && dueDate <= next7Days) {
          emis.push({
            loanName: loan.loan_name,
            amount: row.scheduled_emi,
            dueDate: row.due_on,
            loanId: loan.id,
          });
        }
      });
    });
    
    return emis.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [loans]);

  const renderWidget = (widgetId: string): ReactNode => {
    switch (widgetId) {
      case "ai-summary":
        return (
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">AI Summary</p>
                <p className="text-sm text-foreground/80">{aiSummary}</p>
              </div>
            </CardContent>
          </Card>
        );

      case "quick-stats":
        return (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Wallet className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-bold truncate">{formatINR(stats.totalOutstanding)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">This Month EMI</p>
                    <p className="text-lg font-bold truncate">{formatINR(stats.thisMonthEMI)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn("hover:shadow-md transition-shadow", stats.overdueCount > 0 && "border-destructive/50")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", stats.overdueCount > 0 ? "bg-destructive/10" : "bg-amber-500/10")}>
                    {stats.overdueCount > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {stats.overdueCount > 0 ? "Overdue" : "Paid This Month"}
                    </p>
                    <p className="text-lg font-bold">
                      {stats.overdueCount > 0 ? stats.overdueCount : stats.paidThisMonth}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Active Loans</p>
                    <p className="text-lg font-bold">{stats.activeLoans}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "payoff-progress":
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Loan Payoff Progress</CardTitle>
              <CardDescription>Overall debt repayment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{stats.progressPercent.toFixed(1)}%</span>
                </div>
                <Progress value={stats.progressPercent} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Paid</span>
                  <span>Remaining: {formatINR(stats.totalOutstanding)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "upcoming-emis":
        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Upcoming EMIs</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/emi-calendar")}>
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingEMIs.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEMIs.slice(0, 4).map((emi, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/loans/${emi.loanId}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{emi.loanName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(emi.dueDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="secondary">{formatINR(emi.amount)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">No upcoming EMIs this week</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "quick-actions":
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => navigate(action.href)}
                  >
                    <div className={cn("p-2 rounded-lg", action.color)}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "overdue-alert":
        if (stats.overdueCount === 0) return null;
        return (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-sm">Overdue Payments</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.overdueCount} payment{stats.overdueCount > 1 ? 's' : ''} overdue totaling {formatINR(stats.overdueAmount)}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => navigate("/payments")}>
                Pay Now <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        );

      case "next-emi":
        if (!stats.nextEMIDate) return null;
        return (
          <Card className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Next EMI: {stats.nextEMILoan}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(stats.nextEMIDate), "MMM d")} • {formatINR(stats.nextEMIAmount)}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate("/payments")}>
                Pay <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <DashboardHeader
        title="Overview"
        description="Your financial snapshot at a glance"
        isEditMode={isEditMode}
        hiddenCount={hiddenCount}
        onEditModeToggle={() => setIsEditMode(!isEditMode)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onExport={() => toast.info("Export coming soon")}
      />

      <DashboardGrid
        widgets={widgets}
        isEditMode={isEditMode}
        onReorder={reorderWidgets}
        onHideWidget={toggleWidget}
        renderWidget={renderWidget}
      />

      <WidgetSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        widgets={widgets}
        onToggle={toggleWidget}
        onReorder={reorderWidgets}
        onShowAll={showAll}
        onHideAll={hideAll}
        onReset={resetToDefault}
      />
    </div>
  );
}
