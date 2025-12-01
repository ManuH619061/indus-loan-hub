import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { Building2, Plus, ExternalLink, AlertCircle, ImagePlus } from "lucide-react";
import { getCategoryLabel, getCategoryColor } from "@/lib/loan-apps-library";
import AddLogoDialog from "./AddLogoDialog";
import {
  fetchLoansWithAmortization,
  calculateLenderStatsFromAmortization,
  LenderStats,
} from "@/lib/portfolio-stats";

export default function MyLendersTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lenders, setLenders] = useState<LenderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [selectedLender, setSelectedLender] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchLendersWithStats();

      // Subscribe to real-time changes
      const channel = supabase
        .channel('my-lenders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lenders' }, () => fetchLendersWithStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchLendersWithStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amortization_rows' }, () => fetchLendersWithStats())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchLendersWithStats = async () => {
    try {
      if (!user) return;

      // Fetch lenders
      const { data: lendersData } = await supabase
        .from("lenders")
        .select("id, name, type, logo_url")
        .eq("user_id", user.id);

      // Fetch loans with amortization using shared function
      const loans = await fetchLoansWithAmortization(user.id);

      // Calculate lender stats using shared logic
      const lenderStats = calculateLenderStatsFromAmortization(
        loans,
        (lendersData || []).map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          logo_url: l.logo_url,
        }))
      );

      setLenders(lenderStats);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-48" />
          </Card>
        ))}
      </div>
    );
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
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lenders.map((lender) => (
          <Card key={lender.lenderId} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {lender.logoUrl ? (
                    <img
                      src={lender.logoUrl}
                      alt={lender.lenderName}
                      className="h-10 w-10 rounded object-contain bg-muted p-1"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center relative group">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{lender.lenderName}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${getCategoryColor(lender.lenderType as any)}`}
                    >
                      {getCategoryLabel(lender.lenderType as any)}
                    </Badge>
                    {!lender.logoUrl && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs mt-1"
                        onClick={() => {
                          setSelectedLender({ id: lender.lenderId, name: lender.lenderName });
                          setLogoDialogOpen(true);
                        }}
                      >
                        <ImagePlus className="h-3 w-3 mr-1" />
                        Add Logo
                      </Button>
                    )}
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/lenders/${lender.lenderId}`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/loans/new?lender=${lender.lenderId}`)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Loan
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedLender && (
        <AddLogoDialog
          open={logoDialogOpen}
          onOpenChange={setLogoDialogOpen}
          lenderId={selectedLender.id}
          lenderName={selectedLender.name}
          onLogoAdded={fetchLendersWithStats}
        />
      )}
    </>
  );
}
