import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatPercent } from "@/lib/currency";
import { Wallet, TrendingUp, AlertCircle, IndianRupee, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalOutstanding: number;
  next30DaysEMI: number;
  avgROI: number;
  activeLoansCount: number;
  overdueCount: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOutstanding: 0,
    next30DaysEMI: 0,
    avgROI: 0,
    activeLoansCount: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingEMIs, setUpcomingEMIs] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch active loans
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name),
          amortization_rows (
            due_on,
            scheduled_emi,
            is_paid,
            closing_principal
          )
        `)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      if (loansError) throw loansError;

      // Calculate stats
      let totalOutstanding = 0;
      let totalRate = 0;
      let next30DaysEMI = 0;
      let overdueCount = 0;
      const upcomingEMIsList: any[] = [];

      const today = new Date();
      const next30Days = new Date();
      next30Days.setDate(today.getDate() + 30);

      loans?.forEach((loan: any) => {
        // Get latest amortization row for outstanding
        const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
        if (unpaidRows.length > 0) {
          totalOutstanding += unpaidRows[0].closing_principal || 0;
        }

        totalRate += loan.interest_rate_apy || 0;

        // Check for upcoming EMIs
        unpaidRows.forEach((row: any) => {
          const dueDate = new Date(row.due_on);
          if (dueDate <= next30Days && dueDate >= today) {
            next30DaysEMI += row.scheduled_emi || 0;
            upcomingEMIsList.push({
              loanName: loan.loan_name,
              lenderName: loan.lenders?.name || "Unknown",
              dueOn: row.due_on,
              amount: row.scheduled_emi,
              isOverdue: dueDate < today,
            });
          }
          if (dueDate < today) {
            overdueCount++;
          }
        });
      });

      setStats({
        totalOutstanding,
        next30DaysEMI,
        avgROI: loans && loans.length > 0 ? totalRate / loans.length : 0,
        activeLoansCount: loans?.length || 0,
        overdueCount,
      });

      setUpcomingEMIs(upcomingEMIsList.sort((a, b) => 
        new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime()
      ));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your loan portfolio</p>
        </div>
        <Link to="/loans/new">
          <Button className="gap-2">
            <Wallet className="h-4 w-4" />
            Add Loan
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(stats.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats.activeLoansCount} active loans
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next 30 Days EMI</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(stats.next30DaysEMI)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingEMIs.length} upcoming payments
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Interest Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(stats.avgROI)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Weighted average APY
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 hover:shadow-lg transition-shadow ${stats.overdueCount > 0 ? 'border-destructive/50' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-destructive' : ''}`}>
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overdueCount > 0 ? 'Overdue payments' : 'All payments on track'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming EMIs */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming EMIs (Next 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingEMIs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming EMIs in the next 30 days
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingEMIs.map((emi, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    emi.isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{emi.loanName}</p>
                    <p className="text-sm text-muted-foreground">{emi.lenderName}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold">{formatINR(emi.amount)}</p>
                    <p className={`text-xs ${emi.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Due: {new Date(emi.dueOn).toLocaleDateString('en-IN')}
                      {emi.isOverdue && ' (Overdue)'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/loans">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-border/50 hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Manage Loans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage all your loans
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/payments">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-border/50 hover:border-secondary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Record Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Log your EMI and prepayments
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/dashboard/risk">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-border/50 hover:border-warning/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Check alerts and overdue items
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
