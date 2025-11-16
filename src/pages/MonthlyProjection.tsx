import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/currency";
import { Calendar, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

type MonthlyData = {
  month: string;
  totalEMI: number;
  loans: {
    loanName: string;
    lenderName: string;
    amount: number;
    dueDate: string;
  }[];
};

export default function MonthlyProjection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalProjected, setTotalProjected] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProjectionData();
    }
  }, [user]);

  const fetchProjectionData = async () => {
    setLoading(true);
    try {
      const { data: loans, error } = await supabase
        .from("loans")
        .select(`
          id,
          loan_name,
          status,
          lenders (name),
          amortization_rows (
            due_on,
            scheduled_emi,
            is_paid
          )
        `)
        .eq("status", "ACTIVE");

      if (error) throw error;

      // Calculate monthly projections for next 12 months
      const projections: MonthlyData[] = [];
      const today = new Date();
      let total = 0;

      for (let i = 0; i < 12; i++) {
        const monthStart = startOfMonth(addMonths(today, i));
        const monthEnd = endOfMonth(addMonths(today, i));
        
        const monthData: MonthlyData = {
          month: format(monthStart, "MMM yyyy"),
          totalEMI: 0,
          loans: [],
        };

        loans?.forEach((loan: any) => {
          loan.amortization_rows?.forEach((row: any) => {
            if (row.is_paid) return;
            
            const dueDate = new Date(row.due_on);
            if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
              monthData.totalEMI += Number(row.scheduled_emi) || 0;
              monthData.loans.push({
                loanName: loan.loan_name,
                lenderName: loan.lenders?.name || "Unknown",
                amount: Number(row.scheduled_emi) || 0,
                dueDate: row.due_on,
              });
            }
          });
        });

        total += monthData.totalEMI;
        projections.push(monthData);
      }

      setMonthlyData(projections);
      setTotalProjected(total);
    } catch (error) {
      console.error("Error fetching projection data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  const avgMonthly = totalProjected / 12;
  const maxMonth = monthlyData.reduce((max, m) => m.totalEMI > max.totalEMI ? m : max, monthlyData[0]);
  const minMonth = monthlyData.reduce((min, m) => m.totalEMI < min.totalEMI && m.totalEMI > 0 ? m : min, monthlyData[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monthly Liability Projection</h1>
        <p className="text-muted-foreground">12-month EMI forecast and cash flow planning</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total 12-Month Liability</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalProjected)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg {formatINR(avgMonthly)}/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(maxMonth?.totalEMI || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{maxMonth?.month}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lowest Month</CardTitle>
            <TrendingDown className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(minMonth?.totalEMI || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{minMonth?.month}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <div className="space-y-4">
        {monthlyData.map((monthData, idx) => (
          <Card key={idx} className={monthData.totalEMI === 0 ? "opacity-50" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{monthData.month}</CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{formatINR(monthData.totalEMI)}</div>
                  <p className="text-xs text-muted-foreground">
                    {monthData.loans.length} EMI{monthData.loans.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardHeader>
            {monthData.loans.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  {monthData.loans.map((loan, loanIdx) => (
                    <div
                      key={loanIdx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{loan.loanName}</p>
                        <p className="text-xs text-muted-foreground">
                          {loan.lenderName} • Due: {format(new Date(loan.dueDate), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(loan.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
