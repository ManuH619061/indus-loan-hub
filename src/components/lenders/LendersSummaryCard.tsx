import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { TrendingDown, CreditCard, Percent, Building2 } from "lucide-react";

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
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'loans',
          },
          () => {
            fetchSummary();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchSummary = async () => {
    try {
      const { data: loans } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "ACTIVE");

      if (!loans || loans.length === 0) return;

      // Calculate total outstanding
      const totalOutstanding = loans.reduce((sum, loan) => {
        const monthsSinceDisbursement = Math.floor(
          (new Date().getTime() - new Date(loan.disbursed_on).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        const remainingMonths = loan.tenure_months - monthsSinceDisbursement;
        const monthlyRate = loan.interest_rate_apy / 100 / 12;
        const emi = loan.emi_amount || 0;
        
        const remainingPrincipal = remainingMonths > 0
          ? emi * ((Math.pow(1 + monthlyRate, remainingMonths) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)))
          : 0;
        
        return sum + remainingPrincipal;
      }, 0);

      // Calculate total EMI
      const totalEMI = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);

      // Calculate average interest
      const avgInterest = loans.reduce((sum, loan) => sum + loan.interest_rate_apy, 0) / loans.length;

      // Count unique lenders
      const uniqueLenders = new Set(loans.map((loan) => loan.lender_id).filter(Boolean));

      setSummary({
        totalOutstanding,
        totalEMI,
        avgInterest,
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
              EMI per Month
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
