import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Validation schema
const loanEditSchema = z.object({
  loan_name: z.string().trim().min(1, "Loan name is required").max(100, "Loan name must be less than 100 characters"),
  principal_amount: z.number().positive("Principal must be positive").max(100000000, "Amount too large"),
  tenure_months: z.number().int().positive("Tenure must be positive").max(600, "Tenure cannot exceed 600 months"),
  interest_rate_apy: z.number().min(0, "Interest rate cannot be negative").max(100, "Interest rate cannot exceed 100%"),
  processing_fee: z.number().min(0, "Processing fee cannot be negative").optional(),
  insurance_fee: z.number().min(0, "Insurance fee cannot be negative").optional(),
  gst_on_fees: z.number().min(0, "GST cannot be negative").optional(),
  other_upfront_costs: z.number().min(0, "Other costs cannot be negative").optional(),
  billing_day: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  remarks: z.string().max(500, "Remarks must be less than 500 characters").optional(),
});

interface EditLoanDialogProps {
  loan: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditLoanDialog = ({ loan, open, onOpenChange }: EditLoanDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    loan_name: loan.loan_name || "",
    loan_type: loan.loan_type || "PERSONAL",
    principal_amount: loan.principal_amount?.toString() || "",
    disbursed_on: format(new Date(loan.disbursed_on), "yyyy-MM-dd"),
    tenure_months: loan.tenure_months?.toString() || "",
    interest_rate_apy: loan.interest_rate_apy?.toString() || "",
    rate_type: loan.rate_type || "REDUCING",
    compounding: loan.compounding || "MONTHLY",
    billing_day: loan.billing_day?.toString() || "",
    due_day: loan.due_day?.toString() || "",
    processing_fee: loan.processing_fee?.toString() || "0",
    insurance_fee: loan.insurance_fee?.toString() || "0",
    gst_on_fees: loan.gst_on_fees?.toString() || "0",
    other_upfront_costs: loan.other_upfront_costs?.toString() || "0",
    auto_debit: loan.auto_debit || false,
    autopay_bank: loan.autopay_bank || "",
    recast_mode: loan.recast_mode || "REDUCE_TENURE",
    preferred_method: loan.preferred_method || "",
    remarks: loan.remarks || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loan) {
      setFormData({
        loan_name: loan.loan_name || "",
        loan_type: loan.loan_type || "PERSONAL",
        principal_amount: loan.principal_amount?.toString() || "",
        disbursed_on: format(new Date(loan.disbursed_on), "yyyy-MM-dd"),
        tenure_months: loan.tenure_months?.toString() || "",
        interest_rate_apy: loan.interest_rate_apy?.toString() || "",
        rate_type: loan.rate_type || "REDUCING",
        compounding: loan.compounding || "MONTHLY",
        billing_day: loan.billing_day?.toString() || "",
        due_day: loan.due_day?.toString() || "",
        processing_fee: loan.processing_fee?.toString() || "0",
        insurance_fee: loan.insurance_fee?.toString() || "0",
        gst_on_fees: loan.gst_on_fees?.toString() || "0",
        other_upfront_costs: loan.other_upfront_costs?.toString() || "0",
        auto_debit: loan.auto_debit || false,
        autopay_bank: loan.autopay_bank || "",
        recast_mode: loan.recast_mode || "REDUCE_TENURE",
        preferred_method: loan.preferred_method || "",
        remarks: loan.remarks || "",
      });
    }
  }, [loan]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate data
      const validatedData = loanEditSchema.parse({
        loan_name: data.loan_name,
        principal_amount: parseFloat(data.principal_amount),
        tenure_months: parseInt(data.tenure_months),
        interest_rate_apy: parseFloat(data.interest_rate_apy),
        processing_fee: parseFloat(data.processing_fee || "0"),
        insurance_fee: parseFloat(data.insurance_fee || "0"),
        gst_on_fees: parseFloat(data.gst_on_fees || "0"),
        other_upfront_costs: parseFloat(data.other_upfront_costs || "0"),
        billing_day: data.billing_day ? parseInt(data.billing_day) : undefined,
        due_day: data.due_day ? parseInt(data.due_day) : undefined,
        remarks: data.remarks,
      });

      const updateData = {
        loan_name: validatedData.loan_name,
        loan_type: data.loan_type,
        principal_amount: validatedData.principal_amount,
        disbursed_on: data.disbursed_on,
        tenure_months: validatedData.tenure_months,
        interest_rate_apy: validatedData.interest_rate_apy,
        rate_type: data.rate_type,
        compounding: data.compounding,
        billing_day: validatedData.billing_day,
        due_day: validatedData.due_day,
        processing_fee: validatedData.processing_fee,
        insurance_fee: validatedData.insurance_fee,
        gst_on_fees: validatedData.gst_on_fees,
        other_upfront_costs: validatedData.other_upfront_costs,
        auto_debit: data.auto_debit,
        autopay_bank: data.autopay_bank || null,
        recast_mode: data.recast_mode,
        preferred_method: data.preferred_method || null,
        remarks: validatedData.remarks || null,
      };

      const { error } = await supabase
        .from("loans")
        .update(updateData)
        .eq("id", loan.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", loan.id] });
      toast.success("Loan updated successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error("Please fix validation errors");
      } else {
        toast.error("Failed to update loan");
        console.error(error);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Loan</DialogTitle>
          <DialogDescription>Update loan details. Changes will be saved to your records.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="fees">Fees & Charges</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="loan_name">Loan Name *</Label>
                <Input
                  id="loan_name"
                  value={formData.loan_name}
                  onChange={(e) => setFormData({ ...formData, loan_name: e.target.value })}
                  maxLength={100}
                  required
                />
                {errors.loan_name && <p className="text-xs text-destructive">{errors.loan_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="loan_type">Loan Type</Label>
                  <Select value={formData.loan_type} onValueChange={(value) => setFormData({ ...formData, loan_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                      <SelectItem value="CREDIT_CARD_CONVERSION">Credit Card Conversion</SelectItem>
                      <SelectItem value="CONSUMER_DURABLE">Consumer Durable</SelectItem>
                      <SelectItem value="EDUCATION">Education Loan</SelectItem>
                      <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                      <SelectItem value="HOME_TOPUP">Home Top-up</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disbursed_on">Disbursement Date *</Label>
                  <Input
                    id="disbursed_on"
                    type="date"
                    value={formData.disbursed_on}
                    onChange={(e) => setFormData({ ...formData, disbursed_on: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="principal_amount">Principal Amount *</Label>
                  <Input
                    id="principal_amount"
                    type="number"
                    step="0.01"
                    value={formData.principal_amount}
                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                    required
                  />
                  {errors.principal_amount && <p className="text-xs text-destructive">{errors.principal_amount}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenure_months">Tenure (Months) *</Label>
                  <Input
                    id="tenure_months"
                    type="number"
                    value={formData.tenure_months}
                    onChange={(e) => setFormData({ ...formData, tenure_months: e.target.value })}
                    required
                  />
                  {errors.tenure_months && <p className="text-xs text-destructive">{errors.tenure_months}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="interest_rate_apy">Interest Rate (% p.a.) *</Label>
                  <Input
                    id="interest_rate_apy"
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_apy}
                    onChange={(e) => setFormData({ ...formData, interest_rate_apy: e.target.value })}
                    required
                  />
                  {errors.interest_rate_apy && <p className="text-xs text-destructive">{errors.interest_rate_apy}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate_type">Rate Type</Label>
                  <Select value={formData.rate_type} onValueChange={(value) => setFormData({ ...formData, rate_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REDUCING">Reducing</SelectItem>
                      <SelectItem value="FLAT">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="compounding">Compounding</Label>
                  <Select value={formData.compounding} onValueChange={(value) => setFormData({ ...formData, compounding: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recast_mode">Prepayment Mode</Label>
                  <Select value={formData.recast_mode} onValueChange={(value) => setFormData({ ...formData, recast_mode: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REDUCE_TENURE">Reduce Tenure</SelectItem>
                      <SelectItem value="REDUCE_EMI">Reduce EMI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="processing_fee">Processing Fee</Label>
                  <Input
                    id="processing_fee"
                    type="number"
                    step="0.01"
                    value={formData.processing_fee}
                    onChange={(e) => setFormData({ ...formData, processing_fee: e.target.value })}
                  />
                  {errors.processing_fee && <p className="text-xs text-destructive">{errors.processing_fee}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insurance_fee">Insurance Fee</Label>
                  <Input
                    id="insurance_fee"
                    type="number"
                    step="0.01"
                    value={formData.insurance_fee}
                    onChange={(e) => setFormData({ ...formData, insurance_fee: e.target.value })}
                  />
                  {errors.insurance_fee && <p className="text-xs text-destructive">{errors.insurance_fee}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gst_on_fees">GST on Fees</Label>
                  <Input
                    id="gst_on_fees"
                    type="number"
                    step="0.01"
                    value={formData.gst_on_fees}
                    onChange={(e) => setFormData({ ...formData, gst_on_fees: e.target.value })}
                  />
                  {errors.gst_on_fees && <p className="text-xs text-destructive">{errors.gst_on_fees}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="other_upfront_costs">Other Upfront Costs</Label>
                  <Input
                    id="other_upfront_costs"
                    type="number"
                    step="0.01"
                    value={formData.other_upfront_costs}
                    onChange={(e) => setFormData({ ...formData, other_upfront_costs: e.target.value })}
                  />
                  {errors.other_upfront_costs && <p className="text-xs text-destructive">{errors.other_upfront_costs}</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="billing_day">Billing Day (1-31)</Label>
                  <Input
                    id="billing_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.billing_day}
                    onChange={(e) => setFormData({ ...formData, billing_day: e.target.value })}
                  />
                  {errors.billing_day && <p className="text-xs text-destructive">{errors.billing_day}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_day">Due Day (1-31)</Label>
                  <Input
                    id="due_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.due_day}
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  />
                  {errors.due_day && <p className="text-xs text-destructive">{errors.due_day}</p>}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_debit"
                  checked={formData.auto_debit}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_debit: checked })}
                />
                <Label htmlFor="auto_debit">Auto Debit Enabled</Label>
              </div>

              {formData.auto_debit && (
                <div className="space-y-2">
                  <Label htmlFor="autopay_bank">Autopay Bank</Label>
                  <Input
                    id="autopay_bank"
                    value={formData.autopay_bank}
                    onChange={(e) => setFormData({ ...formData, autopay_bank: e.target.value })}
                    placeholder="e.g., HDFC Bank"
                    maxLength={100}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="preferred_method">Preferred Payment Method</Label>
                <Input
                  id="preferred_method"
                  value={formData.preferred_method}
                  onChange={(e) => setFormData({ ...formData, preferred_method: e.target.value })}
                  placeholder="e.g., UPI, Net Banking"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional notes about this loan"
                  rows={4}
                  maxLength={500}
                />
                {errors.remarks && <p className="text-xs text-destructive">{errors.remarks}</p>}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};