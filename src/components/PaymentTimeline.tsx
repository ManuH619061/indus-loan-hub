import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { Smartphone, CreditCard, Banknote, Building2, Clock } from "lucide-react";
import { Badge } from "./ui/badge";

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  UPI_PHONEPE: Smartphone,
  UPI_GPAY: Smartphone,
  UPI_PAYTM: Smartphone,
  APP_NAVI: Smartphone,
  NETBANKING: Building2,
  CARD: CreditCard,
  CASH: Banknote,
};

interface PaymentWithBalance {
  id: string;
  amount: number;
  paid_on: string;
  method: string | null;
  gateway_app: string | null;
  payment_type: string;
  notes: string | null;
  balanceAfter: number;
}

export default function PaymentTimeline({ loanId }: { loanId: string }) {
  const [payments, setPayments] = useState<PaymentWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentHistory();
  }, [loanId]);

  const fetchPaymentHistory = async () => {
    try {
      // Fetch all payments for this loan
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("loan_id", loanId)
        .order("paid_on", { ascending: true });

      if (paymentsError) throw paymentsError;

      // Fetch amortization schedule to calculate balances
      const { data: amortData, error: amortError } = await supabase
        .from("amortization_rows")
        .select("*")
        .eq("loan_id", loanId)
        .order("period_no", { ascending: true });

      if (amortError) throw amortError;

      // Fetch loan details for initial principal
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("principal_amount")
        .eq("id", loanId)
        .single();

      if (loanError) throw loanError;

      // Calculate running balance for each payment
      let runningBalance = loanData.principal_amount;
      const paymentsWithBalance: PaymentWithBalance[] = [];

      for (const payment of paymentsData || []) {
        // Subtract payment amount from balance
        runningBalance -= payment.amount;
        
        paymentsWithBalance.push({
          ...payment,
          balanceAfter: Math.max(0, runningBalance),
        });
      }

      // Reverse to show most recent first
      setPayments(paymentsWithBalance.reverse());
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No payments recorded yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-border" />

      <div className="space-y-6">
        {payments.map((payment, index) => {
          const Icon = PAYMENT_METHOD_ICONS[payment.method || ""] || Building2;
          const isLast = index === payments.length - 1;

          return (
            <div key={payment.id} className="relative pl-16">
              {/* Timeline dot */}
              <div className="absolute left-6 top-2 w-4 h-4 rounded-full bg-primary border-4 border-background" />

              <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={payment.payment_type === "PART_PREPAY" ? "secondary" : "default"}>
                        {payment.payment_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(payment.paid_on).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {formatINR(payment.amount)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Balance After</div>
                    <div className="text-lg font-semibold">
                      {formatINR(payment.balanceAfter)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {payment.method && (
                    <div className="flex items-center gap-1">
                      <Icon className="h-4 w-4" />
                      <span>{payment.gateway_app || payment.method.replace("_", " ")}</span>
                    </div>
                  )}
                  {payment.notes && (
                    <div className="flex-1 text-xs italic">{payment.notes}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
