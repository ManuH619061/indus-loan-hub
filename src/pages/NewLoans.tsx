import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatPercent } from "@/lib/currency";
import { Wallet, Plus, Calendar, CreditCard, Pencil, Trash2, CheckSquare, X, Copy, LayoutGrid, List, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QuickPaySheet from "@/components/QuickPaySheet";
import FadeInStagger, { FadeInStaggerItem } from "@/components/FadeInStagger";
import { deleteLoan } from "@/lib/loan-service";
import LenderAvatar from "@/components/lenders/LenderAvatar";
import { calculateLoanStatsFromPayments } from "@/lib/loan-calculations";

interface LoanCardProps {
  loan: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onQuickPay: () => void;
  navigate: (path: string) => void;
  getStatusColor: (status: string) => string;
  getLoanTypeLabel: (type: string) => string;
  showLender?: boolean;
}

function LoanCard({
  loan,
  isSelected,
  onToggleSelect,
  onDelete,
  onQuickPay,
  navigate,
  getStatusColor,
  getLoanTypeLabel,
  showLender = false,
}: LoanCardProps) {
  const logoUrl = loan.logo_url || loan.lenders?.logo_url;
  const lenderName = loan.lenders?.name || "No Lender";

  return (
    <FadeInStaggerItem>
      <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
        <Card className={`hover:shadow-lg transition-shadow ${isSelected ? "ring-2 ring-primary" : ""}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="mt-5"
              />
              <LenderAvatar name={lenderName} logoUrl={logoUrl} size="lg" className="h-16 w-16 text-lg" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link to={`/loans/${loan.id}`}>
                      <h3 className="text-xl font-semibold hover:text-primary transition-colors">
                        {loan.loan_name}
                      </h3>
                    </Link>
                    {showLender && (
                      <div className="flex items-center gap-2 mt-1">
                        <LenderAvatar name={lenderName} logoUrl={logoUrl} size="sm" />
                        <span className="text-sm text-muted-foreground">{lenderName}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(loan.status)} variant="outline">
                      {loan.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const loanData = encodeURIComponent(
                          JSON.stringify({
                            lender_id: loan.lender_id,
                            loan_name: loan.loan_name,
                            principal_amount: loan.principal_amount,
                            tenure_months: loan.tenure_months,
                            interest_rate_apy: loan.interest_rate_apy,
                            rate_type: loan.rate_type,
                            compounding: loan.compounding,
                            loan_type: loan.loan_type,
                            processing_fee: loan.processing_fee,
                            insurance_fee: loan.insurance_fee,
                            gst_on_fees: loan.gst_on_fees,
                            other_upfront_costs: loan.other_upfront_costs,
                            recast_mode: loan.recast_mode,
                            auto_debit: loan.auto_debit,
                            preferred_method: loan.preferred_method,
                          })
                        );
                        navigate(`/loans/new?duplicate=${loanData}`);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Link to={`/loans/${loan.id}/edit`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={onDelete}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                    <Button variant="outline" size="sm" onClick={onQuickPay} className="gap-2">
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
}

export default function NewLoans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<any>(null);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<any>(null);
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "status">("delete");
  const [bulkStatus, setBulkStatus] = useState<"ACTIVE" | "CLOSED" | "DEFAULTED">("ACTIVE");
  const [groupByLender, setGroupByLender] = useState(false);
  const [filterLender, setFilterLender] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchLoans();

      const channel = supabase
        .channel("loans-list-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "loans" }, () => fetchLoans())
        .on("postgres_changes", { event: "*", schema: "public", table: "amortization_rows" }, () => fetchLoans())
        .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchLoans())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select(`*, lenders (name, type, logo_url), amortization_rows (closing_principal, due_on, is_paid, scheduled_emi)`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch all payments for these loans
      const loanIds = data?.map((l) => l.id) || [];
      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .in("loan_id", loanIds);

      // Group payments by loan_id
      const paymentsByLoan = new Map<string, any[]>();
      (allPayments || []).forEach((p: any) => {
        const existing = paymentsByLoan.get(p.loan_id) || [];
        existing.push(p);
        paymentsByLoan.set(p.loan_id, existing);
      });

      const loansWithStats = data?.map((loan) => {
        const loanPayments = paymentsByLoan.get(loan.id) || [];
        
        // Calculate outstanding based on actual payments
        const stats = calculateLoanStatsFromPayments(
          {
            id: loan.id,
            principal_amount: loan.principal_amount,
            interest_rate_apy: loan.interest_rate_apy,
            tenure_months: loan.tenure_months,
            disbursed_on: loan.disbursed_on,
            due_day: loan.due_day,
            rate_type: loan.rate_type,
            emi_amount: loan.emi_amount,
          },
          loanPayments
        );
        
        const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
        const nextDue = unpaidRows[0]?.due_on || null;
        const nextEMI = unpaidRows[0]?.scheduled_emi || 0;
        
        return { 
          ...loan, 
          outstanding: stats.outstandingPrincipal, 
          emisPaid: stats.emisPaid,
          emisPending: stats.emisPending,
          nextDue, 
          nextEMI 
        };
      });

      setLoans(loansWithStats || []);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique lenders for filtering
  const uniqueLenders = useMemo(() => {
    const lenderMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
    loans.forEach((loan) => {
      const lenderId = loan.lender_id || "no-lender";
      const lenderName = loan.lenders?.name || "No Lender";
      const logoUrl = loan.lenders?.logo_url || null;
      if (!lenderMap.has(lenderId)) {
        lenderMap.set(lenderId, { id: lenderId, name: lenderName, logoUrl });
      }
    });
    return Array.from(lenderMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  // Filter and group loans
  const filteredLoans = useMemo(() => {
    if (filterLender === "all") return loans;
    return loans.filter((loan) => (loan.lender_id || "no-lender") === filterLender);
  }, [loans, filterLender]);

  const groupedLoans = useMemo(() => {
    if (!groupByLender) return {};
    const groups: Record<string, { lender: { name: string; logoUrl: string | null }; loans: any[] }> = {};
    filteredLoans.forEach((loan) => {
      const lenderId = loan.lender_id || "no-lender";
      const lenderName = loan.lenders?.name || "No Lender";
      const logoUrl = loan.lenders?.logo_url || null;
      if (!groups[lenderId]) {
        groups[lenderId] = { lender: { name: lenderName, logoUrl }, loans: [] };
      }
      groups[lenderId].loans.push(loan);
    });
    return groups;
  }, [filteredLoans, groupByLender]);

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
      const result = await deleteLoan(loanToDelete.id);
      if (!result.success) throw new Error(result.error);
      toast({ title: "Loan deleted successfully", description: "All related data has been removed" });
      setDeleteDialogOpen(false);
      setLoanToDelete(null);
      fetchLoans();
    } catch (error: any) {
      toast({ title: "Error deleting loan", description: error.message, variant: "destructive" });
    }
  };

  const toggleSelectLoan = (loanId: string) => {
    setSelectedLoans((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) newSet.delete(loanId);
      else newSet.add(loanId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLoans.size === filteredLoans.length) setSelectedLoans(new Set());
    else setSelectedLoans(new Set(filteredLoans.map((l) => l.id)));
  };

  const handleBulkAction = async () => {
    if (selectedLoans.size === 0) return;
    try {
      if (bulkAction === "delete") {
        const deletePromises = Array.from(selectedLoans).map((id) => deleteLoan(id));
        const results = await Promise.all(deletePromises);
        const failedCount = results.filter((r) => !r.success).length;
        if (failedCount > 0) throw new Error(`Failed to delete ${failedCount} loan(s)`);
        toast({ title: `Successfully deleted ${selectedLoans.size} loan(s)`, description: "All related data has been removed" });
      } else if (bulkAction === "status") {
        const { error } = await supabase.from("loans").update({ status: bulkStatus }).in("id", Array.from(selectedLoans));
        if (error) throw error;
        toast({ title: `Successfully updated ${selectedLoans.size} loan(s) status` });
      }
      setSelectedLoans(new Set());
      setBulkActionDialogOpen(false);
      fetchLoans();
    } catch (error: any) {
      toast({ title: "Error performing bulk action", description: error.message, variant: "destructive" });
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage all your loans in one place</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterLender} onValueChange={setFilterLender}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by lender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lenders</SelectItem>
              {uniqueLenders.map((lender) => (
                <SelectItem key={lender.id} value={lender.id}>
                  <div className="flex items-center gap-2">
                    <LenderAvatar name={lender.name} logoUrl={lender.logoUrl} size="sm" />
                    <span>{lender.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={groupByLender ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupByLender(!groupByLender)}
            className="gap-2"
          >
            {groupByLender ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {groupByLender ? "Grouped" : "List"}
          </Button>

          <Link to="/loans/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Loan
            </Button>
          </Link>
        </div>
      </div>

      {selectedLoans.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedLoans.size} loan(s) selected</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLoans(new Set())} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={bulkAction} onValueChange={(val: any) => setBulkAction(val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delete">Delete Loans</SelectItem>
                    <SelectItem value="status">Update Status</SelectItem>
                  </SelectContent>
                </Select>
                {bulkAction === "status" && (
                  <Select value={bulkStatus} onValueChange={(val) => setBulkStatus(val as "ACTIVE" | "CLOSED" | "DEFAULTED")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                      <SelectItem value="DEFAULTED">Defaulted</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={() => setBulkActionDialogOpen(true)}>Apply Action</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredLoans.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">{filterLender !== "all" ? "No loans for this lender" : "No loans yet"}</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {filterLender !== "all"
                ? "Try selecting a different lender or clear the filter"
                : "Get started by adding your first loan to track payments and manage your debt"}
            </p>
            {filterLender !== "all" ? (
              <Button variant="outline" onClick={() => setFilterLender("all")}>
                Clear Filter
              </Button>
            ) : (
              <Link to="/loans/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Loan
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <>
          {filteredLoans.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="select-all"
                checked={selectedLoans.size === filteredLoans.length && filteredLoans.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
                Select All ({filteredLoans.length})
              </label>
            </div>
          )}

          {groupByLender ? (
            <div className="space-y-6">
              {Object.entries(groupedLoans).map(([lenderId, group]) => (
                <div key={lenderId} className="space-y-3">
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <LenderAvatar name={group.lender.name} logoUrl={group.lender.logoUrl} size="md" />
                    <div>
                      <h2 className="font-semibold">{group.lender.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {group.loans.length} loan{group.loans.length !== 1 ? "s" : ""} • Total Outstanding:{" "}
                        {formatINR(group.loans.reduce((sum, l) => sum + (l.outstanding || 0), 0))}
                      </p>
                    </div>
                  </div>
                  <FadeInStagger className="grid gap-4">
                    {group.loans.map((loan) => (
                      <LoanCard
                        key={loan.id}
                        loan={loan}
                        isSelected={selectedLoans.has(loan.id)}
                        onToggleSelect={() => toggleSelectLoan(loan.id)}
                        onDelete={() => {
                          setLoanToDelete(loan);
                          setDeleteDialogOpen(true);
                        }}
                        onQuickPay={() => {
                          setSelectedLoanForPay(loan);
                          setShowQuickPay(true);
                        }}
                        navigate={navigate}
                        getStatusColor={getStatusColor}
                        getLoanTypeLabel={getLoanTypeLabel}
                      />
                    ))}
                  </FadeInStagger>
                </div>
              ))}
            </div>
          ) : (
            <FadeInStagger className="grid gap-4">
              {filteredLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  isSelected={selectedLoans.has(loan.id)}
                  onToggleSelect={() => toggleSelectLoan(loan.id)}
                  onDelete={() => {
                    setLoanToDelete(loan);
                    setDeleteDialogOpen(true);
                  }}
                  onQuickPay={() => {
                    setSelectedLoanForPay(loan);
                    setShowQuickPay(true);
                  }}
                  navigate={navigate}
                  getStatusColor={getStatusColor}
                  getLoanTypeLabel={getLoanTypeLabel}
                  showLender
                />
              ))}
            </FadeInStagger>
          )}
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{loanToDelete?.loan_name}"? This action cannot be undone and will also delete all associated
              payments and documents.
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

      <AlertDialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkAction === "delete" ? "Delete Loans" : "Update Loan Status"}</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete"
                ? `Are you sure you want to delete ${selectedLoans.size} loan(s)? This action cannot be undone and will also delete all associated payments and documents.`
                : `Are you sure you want to update ${selectedLoans.size} loan(s) status to ${bulkStatus}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAction} className={bulkAction === "delete" ? "bg-destructive text-destructive-foreground" : ""}>
              {bulkAction === "delete" ? "Delete" : "Update"}
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
          onPaymentComplete={() => fetchLoans()}
        />
      )}
    </div>
  );
}
