import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatINR, formatPercent } from "@/lib/currency";
import { Wallet, Plus, Building2, Calendar, TrendingUp, CreditCard } from "lucide-react";
import QuickPaySheet from "@/components/QuickPaySheet";

export default function Loans() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<any>(null);
  const [showQuickPay, setShowQuickPay] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name, type),
          amortization_rows (
            closing_principal,
            due_on,
            is_paid,
            scheduled_emi
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate outstanding for each loan
      const loansWithStats = data?.map((loan) => {
        const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
        const outstanding = unpaidRows[0]?.closing_principal || 0;
        const nextDue = unpaidRows[0]?.due_on || null;
        const nextEMI = unpaidRows[0]?.scheduled_emi || 0;

        return {
          ...loan,
          outstanding,
          nextDue,
          nextEMI,
        };
      });

      setLoans(loansWithStats || []);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-success/10 text-success border-success/20";
      case "CLOSED":
        return "bg-muted text-muted-foreground border-muted";
      case "DEFAULTED":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted";
    }
  };

  const getLoanTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Loans</h1>
          <p className="text-muted-foreground">Manage all your loans in one place</p>
        </div>
        <Link to="/loans/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Loan
          </Button>
        </Link>
      </div>

      {loans.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No loans yet</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your loans by adding your first loan
            </p>
            <Link to="/loans/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Loan
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loans.map((loan) => {
            const logoUrl = loan.logo_url || loan.lenders?.logo_url;
            const initials = loan.loan_name.substring(0, 2).toUpperCase();
            
            return (
              <Card key={loan.id} className="h-full hover:shadow-lg transition-all border-border/50 hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        {logoUrl ? (
                          <AvatarImage src={logoUrl} alt={loan.loan_name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg">{loan.loan_name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{loan.lenders?.name || "Unknown Lender"}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(loan.status)} variant="outline">
                      {loan.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Outstanding</span>
                      <span className="font-bold text-lg">{formatINR(loan.outstanding)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly EMI</span>
                      <span className="font-medium">{formatINR(loan.emi_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Interest Rate</span>
                      <span className="font-medium">{formatPercent(loan.interest_rate_apy)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Next Due</span>
                      </div>
                      <span className="font-medium">
                        {loan.nextDue
                          ? new Date(loan.nextDue).toLocaleDateString("en-IN")
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>Loan Type</span>
                      </div>
                      <span className="font-medium">{getLoanTypeLabel(loan.loan_type)}</span>
                    </div>
                    
                    <Button
                      className="w-full mt-2 gap-2"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedLoanForPay(loan);
                        setShowQuickPay(true);
                      }}
                    >
                      <CreditCard className="h-4 w-4" />
                      Quick Pay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <QuickPaySheet
        open={showQuickPay}
        onOpenChange={setShowQuickPay}
        loan={selectedLoanForPay}
        onPaymentComplete={() => {
          fetchLoans();
          setSelectedLoanForPay(null);
        }}
      />
    </div>
  );
}
