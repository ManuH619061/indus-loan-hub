import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/currency";
import LenderMasterSelector from "@/components/LenderMasterSelector";
import AddCustomLenderDialog from "@/components/lenders/AddCustomLenderDialog";
import { 
  updateLoanWithRecalculation, 
  validateLoanFields, 
  calculateLoanEMI,
  generateLoanAmortization,
  type LoanData 
} from "@/lib/loan-service";

export default function EditLoan() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lenders, setLenders] = useState<any[]>([]);
  const [originalLoan, setOriginalLoan] = useState<LoanData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [calculatedEmi, setCalculatedEmi] = useState<number | null>(null);
  const [emisAlreadyPaid, setEmisAlreadyPaid] = useState("0");
  
  // Add lender dialog state
  const [newLenderOpen, setNewLenderOpen] = useState(false);
  const [newLenderLoading, setNewLenderLoading] = useState(false);
  const [newLenderData, setNewLenderData] = useState({
    name: "",
    type: "BANK" as const,
    logo_url: "",
    website: "",
    contact: "",
    notes: "",
  });
  
  const [formData, setFormData] = useState({
    lender_id: "",
    loan_name: "",
    loan_type: "PERSONAL",
    principal_amount: "",
    disbursed_on: "",
    tenure_months: "",
    interest_rate_apy: "",
    rate_type: "REDUCING",
    compounding: "MONTHLY",
    emi_amount: "",
    billing_day: "",
    due_day: "",
    processing_fee: "0",
    insurance_fee: "0",
    gst_on_fees: "0",
    other_upfront_costs: "0",
    auto_debit: false,
    recast_mode: "REDUCE_TENURE",
    preferred_method: "",
    remarks: "",
    status: "ACTIVE",
  });

  // Recalculate EMI when core fields change
  const recalculatePreviewEMI = useCallback(() => {
    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate_apy);
    const tenure = parseInt(formData.tenure_months);
    const rateType = formData.rate_type as 'REDUCING' | 'FLAT';

    if (principal > 0 && rate >= 0 && tenure > 0) {
      const emi = calculateLoanEMI(principal, rate, tenure, rateType);
      setCalculatedEmi(emi);
    } else {
      setCalculatedEmi(null);
    }
  }, [formData.principal_amount, formData.interest_rate_apy, formData.tenure_months, formData.rate_type]);

  useEffect(() => {
    recalculatePreviewEMI();
  }, [recalculatePreviewEMI]);

  useEffect(() => {
    if (user && id) {
      fetchLoan();
      fetchLenders();
    }
  }, [user, id]);

  const fetchLenders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lenders")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if (data) setLenders(data);
  };

  const handleAddLender = async () => {
    if (!user || !newLenderData.name.trim()) return;
    
    setNewLenderLoading(true);
    try {
      const { data, error } = await supabase
        .from("lenders")
        .insert({
          user_id: user.id,
          name: newLenderData.name.trim(),
          type: newLenderData.type,
          logo_url: newLenderData.logo_url?.trim() || null,
          website: newLenderData.website?.trim() || null,
          contact: newLenderData.contact?.trim() || null,
          notes: newLenderData.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setLenders([...lenders, data]);
      setFormData({ ...formData, lender_id: data.id });
      setNewLenderOpen(false);
      setNewLenderData({ name: "", type: "BANK", logo_url: "", website: "", contact: "", notes: "" });
      toast({ title: "Lender added successfully!" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setNewLenderLoading(false);
    }
  };

  const fetchLoan = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch current paid months count from amortization
      const { count: paidCount } = await supabase
        .from("amortization_rows")
        .select("*", { count: "exact", head: true })
        .eq("loan_id", id)
        .eq("is_paid", true);

      setEmisAlreadyPaid((paidCount || 0).toString());

      setOriginalLoan({
        id: data.id,
        user_id: data.user_id,
        principal_amount: data.principal_amount,
        interest_rate_apy: data.interest_rate_apy,
        tenure_months: data.tenure_months,
        disbursed_on: data.disbursed_on,
        due_day: data.due_day || new Date(data.disbursed_on).getDate(),
        rate_type: data.rate_type as 'REDUCING' | 'FLAT',
        emi_amount: data.emi_amount,
      });

      setFormData({
        lender_id: data.lender_id || "",
        loan_name: data.loan_name,
        loan_type: data.loan_type as any,
        principal_amount: data.principal_amount.toString(),
        disbursed_on: data.disbursed_on,
        tenure_months: data.tenure_months.toString(),
        interest_rate_apy: data.interest_rate_apy.toString(),
        rate_type: data.rate_type as any,
        compounding: data.compounding as any,
        emi_amount: data.emi_amount?.toString() || "",
        billing_day: data.billing_day?.toString() || "",
        due_day: data.due_day?.toString() || "",
        processing_fee: data.processing_fee?.toString() || "0",
        insurance_fee: data.insurance_fee?.toString() || "0",
        gst_on_fees: data.gst_on_fees?.toString() || "0",
        other_upfront_costs: data.other_upfront_costs?.toString() || "0",
        auto_debit: data.auto_debit || false,
        recast_mode: (data.recast_mode || "REDUCE_TENURE") as any,
        preferred_method: data.preferred_method || "",
        remarks: data.remarks || "",
        status: data.status as any,
      });
    } catch (error: any) {
      console.error("Error fetching loan:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
      navigate("/loans");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !originalLoan) return;

    // Validate required fields
    const validation = validateLoanFields(formData);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      toast({ 
        variant: "destructive", 
        title: "Validation Error", 
        description: "Please fix all required fields before saving" 
      });
      return;
    }

    const emisPaid = parseInt(emisAlreadyPaid) || 0;
    const tenure = parseInt(formData.tenure_months) || 0;
    
    if (emisPaid < 0 || emisPaid > tenure) {
      toast({ 
        variant: "destructive", 
        title: "Invalid Value", 
        description: `EMIs Already Paid must be between 0 and ${tenure}` 
      });
      return;
    }

    setValidationErrors([]);
    setSaving(true);

    try {
      const updates = {
        lender_id: formData.lender_id || null,
        loan_name: formData.loan_name,
        loan_type: formData.loan_type as any,
        principal_amount: parseFloat(formData.principal_amount),
        disbursed_on: formData.disbursed_on,
        tenure_months: parseInt(formData.tenure_months),
        interest_rate_apy: parseFloat(formData.interest_rate_apy),
        rate_type: formData.rate_type as 'REDUCING' | 'FLAT',
        compounding: formData.compounding as any,
        emi_amount: formData.emi_amount ? parseFloat(formData.emi_amount) : undefined,
        billing_day: formData.billing_day ? parseInt(formData.billing_day) : null,
        due_day: formData.due_day ? parseInt(formData.due_day) : null,
        processing_fee: parseFloat(formData.processing_fee),
        insurance_fee: parseFloat(formData.insurance_fee),
        gst_on_fees: parseFloat(formData.gst_on_fees),
        other_upfront_costs: parseFloat(formData.other_upfront_costs),
        auto_debit: formData.auto_debit,
        recast_mode: formData.recast_mode as any,
        preferred_method: formData.preferred_method || null,
        remarks: formData.remarks || null,
        status: formData.status as any,
      };

      // Step 1: Update loan and rebuild amortization schedule
      const result = await updateLoanWithRecalculation(id, updates, originalLoan);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Step 2: Delete old auto-backfill payments (keep manual payments)
      const { error: deletePaymentsError } = await supabase
        .from("payments")
        .delete()
        .eq("loan_id", id)
        .eq("payment_type", "EMI")
        .ilike("notes", "%Auto Backfill%");

      if (deletePaymentsError) {
        console.error("Error deleting old backfill payments:", deletePaymentsError);
      }

      // Step 3: Get the newly generated amortization rows
      const { data: amortRows, error: amortError } = await supabase
        .from("amortization_rows")
        .select("*")
        .eq("loan_id", id)
        .order("period_no", { ascending: true });

      if (amortError) throw amortError;

      if (amortRows && emisPaid > 0) {
        // Step 4: Create N payment records based on EMIs Already Paid
        const rowsToPay = amortRows.slice(0, emisPaid);
        
        const newPayments = rowsToPay.map((row) => ({
          loan_id: id,
          paid_on: row.due_on,
          amount: row.scheduled_emi,
          payment_type: "EMI" as const,
          source: "OTHER" as const,
          reference: `Period ${row.period_no} - Principal: ₹${row.principal_component.toLocaleString('en-IN')}, Interest: ₹${row.interest_component.toLocaleString('en-IN')}`,
          notes: `Auto Backfill - EMI ${row.period_no}/${tenure}`,
        }));

        if (newPayments.length > 0) {
          const { error: paymentError } = await supabase
            .from("payments")
            .insert(newPayments);

          if (paymentError) throw paymentError;
        }

        // Step 5: Mark the first N amortization rows as paid
        const rowIds = rowsToPay.map(r => r.id);
        const { error: markPaidError } = await supabase
          .from("amortization_rows")
          .update({ is_paid: true })
          .in("id", rowIds);

        if (markPaidError) throw markPaidError;

        // Mark remaining rows as unpaid
        const unpaidRowIds = amortRows.slice(emisPaid).map(r => r.id);
        if (unpaidRowIds.length > 0) {
          await supabase
            .from("amortization_rows")
            .update({ is_paid: false })
            .in("id", unpaidRowIds);
        }
      } else if (amortRows) {
        // Reset all rows to unpaid if emisPaid is 0
        const allRowIds = amortRows.map(r => r.id);
        await supabase
          .from("amortization_rows")
          .update({ is_paid: false })
          .in("id", allRowIds);
      }

      toast({ 
        title: "Loan Updated Successfully!", 
        description: emisPaid > 0 
          ? `EMI schedule recalculated and ${emisPaid} payment(s) auto-backfilled.`
          : "EMI schedule and all calculations have been recalculated."
      });
      navigate(`/loans/${id}`);
    } catch (error: any) {
      console.error("Error updating loan:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/loans/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Loan</h1>
          <p className="text-muted-foreground">Update loan details - all calculations will be recalculated automatically</p>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
            <CardDescription>Update the information for this loan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lender</Label>
                <LenderMasterSelector
                  value={formData.lender_id}
                  onValueChange={(value) => setFormData({ ...formData, lender_id: value })}
                  onAddNew={() => setNewLenderOpen(true)}
                />
              </div>

              <div className="space-y-2">
                <Label>Loan Name *</Label>
                <Input
                  required
                  value={formData.loan_name}
                  onChange={(e) => setFormData({ ...formData, loan_name: e.target.value })}
                  placeholder="e.g., Personal Loan - Home Renovation"
                />
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="DEFAULTED">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loan Type *</Label>
                <Select
                  value={formData.loan_type}
                  onValueChange={(value: any) => setFormData({ ...formData, loan_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                    <SelectItem value="CREDIT_CARD_CONVERSION">Credit Card EMI</SelectItem>
                    <SelectItem value="CONSUMER_DURABLE">Consumer Durable</SelectItem>
                    <SelectItem value="EDUCATION">Education Loan</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                    <SelectItem value="HOME_TOPUP">Home Top-up</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount (₹) *</Label>
                  <Input
                    required
                    type="number"
                    value={formData.principal_amount}
                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Disbursed On *</Label>
                  <Input
                    required
                    type="date"
                    value={formData.disbursed_on}
                    onChange={(e) => setFormData({ ...formData, disbursed_on: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tenure (Months) *</Label>
                  <Input
                    required
                    type="number"
                    value={formData.tenure_months}
                    onChange={(e) => setFormData({ ...formData, tenure_months: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (% p.a.) *</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_apy}
                    onChange={(e) => setFormData({ ...formData, interest_rate_apy: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>EMI Amount (₹)</Label>
                  <Input
                    type="number"
                    value={formData.emi_amount}
                    onChange={(e) => setFormData({ ...formData, emi_amount: e.target.value })}
                    placeholder={calculatedEmi ? `Calculated: ₹${calculatedEmi.toLocaleString('en-IN')}` : "Auto-calculated"}
                  />
                  {calculatedEmi && !formData.emi_amount && (
                    <p className="text-xs text-muted-foreground">
                      Will use calculated EMI: ₹{calculatedEmi.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Rate Type *</Label>
                  <Select
                    value={formData.rate_type}
                    onValueChange={(value: any) => setFormData({ ...formData, rate_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REDUCING">Reducing Balance</SelectItem>
                      <SelectItem value="FLAT">Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.due_day}
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                    placeholder="Day of month (1-28)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.billing_day}
                    onChange={(e) => setFormData({ ...formData, billing_day: e.target.value })}
                    placeholder="Day of month (1-28)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Add any notes or remarks about this loan"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.auto_debit}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_debit: checked })}
                />
                <Label>Auto-debit enabled</Label>
              </div>

              {/* Payment Tracking Section */}
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Payment Tracking</Badge>
                    <span className="text-sm text-muted-foreground">Set how many EMIs have been paid</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>EMIs Already Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    max={parseInt(formData.tenure_months) || 999}
                    value={emisAlreadyPaid}
                    onChange={(e) => setEmisAlreadyPaid(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    On save, this will auto-create {emisAlreadyPaid || 0} payment record(s) with correct principal/interest split and mark them as paid.
                  </p>
                </div>

                {/* Preview of what will happen */}
                {parseInt(emisAlreadyPaid) > 0 && calculatedEmi && (
                  <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                    <p className="text-sm font-medium text-primary mb-2">
                      Will auto-backfill {emisAlreadyPaid} EMI payment(s)
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">EMI Amount:</span>
                        <span className="font-medium">{formatINR(calculatedEmi)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Paid:</span>
                        <span className="font-medium">
                          {formatINR(parseInt(emisAlreadyPaid) * calculatedEmi)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining EMIs:</span>
                        <span className="font-medium">
                          {Math.max(0, parseInt(formData.tenure_months || "0") - parseInt(emisAlreadyPaid))} months
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recalculating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save & Recalculate
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/loans/${id}`)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Add Lender Dialog */}
      <AddCustomLenderDialog
        open={newLenderOpen}
        onOpenChange={setNewLenderOpen}
        lenderData={newLenderData}
        onDataChange={setNewLenderData}
        onSubmit={handleAddLender}
        loading={newLenderLoading}
      />
    </div>
  );
}
