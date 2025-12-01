import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { TrendingDown, CreditCard, Percent, Building2 } from "lucide-react";
import {
  fetchLoansWithAmortization,
  calculatePortfolioStatsFromAmortization,
  calculateNext30DaysEMI,
} from "@/lib/portfolio-stats";

export default function LendersSummaryCard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalEMI: 0,
    avgInterest: 0,
    lenderCount: 0,
  });

  useEffect(() => {
    if (user) {
      fetchSummary();

      // Subscribe to real-time changes for loans (affects summary)
      const channel = supabase
        .channel('lenders-summary-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchSummary())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amortization_rows' }, () => fetchSummary())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchSummary = async () => {
    try {
      if (!user) return;

      // Fetch loans with amortization using shared function
      const loans = await fetchLoansWithAmortization(user.id);

      if (!loans || loans.length === 0) {
        setSummary({
          totalOutstanding: 0,
          totalEMI: 0,
          avgInterest: 0,
          lenderCount: 0,
        });
        return;
      }

      // Calculate portfolio stats using shared logic
      const portfolioStats = calculatePortfolioStatsFromAmortization(loans);

      // Calculate next 30 days EMI using shared logic
      const next30Days = calculateNext30DaysEMI(loans);

      // Count unique lenders
      const uniqueLenders = new Set(loans.map((loan) => loan.lender_id).filter(Boolean));

      setSummary({
        totalOutstanding: portfolioStats.totalOutstanding,
        totalEMI: next30Days.total,
        avgInterest: portfolioStats.avgInterestRate,
        lenderCount: uniqueLenders.size,
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4" />
              Total Outstanding
            </div>
            <p className="text-2xl font-bold">{formatINR(summary.totalOutstanding)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CreditCard className="h-4 w-4" />
              Next 30 Days EMI
            </div>
            <p className="text-2xl font-bold">{formatINR(summary.totalEMI)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Percent className="h-4 w-4" />
              Avg Interest
            </div>
            <p className="text-2xl font-bold">{formatPercent(summary.avgInterest)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building2 className="h-4 w-4" />
              Active Lenders
            </div>
            <p className="text-2xl font-bold">{summary.lenderCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
