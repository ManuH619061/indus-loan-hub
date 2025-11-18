import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatINR, formatPercent } from "@/lib/currency";
import { Wallet, Plus, Building2, Calendar, TrendingUp, CreditCard, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QuickPaySheet from "@/components/QuickPaySheet";
import FadeInStagger, { FadeInStaggerItem } from "@/components/FadeInStagger";

export default function NewLoans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<any>(null);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<any>(null);

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
          lenders (name, type, logo_url),
          amortization_rows (
            closing_principal,
            due_on,
            is_paid,
            scheduled_emi
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

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

  const handleDelete = async () => {
    if (!loanToDelete) return;
    
    try {
      const { error } = await supabase
        .from("loans")
        .delete()
        .eq("id", loanToDelete.id);

      if (error) throw error;

      toast({ title: "Loan deleted successfully" });
      setDeleteDialogOpen(false);
      setLoanToDelete(null);
      fetchLoans();
    } catch (error: any) {
      toast({ 
        title: "Error deleting loan", 
        description: error.message, 
        variant: "destructive" 
      });
    }
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
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage all your loans in one place</p>
        </div>
        <Link to="/loans/new">
          <Button className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Loan
          </Button>
        </Link>
      </div>

      {loans.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">No loans yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Get started by adding your first loan to track payments and manage your debt
            </p>
            <Link to="/loans/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Loan
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <FadeInStagger className="grid gap-4">
          {loans.map((loan) => {
            const logoUrl = loan.logo_url || loan.lenders?.logo_url;
            const initials = loan.loan_name.substring(0, 2).toUpperCase();

            return (
              <FadeInStaggerItem key={loan.id}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16">
                          {logoUrl ? <AvatarImage src={logoUrl} alt={loan.loan_name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <Link to={`/loans/${loan.id}`}>
                                <h3 className="text-xl font-semibold hover:text-primary transition-colors truncate">
                                  {loan.loan_name}
                                </h3>
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm text-muted-foreground truncate">
                                  {loan.lenders?.name || "No lender"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={getStatusColor(loan.status)} variant="outline">
                                {loan.status}
                              </Badge>
                              <Link to={`/loans/${loan.id}/edit`}>
                                <Button variant="ghost" size="icon">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setLoanToDelete(loan);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                              <p className="font-semibold">{formatINR(loan.outstanding)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                              <p className="font-semibold">{formatPercent(loan.interest_rate_apy, 1)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">EMI Amount</p>
                              <p className="font-semibold">{formatINR(loan.emi_amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Loan Type</p>
                              <p className="font-semibold text-sm">{getLoanTypeLabel(loan.loan_type)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-4 text-sm">
                              {loan.nextDue && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    Next Due: {new Date(loan.nextDue).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedLoanForPay(loan);
                                  setShowQuickPay(true);
                                }}
                                className="gap-2"
                              >
                                <CreditCard className="h-4 w-4" />
                                Quick Pay
                              </Button>
                              <Link to={`/loans/${loan.id}`}>
                                <Button size="sm">View Details</Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{loanToDelete?.loan_name}"? This action cannot be undone and will also delete all associated payments and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showQuickPay && selectedLoanForPay && (
        <QuickPaySheet
          open={showQuickPay}
          onOpenChange={(open) => {
            setShowQuickPay(open);
            if (!open) setSelectedLoanForPay(null);
          }}
          loan={selectedLoanForPay}
          onPaymentComplete={() => {
            fetchLoans();
          }}
        />
      )}
    </div>
  );
}
