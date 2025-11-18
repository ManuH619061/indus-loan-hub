import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, CreditCard, Banknote, Building2 } from "lucide-react";
import { z } from "zod";

interface QuickPaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: any;
  onPaymentComplete: () => void;
}

interface PaymentSuggestion {
  label: string;
  amount: number;
  type: string;
  description: string;
}

const PAYMENT_METHODS = [
  { id: "UPI_PHONEPE", label: "PhonePe", icon: Smartphone },
  { id: "UPI_GPAY", label: "GPay", icon: Smartphone },
  { id: "UPI_PAYTM", label: "Paytm", icon: Smartphone },
  { id: "APP_NAVI", label: "Navi App", icon: Smartphone },
  { id: "NETBANKING", label: "Net Banking", icon: Building2 },
  { id: "CARD", label: "Card", icon: CreditCard },
  { id: "CASH", label: "Cash", icon: Banknote },
];

export default function QuickPaySheet({ open, onOpenChange, loan, onPaymentComplete }: QuickPaySheetProps) {
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("UPI_PHONEPE");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && loan) {
      calculateSuggestions();
      const today = new Date();
      setNotes(`EMI ${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`);
    }
  }, [open, loan]);

  const calculateSuggestions = async () => {
    try {
      // Fetch unpaid rows
      const { data: unpaidRows } = await supabase
        .from("amortization_rows")
        .select("*")
        .eq("loan_id", loan.id)
        .eq("is_paid", false)
        .order("period_no", { ascending: true });

      // Calculate actual outstanding (last unpaid row's closing principal or sum of remaining principal)
      const outstanding = unpaidRows && unpaidRows.length > 0 
        ? Number(unpaidRows[unpaidRows.length - 1].closing_principal)
        : 0;
      const dueToday = unpaidRows?.[0]?.scheduled_emi || 0;
      
      // Calculate overdue amount (sum of all unpaid EMIs before today)
      const today = new Date();
      const overdueRows = unpaidRows?.filter(row => new Date(row.due_on) < today) || [];
      const catchUp = overdueRows.reduce((sum, row) => sum + Number(row.scheduled_emi), 0);

      const roundUp = Math.min(outstanding, Math.ceil((dueToday + 500) / 1000) * 1000);
      const prepay10 = Math.min(outstanding, outstanding * 0.10);
      const foreclosureFee = outstanding * 0.04; // Estimate 4%
      const fullClose = outstanding + foreclosureFee;

      const suggestions: PaymentSuggestion[] = [
        { label: "Due Today", amount: Math.round(dueToday * 100) / 100, type: "DUE_TODAY", description: "Current EMI" },
      ];

      if (catchUp > dueToday) {
        suggestions.push({ label: "Catch-Up", amount: Math.round(catchUp * 100) / 100, type: "CATCH_UP", description: "Clear overdue" });
      }

      suggestions.push(
        { label: "Round-Up", amount: Math.round(roundUp / 10) * 10, type: "ROUND_UP", description: "Rounded amount" },
        { label: "10% Prepay", amount: Math.round(prepay10 / 10) * 10, type: "PREPAY_10", description: "Extra prepayment" },
        { label: "Full Close", amount: Math.round(fullClose * 100) / 100, type: "FULL_CLOSE", description: "Close loan" }
      );

      setSuggestions(suggestions);
    } catch (error) {
      console.error("Error calculating suggestions:", error);
    }
  };

  const handleSuggestionClick = (suggestion: PaymentSuggestion) => {
    setAmount(suggestion.amount.toString());
    setSelectedSuggestion(suggestion.type);
  };

  const buildUPILink = (amt: number, vpa: string) => {
    const today = new Date();
    const monthYear = `${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
    const note = encodeURIComponent(`${loan.loan_name} EMI ${monthYear}`);
    const lenderName = encodeURIComponent(loan.lenders?.name || "Lender");
    
    return `upi://pay?pa=${vpa}&pn=${lenderName}&am=${amt.toFixed(2)}&cu=INR&tn=${note}`;
  };

  const paymentSchema = z.object({
    amount: z.number().positive("Amount must be positive").max(100000000, "Amount too large"),
  });

  const handlePay = async () => {
    const paymentAmount = parseFloat(amount);
    
    // Validate input
    const validationResult = paymentSchema.safeParse({ amount: paymentAmount });
    
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors[0].message;
      toast({ title: "Invalid Amount", description: errorMsg, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const isUPI = selectedMethod.startsWith("UPI_");
      const lenderUPI = loan.lenders?.upi_vpa;

      // For UPI methods, open deep link
      if (isUPI && lenderUPI) {
        const upiLink = buildUPILink(paymentAmount, lenderUPI);
        window.open(upiLink, "_blank");
      }

      // Fetch unpaid rows to allocate payment
      const { data: unpaidRows } = await supabase
        .from("amortization_rows")
        .select("*")
        .eq("loan_id", loan.id)
        .eq("is_paid", false)
        .order("period_no", { ascending: true });

      if (!unpaidRows || unpaidRows.length === 0) {
        toast({ title: "Error", description: "No unpaid installments found", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Determine payment type
      let paymentType = "EMI";
      const dueAmount = unpaidRows[0].scheduled_emi;
      let remainingAmount = paymentAmount;
      const rowsToMarkPaid = [];
      let extraPayment = 0;

      // Allocate payment to unpaid rows
      for (const row of unpaidRows) {
        if (remainingAmount <= 0) break;
        
        if (remainingAmount >= Number(row.scheduled_emi)) {
          // Full EMI payment
          rowsToMarkPaid.push(row.id);
          remainingAmount -= Number(row.scheduled_emi);
        } else {
          // Partial payment - for now, we'll just apply to first unpaid
          break;
        }
      }

      // If there's remaining amount after paying due EMIs, it's prepayment
      if (remainingAmount > 0) {
        paymentType = "PART_PREPAY";
        extraPayment = remainingAmount;
        
        // Apply extra payment to the next unpaid row
        if (rowsToMarkPaid.length < unpaidRows.length) {
          const nextRow = unpaidRows[rowsToMarkPaid.length];
          await supabase
            .from("amortization_rows")
            .update({ extra_payment: Number(nextRow.extra_payment || 0) + extraPayment })
            .eq("id", nextRow.id);
        }
      }

      // Mark rows as paid
      if (rowsToMarkPaid.length > 0) {
        await supabase
          .from("amortization_rows")
          .update({ is_paid: true })
          .in("id", rowsToMarkPaid);
      }

      // Record payment
      const { error } = await supabase.from("payments").insert({
        loan_id: loan.id,
        paid_on: new Date().toISOString().split("T")[0],
        amount: paymentAmount,
        payment_type: paymentType as any,
        source: selectedMethod as any,
        method: selectedMethod,
        gateway_app: isUPI ? selectedMethod.split("_")[1] : null,
        upi_vpa: isUPI ? lenderUPI : null,
        notes,
        suggestion_used: selectedSuggestion || "MANUAL",
      } as any);

      if (error) throw error;

      toast({ 
        title: "Payment Recorded", 
        description: `₹${paymentAmount.toFixed(2)} paid. ${rowsToMarkPaid.length} EMI(s) marked as paid${extraPayment > 0 ? ` with ₹${extraPayment.toFixed(2)} prepayment` : ''}` 
      });
      onPaymentComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loan.logo_url && (
              <img src={loan.logo_url} alt={loan.loan_name} className="w-8 h-8 rounded-full object-cover" />
            )}
            <div>
              <div className="text-lg">{loan.loan_name}</div>
              <div className="text-sm text-muted-foreground font-normal">{loan.lenders?.name}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggestions */}
          <div>
            <Label className="text-sm mb-2">Quick Amount</Label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug) => (
                <Button
                  key={sug.type}
                  variant={selectedSuggestion === sug.type ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSuggestionClick(sug)}
                  className="flex-1 min-w-[100px]"
                >
                  <div className="text-center">
                    <div className="font-semibold">{sug.label}</div>
                    <div className="text-xs">{formatINR(sug.amount)}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Amount */}
          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSelectedSuggestion(null);
              }}
              placeholder="Enter amount"
              step="0.01"
              min="0"
            />
          </div>

          {/* Paid On Date */}
          <div>
            <Label htmlFor="paid_on">Paid On *</Label>
            <Input
              id="paid_on"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              max={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          {/* Payment Method */}
          <div>
            <Label className="text-sm mb-2">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.id}
                    variant={selectedMethod === method.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMethod(method.id)}
                    className="justify-start"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment notes"
              rows={2}
            />
          </div>

          {/* Pay Button */}
          <Button onClick={handlePay} disabled={loading} className="w-full" size="lg">
            {loading ? "Processing..." : `Pay ${amount ? formatINR(parseFloat(amount)) : "Now"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
