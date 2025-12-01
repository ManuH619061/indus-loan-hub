import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  Wallet, TrendingUp, AlertCircle, Plus, Calendar, 
  Target, ArrowRight 
} from "lucide-react";
import { format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import FadeInStagger, { FadeInStaggerItem } from "@/components/FadeInStagger";
import {
  fetchLoansWithAmortization,
  calculatePortfolioStatsFromAmortization,
  calculateNext30DaysEMI,
  calculate6MonthProjection,
  countOverdueEMIs,
  calculatePayoffProgress,
  LoanWithAmortization,
} from "@/lib/portfolio-stats";

interface DashboardStats {
  totalOutstanding: number;
  upcomingEMI: number;
  upcomingEMICount: number;
  avgInterestRate: number;
  activeLoans: number;
  overdueCount: number;
}

interface RiskAlert {
  type: "warning" | "error";
  message: string;
}

export default function NewDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOutstanding: 0,
    upcomingEMI: 0,
    upcomingEMICount: 0,
    avgInterestRate: 0,
    activeLoans: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingEMIs, setUpcomingEMIs] = useState<any[]>([]);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [payoffProgress, setPayoffProgress] = useState({ paid: 0, remaining: 0 });

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Subscribe to real-time changes
      const channel = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amortization_rows' }, () => fetchDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchDashboardData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;

      // Fetch loans with amortization using shared function
      const loans = await fetchLoansWithAmortization(user.id);

      if (!loans || loans.length === 0) {
        setStats({
          totalOutstanding: 0,
          upcomingEMI: 0,
          upcomingEMICount: 0,
          avgInterestRate: 0,
          activeLoans: 0,
          overdueCount: 0,
        });
        setUpcomingEMIs([]);
        setProjectionData([]);
        setRiskAlerts([]);
        setPayoffProgress({ paid: 0, remaining: 0 });
        setLoading(false);
        return;
      }

      const today = new Date();

      // Calculate portfolio stats using shared logic
      const portfolioStats = calculatePortfolioStatsFromAmortization(loans);

      // Calculate next 30 days EMI using shared logic
      const next30Days = calculateNext30DaysEMI(loans, today);

      // Calculate 6-month projection using shared logic
      const projections = calculate6MonthProjection(loans, today);

      // Count overdue EMIs using shared logic
      const overdueCount = countOverdueEMIs(loans, today);

      // Calculate payoff progress using shared logic
      const payoff = calculatePayoffProgress(loans);

      // Generate risk alerts
      const alerts: RiskAlert[] = generateRiskAlerts(loans, portfolioStats);

      setStats({
        totalOutstanding: portfolioStats.totalOutstanding,
        upcomingEMI: next30Days.total,
        upcomingEMICount: next30Days.count,
        avgInterestRate: portfolioStats.avgInterestRate,
        activeLoans: portfolioStats.activeLoansCount,
        overdueCount,
      });

      setUpcomingEMIs(next30Days.payments);
      setProjectionData(projections);
      setRiskAlerts(alerts.slice(0, 3));
      setPayoffProgress({ paid: payoff.paidPrincipal, remaining: payoff.remainingPrincipal });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRiskAlerts = (loans: LoanWithAmortization[], portfolioStats: any): RiskAlert[] => {
    const alerts: RiskAlert[] = [];

    loans.forEach(loan => {
      // Check for high outstanding (>80% of principal remaining)
      const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
      const remainingPrincipal = unpaidRows.reduce((sum, row) => sum + row.principal_component, 0);
      
      if (remainingPrincipal > loan.principal_amount * 0.8) {
        alerts.push({
          type: "warning",
          message: `${loan.loan_name} has high outstanding balance (${formatPercent((remainingPrincipal / loan.principal_amount) * 100, 0)} of principal)`,
        });
      }

      // Check for high interest rate
      if (loan.interest_rate_apy > 18) {
        alerts.push({
          type: "error",
          message: `${loan.loan_name} has high interest rate (${formatPercent(loan.interest_rate_apy, 1)})`,
        });
      }
    });

    return alerts;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalProgress = payoffProgress.paid + payoffProgress.remaining;
  const progressPercent = totalProgress > 0 ? (payoffProgress.paid / totalProgress) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your complete loan portfolio overview</p>
        </div>
        <Link to="/loans/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Loan
          </Button>
        </Link>
      </div>

      {/* Key Metrics */}
      <FadeInStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FadeInStaggerItem>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(stats.totalOutstanding)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {stats.activeLoans} active {stats.activeLoans === 1 ? 'loan' : 'loans'}
              </p>
            </CardContent>
          </Card>
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Next 30 Days EMI</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(stats.upcomingEMI)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.upcomingEMICount} payment{stats.upcomingEMICount !== 1 ? 's' : ''} due
              </p>
            </CardContent>
          </Card>
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Interest Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercent(stats.avgInterestRate, 1)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Weighted average
              </p>
            </CardContent>
          </Card>
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertCircle className={`h-4 w-4 ${stats.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdueCount + riskAlerts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.overdueCount} overdue, {riskAlerts.length} warnings
              </p>
            </CardContent>
          </Card>
        </FadeInStaggerItem>
      </FadeInStagger>

      {/* Payoff Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Overall Payoff Progress</CardTitle>
            <Target className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-muted-foreground">Paid</p>
              <p className="font-semibold">{formatINR(payoffProgress.paid)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-semibold">{formatINR(payoffProgress.remaining)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPercent(progressPercent, 1)} of total principal paid off
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming EMIs */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming EMIs (Next 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEMIs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No EMIs due in the next 30 days
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingEMIs.slice(0, 5).map((emi, idx) => (
                  <Link 
                    key={idx} 
                    to={`/loans/${emi.loanId}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{emi.loanName}</p>
                      <p className="text-xs text-muted-foreground">{emi.lenderName}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(emi.dueDate), "MMM d")} • {emi.daysUntilDue} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatINR(emi.amount)}</p>
                    </div>
                  </Link>
                ))}
                {upcomingEMIs.length > 5 && (
                  <Link to="/payments">
                    <Button variant="ghost" className="w-full gap-2">
                      View all {upcomingEMIs.length} payments <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Risk & Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.overdueCount === 0 && riskAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No alerts. All payments are on track!
              </p>
            ) : (
              <div className="space-y-3">
                {stats.overdueCount > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{stats.overdueCount} overdue payment{stats.overdueCount !== 1 ? 's' : ''}</strong>
                      {' '}Need immediate attention
                    </AlertDescription>
                  </Alert>
                )}
                {riskAlerts.map((alert, idx) => (
                  <Alert key={idx} variant={alert.type === "error" ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{alert.message}</AlertDescription>
                  </Alert>
                ))}
                <Link to="/insights">
                  <Button variant="outline" className="w-full gap-2">
                    View Detailed Analysis <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6-Month EMI Projection */}
      <Card>
        <CardHeader>
          <CardTitle>6-Month EMI Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              emi: {
                label: "EMI",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => formatINR(value)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="emi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/loans">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">View All Loans</p>
                <p className="text-sm text-muted-foreground">Manage your active loans</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/payments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Record Payment</p>
                <p className="text-sm text-muted-foreground">Log EMI or prepayments</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/insights">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">AI Insights</p>
                <p className="text-sm text-muted-foreground">Get smart recommendations</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
