import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/currency";
import { Calculator, ArrowRight, Zap, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DebtPayoffSummaryProps {
  freeCash: number;
  totalEMI: number;
  loansCount: number;
}

export default function DebtPayoffSummary({
  freeCash,
  totalEMI,
  loansCount,
}: DebtPayoffSummaryProps) {
  const navigate = useNavigate();
  
  // Calculate how much can be used for extra prepayments (leaving some buffer)
  const extraPaymentPotential = Math.max(0, freeCash * 0.7); // 70% of free cash

  if (loansCount === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Debt Payoff Potential
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-background/80 border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingDown className="h-4 w-4" />
              Monthly EMI Load
            </div>
            <p className="text-xl font-bold text-primary">{formatINR(totalEMI)}</p>
            <p className="text-xs text-muted-foreground">{loansCount} active loan(s)</p>
          </div>
          
          <div className="p-4 rounded-lg bg-background/80 border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Zap className="h-4 w-4" />
              Extra Payment Potential
            </div>
            <p className={`text-xl font-bold ${extraPaymentPotential > 0 ? "text-success" : "text-muted-foreground"}`}>
              {formatINR(extraPaymentPotential)}
            </p>
            <p className="text-xs text-muted-foreground">
              {extraPaymentPotential > 0 
                ? "Available for prepayments" 
                : "No surplus available"}
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-background/80 border flex flex-col justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Strategy Tip</p>
              <p className="text-sm">
                {extraPaymentPotential > totalEMI * 0.1 
                  ? "You can accelerate debt payoff with extra payments!"
                  : "Focus on building surplus before extra payments."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            With this budget, you can afford extra prepayments up to{" "}
            <span className="font-semibold text-foreground">{formatINR(extraPaymentPotential)}</span> per month.
          </p>
          <Button onClick={() => navigate("/budget/debt-optimizer")} className="gap-2">
            Open Debt Payoff Calculator
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
