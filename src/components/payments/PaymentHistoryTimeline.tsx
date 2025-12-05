import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/currency";
import { format } from "date-fns";
import LenderAvatar from "@/components/lenders/LenderAvatar";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  TrendingDown,
  Wallet
} from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  paid_on: string;
  payment_type: string;
  source: string;
  notes?: string;
  loans?: {
    loan_name: string;
    logo_url?: string;
    principal_amount?: number;
    lenders?: {
      name: string;
      logo_url?: string;
    };
  };
}

interface Loan {
  id: string;
  loan_name: string;
  principal_amount: number;
  amortization_rows?: {
    opening_principal: number;
    closing_principal: number;
    is_paid: boolean;
  }[];
}

interface PaymentHistoryTimelineProps {
  payments: Payment[];
  loans: Loan[];
}

export default function PaymentHistoryTimeline({ payments, loans }: PaymentHistoryTimelineProps) {
  // Calculate total principal and running balance
  const { timelineData, totalPrincipal, totalPaid } = useMemo(() => {
    const totalPrincipal = loans.reduce((sum, loan) => sum + (loan.principal_amount || 0), 0);
    
    // Sort payments by date (oldest first for running balance calculation)
    const sortedPayments = [...payments].sort(
      (a, b) => new Date(a.paid_on).getTime() - new Date(b.paid_on).getTime()
    );
    
    let runningPaid = 0;
    const timelineData = sortedPayments.map((payment) => {
      runningPaid += payment.amount;
      const remainingBalance = Math.max(0, totalPrincipal - runningPaid);
      const percentPaid = totalPrincipal > 0 ? (runningPaid / totalPrincipal) * 100 : 0;
      
      return {
        ...payment,
        runningPaid,
        remainingBalance,
        percentPaid: Math.min(100, percentPaid),
      };
    });
    
    // Reverse for display (newest first)
    return {
      timelineData: timelineData.reverse(),
      totalPrincipal,
      totalPaid: runningPaid,
    };
  }, [payments, loans]);

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case "EMI":
        return <Clock className="h-4 w-4" />;
      case "PART_PREPAY":
      case "FULL_PREPAY":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <ArrowDownCircle className="h-4 w-4" />;
    }
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case "EMI":
        return "bg-primary/10 text-primary border-primary/20";
      case "PART_PREPAY":
      case "FULL_PREPAY":
        return "bg-success/10 text-success border-success/20";
      case "LATE_FEE":
      case "OTHER_FEE":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No payments recorded yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Record your first payment to see the timeline
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Borrowed</p>
              <p className="text-lg font-bold text-foreground">{formatINR(totalPrincipal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid</p>
              <p className="text-lg font-bold text-success">{formatINR(totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Remaining</p>
              <p className="text-lg font-bold text-destructive">
                {formatINR(Math.max(0, totalPrincipal - totalPaid))}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                style={{ width: `${Math.min(100, (totalPaid / totalPrincipal) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {((totalPaid / totalPrincipal) * 100).toFixed(1)}% of principal repaid
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-0">
              {timelineData.map((payment, idx) => (
                <div key={payment.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 bg-background ${
                    payment.payment_type === "EMI" 
                      ? "border-primary" 
                      : payment.payment_type.includes("PREPAY") 
                        ? "border-success" 
                        : "border-muted-foreground"
                  }`}>
                    {getPaymentTypeIcon(payment.payment_type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <LenderAvatar
                            name={payment.loans?.lenders?.name || payment.loans?.loan_name || "Payment"}
                            logoUrl={payment.loans?.lenders?.logo_url || payment.loans?.logo_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{payment.loans?.loan_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paid_on), "EEEE, MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-lg">{formatINR(payment.amount)}</p>
                          <Badge variant="outline" className={`text-xs ${getPaymentTypeColor(payment.payment_type)}`}>
                            {payment.payment_type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Running balance info */}
                      <div className="mt-3 pt-3 border-t border-dashed flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-muted-foreground">Cumulative: </span>
                            <span className="font-medium text-success">{formatINR(payment.runningPaid)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Balance: </span>
                            <span className="font-medium text-destructive">{formatINR(payment.remainingBalance)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${payment.percentPaid}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {payment.percentPaid.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      {payment.notes && (
                        <p className="mt-2 text-xs text-muted-foreground italic">
                          "{payment.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
