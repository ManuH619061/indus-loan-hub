import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { Building2, Plus, ExternalLink, AlertCircle } from "lucide-react";
import { getCategoryLabel, getCategoryColor } from "@/lib/loan-apps-library";

interface LenderWithStats {
  id: string;
  name: string;
  type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER";
  logo_url?: string;
  loanCount: number;
  totalOutstanding: number;
  avgInterest: number;
}

export default function MyLendersTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lenders, setLenders] = useState<LenderWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchLendersWithStats();
  }, [user]);

  const fetchLendersWithStats = async () => {
    try {
      // Fetch lenders with their loans
      const { data: lendersData } = await supabase
        .from("lenders")
        .select("*")
        .eq("user_id", user?.id);

      const { data: loansData } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "ACTIVE");

      // Calculate stats for each lender
      const lendersWithStats = (lendersData || [])
        .map((lender) => {
          const lenderLoans = (loansData || []).filter((loan) => loan.lender_id === lender.id);
          
          if (lenderLoans.length === 0) return null; // Only show lenders with active loans

          const totalOutstanding = lenderLoans.reduce((sum, loan) => {
            // Calculate remaining principal
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

          const avgInterest = lenderLoans.reduce((sum, loan) => sum + loan.interest_rate_apy, 0) / lenderLoans.length;

          return {
            id: lender.id,
            name: lender.name,
            type: lender.type as "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER",
            logo_url: lender.logo_url || undefined,
            loanCount: lenderLoans.length,
            totalOutstanding,
            avgInterest,
          };
        })
        .filter((lender) => lender !== null) as LenderWithStats[];

      setLenders(lendersWithStats);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="h-48" /></Card>)}
    </div>;
  }

  if (lenders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-4">No active loans with any lenders yet</p>
          <Button onClick={() => navigate("/loans/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Loan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {lenders.map((lender) => (
        <Card key={lender.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {lender.logo_url ? (
                  <img src={lender.logo_url} alt={lender.name} className="h-10 w-10 rounded object-contain bg-muted p-1" />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{lender.name}</CardTitle>
                  <Badge variant="outline" className={`mt-1 ${getCategoryColor(lender.type)}`}>
                    {getCategoryLabel(lender.type)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-semibold">{formatINR(lender.totalOutstanding)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Loans</p>
                <p className="text-lg font-semibold">{lender.loanCount}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Interest Rate</p>
              <p className="text-lg font-semibold text-warning">{formatPercent(lender.avgInterest)}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="default" size="sm" onClick={() => navigate(`/lenders/${lender.id}`)}>
                <ExternalLink className="h-3 w-3 mr-1" />
                View Details
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/loans/new?lender=${lender.id}`)}>
                <Plus className="h-3 w-3 mr-1" />
                Add Loan
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
