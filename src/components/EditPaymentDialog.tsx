import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface EditPaymentDialogProps {
  payment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditPaymentDialog = ({ payment, open, onOpenChange }: EditPaymentDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amount: payment.amount,
    paid_on: format(new Date(payment.paid_on), "yyyy-MM-dd"),
    payment_type: payment.payment_type,
    source: payment.source,
    method: payment.method || "",
    notes: payment.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("payments")
        .update(data)
        .eq("id", payment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update payment");
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paid_on">Date</Label>
            <Input
              id="paid_on"
              type="date"
              value={formData.paid_on}
              onChange={(e) => setFormData({ ...formData, paid_on: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_type">Payment Type</Label>
            <Select
              value={formData.payment_type}
              onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMI">EMI</SelectItem>
                <SelectItem value="PART_PREPAY">Part Prepayment</SelectItem>
                <SelectItem value="FULL_PREPAY">Full Prepayment</SelectItem>
                <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                <SelectItem value="OTHER_FEE">Other Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="NETBANKING">Net Banking</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="ACH">ACH</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <Input
              id="method"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              placeholder="e.g., PhonePe, GPay"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <DialogFooter>
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