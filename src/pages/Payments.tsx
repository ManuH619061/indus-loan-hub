import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Smartphone, CreditCard, Banknote, Building2 } from "lucide-react";

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  UPI_PHONEPE: Smartphone,
  UPI_GPAY: Smartphone,
  UPI_PAYTM: Smartphone,
  APP_NAVI: Smartphone,
  NETBANKING: Building2,
  CARD: CreditCard,
  CASH: Banknote,
};

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          loans!inner (
            loan_name,
            logo_url,
            user_id,
            lenders (name, logo_url)
          )
        `)
        .order("paid_on", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track and manage your loan payments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No payments recorded yet. Start by recording a payment for your loans.
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const Icon = PAYMENT_METHOD_ICONS[payment.method] || Building2;
                const loanLogo = payment.loans?.logo_url || payment.loans?.lenders?.logo_url;
                
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {loanLogo && (
                        <img
                          src={loanLogo}
                          alt="Logo"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{payment.loans?.loan_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(payment.paid_on).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {payment.method && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs">
                            {payment.gateway_app || payment.method.replace("_", " ")}
                          </span>
                        </div>
                      )}
                      <Badge variant={payment.payment_type === "PART_PREPAY" ? "secondary" : "default"}>
                        {payment.payment_type}
                      </Badge>
                      <div className="text-lg font-bold min-w-[100px] text-right">
                        {formatINR(payment.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
