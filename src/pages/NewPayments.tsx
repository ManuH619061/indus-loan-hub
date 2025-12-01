import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { Plus, Smartphone, CreditCard, Banknote, Building2, TrendingUp, Calendar, AlertCircle, Pencil, Trash2, Upload, FileImage, X, ExternalLink, CheckSquare } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import LenderAvatar from "@/components/lenders/LenderAvatar";
import { syncAmortizationWithPayments } from "@/lib/loan-calculations";
import { Checkbox } from "@/components/ui/checkbox";

interface PaymentFormData {
  id?: string;
  loan_id: string;
  amount: string;
  paid_on: string;
  payment_type: string;
  source: string;
  notes: string;
  receipt_url?: string;
}

const initialFormData: PaymentFormData = {
  loan_id: "",
  amount: "",
  paid_on: new Date().toISOString().split("T")[0],
  payment_type: "EMI",
  source: "UPI_PHONEPE",
  notes: "",
  receipt_url: "",
};

export default function NewPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [upcomingEMIs, setUpcomingEMIs] = useState<any[]>([]);
  const [overdueEMIs, setOverdueEMIs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(initialFormData);
  
  // Edit/Delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [editForm, setEditForm] = useState<PaymentFormData>(initialFormData);
  
  // Multi-select state
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    paid_on: "",
    amount: "",
    source: "",
    notes: "",
    updateDate: false,
    updateAmount: false,
    updateSource: false,
    updateNotes: false,
  });
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Receipt upload state
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [editUploadingReceipt, setEditUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      const channel = supabase
        .channel("payments-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchData())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`*, loans!inner (loan_name, logo_url, user_id, lenders (name, logo_url))`)
        .order("paid_on", { ascending: false })
        .limit(50);

      const { data: loansData } = await supabase
        .from("loans")
        .select(`*, lenders (name, logo_url), amortization_rows (due_on, scheduled_emi, is_paid)`)
        .eq("status", "ACTIVE");

      setPayments(paymentsData || []);
      setLoans(loansData || []);

      const today = new Date();
      const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcoming: any[] = [];
      const overdue: any[] = [];

      loansData?.forEach((loan: any) => {
        loan.amortization_rows?.forEach((row: any) => {
          if (row.is_paid) return;
          const dueDate = new Date(row.due_on);
          if (dueDate < today) {
            overdue.push({ ...row, loan_name: loan.loan_name, loan_id: loan.id });
          } else if (dueDate <= next30Days) {
            upcoming.push({ ...row, loan_name: loan.loan_name, loan_id: loan.id });
          }
        });
      });

      setUpcomingEMIs(upcoming.sort((a, b) => new Date(a.due_on).getTime() - new Date(b.due_on).getTime()));
      setOverdueEMIs(overdue.sort((a, b) => new Date(a.due_on).getTime() - new Date(b.due_on).getTime()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadReceipt = async (file: File, isEdit = false): Promise<string | null> => {
    if (!user) return null;
    
    const setUploading = isEdit ? setEditUploadingReceipt : setUploadingReceipt;
    setUploading(true);
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ title: "Invalid file type", description: "Please upload an image or PDF", variant: "destructive" });
      return;
    }

    const url = await uploadReceipt(file, isEdit);
    if (url) {
      if (isEdit) {
        setEditForm({ ...editForm, receipt_url: url });
      } else {
        setPaymentForm({ ...paymentForm, receipt_url: url });
      }
      toast({ title: "Receipt uploaded successfully" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("payments").insert({
        loan_id: paymentForm.loan_id,
        amount: parseFloat(paymentForm.amount),
        paid_on: paymentForm.paid_on,
        payment_type: paymentForm.payment_type,
        source: paymentForm.source,
        notes: paymentForm.notes,
        receipt_url: paymentForm.receipt_url || null,
      } as any);

      if (error) throw error;

      toast({ title: "Payment recorded successfully" });
      setPaymentForm(initialFormData);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error recording payment", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (payment: any) => {
    setSelectedPayment(payment);
    setEditForm({
      id: payment.id,
      loan_id: payment.loan_id,
      amount: payment.amount.toString(),
      paid_on: payment.paid_on,
      payment_type: payment.payment_type,
      source: payment.source,
      notes: payment.notes || "",
      receipt_url: payment.receipt_url || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedPayment) return;
    try {
      const { error } = await supabase
        .from("payments")
        .update({
          loan_id: editForm.loan_id,
          amount: parseFloat(editForm.amount),
          paid_on: editForm.paid_on,
          payment_type: editForm.payment_type,
          source: editForm.source,
          notes: editForm.notes,
          receipt_url: editForm.receipt_url || null,
        } as any)
        .eq("id", selectedPayment.id);

      if (error) throw error;

      toast({ title: "Payment updated successfully" });
      setEditDialogOpen(false);
      setSelectedPayment(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error updating payment", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selectedPayment) return;
    try {
      const loanId = selectedPayment.loan_id;
      
      // Delete the payment
      const { error } = await supabase.from("payments").delete().eq("id", selectedPayment.id);
      if (error) throw error;

      // Fetch remaining payments for this loan and sync amortization
      const { data: remainingPayments } = await supabase
        .from("payments")
        .select("*")
        .eq("loan_id", loanId);

      // Sync amortization rows based on remaining payments
      await syncAmortizationWithPayments(loanId, remainingPayments || [], supabase);

      toast({ title: "Payment deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedPayment(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error deleting payment", description: error.message, variant: "destructive" });
    }
  };

  // Multi-select handlers
  const togglePaymentSelection = (paymentId: string) => {
    const newSelected = new Set(selectedPayments);
    if (newSelected.has(paymentId)) {
      newSelected.delete(paymentId);
    } else {
      newSelected.add(paymentId);
    }
    setSelectedPayments(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPayments.size === payments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(payments.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedPayments(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedPayments.size === 0) return;
    
    setBulkOperationLoading(true);
    try {
      const selectedPaymentsList = payments.filter(p => selectedPayments.has(p.id));
      
      // Group payments by loan_id to sync amortization for each affected loan
      const paymentsByLoan = new Map<string, any[]>();
      selectedPaymentsList.forEach(payment => {
        const existing = paymentsByLoan.get(payment.loan_id) || [];
        existing.push(payment);
        paymentsByLoan.set(payment.loan_id, existing);
      });

      // Delete all selected payments
      const { error } = await supabase
        .from("payments")
        .delete()
        .in("id", Array.from(selectedPayments));

      if (error) throw error;

      // Sync amortization for each affected loan
      for (const loanId of paymentsByLoan.keys()) {
        const { data: remainingPayments } = await supabase
          .from("payments")
          .select("*")
          .eq("loan_id", loanId);

        await syncAmortizationWithPayments(loanId, remainingPayments || [], supabase);
      }

      toast({ 
        title: "Payments deleted successfully",
        description: `${selectedPayments.size} payment(s) deleted and loan stats updated.`
      });
      setBulkDeleteDialogOpen(false);
      clearSelection();
      fetchData();
    } catch (error: any) {
      toast({ title: "Error deleting payments", description: error.message, variant: "destructive" });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditForm({
      paid_on: new Date().toISOString().split("T")[0],
      amount: "",
      source: "",
      notes: "",
      updateDate: false,
      updateAmount: false,
      updateSource: false,
      updateNotes: false,
    });
    setBulkEditDialogOpen(true);
  };

  const handleBulkEdit = async () => {
    if (selectedPayments.size === 0) return;
    
    const updates: any = {};
    if (bulkEditForm.updateDate && bulkEditForm.paid_on) {
      updates.paid_on = bulkEditForm.paid_on;
    }
    if (bulkEditForm.updateAmount && bulkEditForm.amount) {
      updates.amount = parseFloat(bulkEditForm.amount);
    }
    if (bulkEditForm.updateSource && bulkEditForm.source) {
      updates.source = bulkEditForm.source;
    }
    if (bulkEditForm.updateNotes) {
      updates.notes = bulkEditForm.notes;
    }

    if (Object.keys(updates).length === 0) {
      toast({ title: "No fields selected", description: "Please select at least one field to update.", variant: "destructive" });
      return;
    }

    setBulkOperationLoading(true);
    try {
      const selectedPaymentsList = payments.filter(p => selectedPayments.has(p.id));
      
      // Group payments by loan_id
      const affectedLoanIds = new Set(selectedPaymentsList.map(p => p.loan_id));

      // Update all selected payments
      const { error } = await supabase
        .from("payments")
        .update(updates)
        .in("id", Array.from(selectedPayments));

      if (error) throw error;

      // Sync amortization for each affected loan
      for (const loanId of affectedLoanIds) {
        const { data: loanPayments } = await supabase
          .from("payments")
          .select("*")
          .eq("loan_id", loanId);

        await syncAmortizationWithPayments(loanId, loanPayments || [], supabase);
      }

      toast({ 
        title: "Payments updated successfully",
        description: `${selectedPayments.size} payment(s) updated and loan stats recalculated.`
      });
      setBulkEditDialogOpen(false);
      clearSelection();
      fetchData();
    } catch (error: any) {
      toast({ title: "Error updating payments", description: error.message, variant: "destructive" });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const getTrendData = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(monthDate);
      const monthPayments = payments.filter((p) => {
        const paidDate = new Date(p.paid_on);
        return isWithinInterval(paidDate, { start: monthDate, end: monthEnd });
      });
      const emiTotal = monthPayments.filter((p) => p.payment_type === "EMI").reduce((sum, p) => sum + p.amount, 0);
      const prepayTotal = monthPayments
        .filter((p) => p.payment_type === "PART_PREPAY" || p.payment_type === "FULL_PREPAY")
        .reduce((sum, p) => sum + p.amount, 0);
      months.push({ month: format(monthDate, "MMM"), emi: emiTotal, prepayment: prepayTotal });
    }
    return months;
  };

  const removeReceipt = (isEdit = false) => {
    if (isEdit) {
      setEditForm({ ...editForm, receipt_url: "" });
    } else {
      setPaymentForm({ ...paymentForm, receipt_url: "" });
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

  const trendData = getTrendData();
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const emiPaid = payments.filter((p) => p.payment_type === "EMI").reduce((sum, p) => sum + p.amount, 0);
  const prepaid = payments
    .filter((p) => p.payment_type === "PART_PREPAY" || p.payment_type === "FULL_PREPAY")
    .reduce((sum, p) => sum + p.amount, 0);

  const ReceiptUploadField = ({ value, onChange, uploading, inputRef, isEdit = false }: any) => (
    <div>
      <Label>Receipt (Optional)</Label>
      <div className="mt-1">
        {value ? (
          <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
            <FileImage className="h-5 w-5 text-primary" />
            <span className="text-sm flex-1 truncate">Receipt uploaded</span>
            <Button size="sm" variant="ghost" onClick={() => window.open(value, "_blank")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeReceipt(isEdit)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onChange(e, isEdit)}
            />
            {uploading ? (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload receipt (Image or PDF, max 5MB)</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Record and track all your loan payments</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EMI Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(emiPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prepayments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(prepaid)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="record" className="space-y-4">
        <TabsList>
          <TabsTrigger value="record">Record Payment</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcomingEMIs.length})</TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({overdueEMIs.length})
            {overdueEMIs.length > 0 && <Badge variant="destructive" className="ml-2">{overdueEMIs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record New Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Loan</Label>
                    <Select value={paymentForm.loan_id} onValueChange={(val) => setPaymentForm({ ...paymentForm, loan_id: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            <div className="flex items-center gap-2">
                              <LenderAvatar name={loan.lenders?.name || loan.loan_name} logoUrl={loan.lenders?.logo_url} size="sm" />
                              {loan.loan_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.paid_on}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paid_on: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Payment Type</Label>
                    <Select value={paymentForm.payment_type} onValueChange={(val) => setPaymentForm({ ...paymentForm, payment_type: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMI">EMI</SelectItem>
                        <SelectItem value="PART_PREPAY">Partial Prepayment</SelectItem>
                        <SelectItem value="FULL_PREPAY">Full Prepayment</SelectItem>
                        <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                        <SelectItem value="OTHER_FEE">Other Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentForm.source} onValueChange={(val) => setPaymentForm({ ...paymentForm, source: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI_PHONEPE">PhonePe</SelectItem>
                        <SelectItem value="UPI_GPAY">Google Pay</SelectItem>
                        <SelectItem value="UPI_PAYTM">Paytm</SelectItem>
                        <SelectItem value="NETBANKING">Net Banking</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes (Optional)</Label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Add any notes about this payment"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <ReceiptUploadField
                      value={paymentForm.receipt_url}
                      onChange={handleReceiptUpload}
                      uploading={uploadingReceipt}
                      inputRef={fileInputRef}
                      isEdit={false}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={uploadingReceipt}>
                  <Plus className="h-4 w-4" />
                  Record Payment
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming EMIs (Next 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEMIs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No upcoming EMIs in the next 30 days</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEMIs.map((emi, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-semibold">{emi.loan_name}</p>
                        <p className="text-sm text-muted-foreground">Due {format(new Date(emi.due_on), "MMM d, yyyy")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(emi.scheduled_emi)}</p>
                        <Button size="sm" variant="outline" className="mt-2">
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Overdue EMIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueEMIs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No overdue payments. Great job!</p>
              ) : (
                <div className="space-y-3">
                  {overdueEMIs.map((emi, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                      <div>
                        <p className="font-semibold">{emi.loan_name}</p>
                        <p className="text-sm text-destructive">Overdue since {format(new Date(emi.due_on), "MMM d, yyyy")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(emi.scheduled_emi)}</p>
                        <Button size="sm" variant="destructive" className="mt-2">
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Payment History</CardTitle>
              {payments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedPayments.size === payments.length && payments.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm font-normal cursor-pointer">
                    Select All
                  </Label>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Action bar when payments are selected */}
              {selectedPayments.size > 0 && (
                <div className="flex items-center justify-between p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">{selectedPayments.size} payment(s) selected</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={openBulkEditDialog}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit Selected
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              )}
              
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors ${
                        selectedPayments.has(payment.id) ? 'bg-primary/5 border-primary/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedPayments.has(payment.id)}
                          onCheckedChange={() => togglePaymentSelection(payment.id)}
                        />
                        <LenderAvatar
                          name={payment.loans?.lenders?.name || payment.loans?.loan_name || "Payment"}
                          logoUrl={payment.loans?.lenders?.logo_url || payment.loans?.logo_url}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-sm">{payment.loans?.loan_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.paid_on), "MMM d, yyyy")} • {payment.payment_type.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatINR(payment.amount)}</p>
                          {payment.receipt_url && (
                            <Badge variant="outline" className="text-xs">
                              <FileImage className="h-3 w-3 mr-1" />
                              Receipt
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {payment.receipt_url && (
                            <Button size="icon" variant="ghost" onClick={() => window.open(payment.receipt_url, "_blank")}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(payment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Payment Trends (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  emi: { label: "EMI", color: "hsl(var(--primary))" },
                  prepayment: { label: "Prepayment", color: "hsl(var(--success))" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Line type="monotone" dataKey="emi" stroke="var(--color-emi)" strokeWidth={2} dot={{ fill: "var(--color-emi)" }} />
                    <Line type="monotone" dataKey="prepayment" stroke="var(--color-prepayment)" strokeWidth={2} dot={{ fill: "var(--color-prepayment)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Loan</Label>
                <Select value={editForm.loan_id} onValueChange={(val) => setEditForm({ ...editForm, loan_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan" />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id}>
                        {loan.loan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={editForm.paid_on} onChange={(e) => setEditForm({ ...editForm, paid_on: e.target.value })} required />
              </div>
              <div>
                <Label>Payment Type</Label>
                <Select value={editForm.payment_type} onValueChange={(val) => setEditForm({ ...editForm, payment_type: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMI">EMI</SelectItem>
                    <SelectItem value="PART_PREPAY">Partial Prepayment</SelectItem>
                    <SelectItem value="FULL_PREPAY">Full Prepayment</SelectItem>
                    <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                    <SelectItem value="OTHER_FEE">Other Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={editForm.source} onValueChange={(val) => setEditForm({ ...editForm, source: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI_PHONEPE">PhonePe</SelectItem>
                    <SelectItem value="UPI_GPAY">Google Pay</SelectItem>
                    <SelectItem value="UPI_PAYTM">Paytm</SelectItem>
                    <SelectItem value="NETBANKING">Net Banking</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Payment notes" />
              </div>
            </div>
            <ReceiptUploadField
              value={editForm.receipt_url}
              onChange={handleReceiptUpload}
              uploading={editUploadingReceipt}
              inputRef={editFileInputRef}
              isEdit={true}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={editUploadingReceipt}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of {formatINR(selectedPayment?.amount || 0)}? This action cannot be undone.
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Payments</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedPayments.size} payment(s)? This action cannot be undone.
              <br /><br />
              <strong>Total amount:</strong> {formatINR(
                payments
                  .filter(p => selectedPayments.has(p.id))
                  .reduce((sum, p) => sum + p.amount, 0)
              )}
              <br /><br />
              Loan statistics (EMIs Paid, Pending EMIs, Outstanding, etc.) will be recalculated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkOperationLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={bulkOperationLoading}
            >
              {bulkOperationLoading ? "Deleting..." : `Delete ${selectedPayments.size} Payment(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {selectedPayments.size} Payment(s)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Select the fields you want to update. Only checked fields will be modified for all selected payments.
          </p>
          <div className="space-y-4">
            {/* Payment Date */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="update-date"
                checked={bulkEditForm.updateDate}
                onCheckedChange={(checked) => setBulkEditForm({ ...bulkEditForm, updateDate: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="update-date" className="cursor-pointer font-medium">Payment Date</Label>
                <Input
                  type="date"
                  className="mt-2"
                  value={bulkEditForm.paid_on}
                  onChange={(e) => setBulkEditForm({ ...bulkEditForm, paid_on: e.target.value })}
                  disabled={!bulkEditForm.updateDate}
                />
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="update-amount"
                checked={bulkEditForm.updateAmount}
                onCheckedChange={(checked) => setBulkEditForm({ ...bulkEditForm, updateAmount: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="update-amount" className="cursor-pointer font-medium">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-2"
                  placeholder="Enter amount"
                  value={bulkEditForm.amount}
                  onChange={(e) => setBulkEditForm({ ...bulkEditForm, amount: e.target.value })}
                  disabled={!bulkEditForm.updateAmount}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="update-source"
                checked={bulkEditForm.updateSource}
                onCheckedChange={(checked) => setBulkEditForm({ ...bulkEditForm, updateSource: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="update-source" className="cursor-pointer font-medium">Payment Method</Label>
                <Select
                  value={bulkEditForm.source}
                  onValueChange={(val) => setBulkEditForm({ ...bulkEditForm, source: val })}
                  disabled={!bulkEditForm.updateSource}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI_PHONEPE">PhonePe</SelectItem>
                    <SelectItem value="UPI_GPAY">Google Pay</SelectItem>
                    <SelectItem value="UPI_PAYTM">Paytm</SelectItem>
                    <SelectItem value="NETBANKING">Net Banking</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="update-notes"
                checked={bulkEditForm.updateNotes}
                onCheckedChange={(checked) => setBulkEditForm({ ...bulkEditForm, updateNotes: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="update-notes" className="cursor-pointer font-medium">Notes</Label>
                <Input
                  className="mt-2"
                  placeholder="Enter notes (leave empty to clear)"
                  value={bulkEditForm.notes}
                  onChange={(e) => setBulkEditForm({ ...bulkEditForm, notes: e.target.value })}
                  disabled={!bulkEditForm.updateNotes}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Loan statistics will be recalculated after the update.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)} disabled={bulkOperationLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={bulkOperationLoading}>
              {bulkOperationLoading ? "Updating..." : `Update ${selectedPayments.size} Payment(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
