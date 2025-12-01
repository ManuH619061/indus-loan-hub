import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";

interface SummaryStepProps {
  totalIncome: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalEMI: number;
  totalSavings: number;
  freeCash: number;
  debtBurden: number;
}

export default function SummaryStep({
  totalIncome,
  totalFixedExpenses,
  totalVariableExpenses,
  totalEMI,
  totalSavings,
  freeCash,
  debtBurden,
}: SummaryStepProps) {
  const totalExpenses = totalFixedExpenses + totalVariableExpenses;
  const totalOutflow = totalExpenses + totalEMI + totalSavings;

  const fixedPercent = totalIncome > 0 ? (totalFixedExpenses / totalIncome) * 100 : 0;
  const variablePercent = totalIncome > 0 ? (totalVariableExpenses / totalIncome) * 100 : 0;
  const emiPercent = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;
  const savingsPercent = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const isHealthy = freeCash >= 0 && debtBurden < 40;
  const isWarning = freeCash < 0 || (debtBurden >= 40 && debtBurden < 50);
  const isCritical = debtBurden >= 50;

  return (
    <div className="space-y-6">
      <Card className={isHealthy ? "border-success" : isWarning ? "border-warning" : "border-destructive"}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Budget Summary</span>
            {isHealthy ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-success">{formatINR(totalIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold">{formatINR(totalExpenses)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">EMI Payments</p>
              <p className="text-2xl font-bold text-primary">{formatINR(totalEMI)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Savings</p>
              <p className="text-2xl font-bold text-accent">{formatINR(totalSavings)}</p>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Free Cash Flow</p>
                <p
                  className={`text-3xl font-bold ${
                    freeCash >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {formatINR(freeCash)}
                  {freeCash >= 0 ? (
                    <TrendingUp className="inline h-6 w-6 ml-2" />
                  ) : (
                    <TrendingDown className="inline h-6 w-6 ml-2" />
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Debt Burden</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{formatPercent(debtBurden)}</p>
                  <Badge
                    variant={
                      debtBurden < 40 ? "default" : debtBurden < 50 ? "secondary" : "destructive"
                    }
                  >
                    {debtBurden < 40 ? "Healthy" : debtBurden < 50 ? "Warning" : "Critical"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fixed Expenses</span>
                <span className="font-medium">
                  {formatINR(totalFixedExpenses)} ({fixedPercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={fixedPercent} className="h-3 bg-muted" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Variable Expenses</span>
                <span className="font-medium">
                  {formatINR(totalVariableExpenses)} ({variablePercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={variablePercent} className="h-3 bg-muted" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>EMI Payments</span>
                <span className="font-medium">
                  {formatINR(totalEMI)} ({emiPercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={emiPercent} className="h-3 bg-primary/20" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Savings & Investments</span>
                <span className="font-medium">
                  {formatINR(totalSavings)} ({savingsPercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={savingsPercent} className="h-3 bg-accent/20" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between font-semibold">
              <span>Total Outflow</span>
              <span>{formatINR(totalOutflow)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isHealthy && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {freeCash < 0 && (
              <p>• Your expenses exceed your income by {formatINR(Math.abs(freeCash))}. Consider reducing variable expenses or increasing income.</p>
            )}
            {debtBurden >= 50 && (
              <p>• Your debt burden is critical at {formatPercent(debtBurden)}. Prioritize debt repayment and avoid new loans.</p>
            )}
            {debtBurden >= 40 && debtBurden < 50 && (
              <p>• Your debt burden is elevated at {formatPercent(debtBurden)}. Consider aggressive debt repayment strategies.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
