import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/currency";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

interface BudgetHealthWidgetsProps {
  totalIncome: number;
  totalEMI: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalSavings: number;
  freeCash: number;
}

export default function BudgetHealthWidgets({
  totalIncome,
  totalEMI,
  totalFixedExpenses,
  totalVariableExpenses,
  totalSavings,
  freeCash,
}: BudgetHealthWidgetsProps) {
  // Calculate Budget Health Score (0-100)
  const calculateHealthScore = () => {
    if (totalIncome <= 0) return 0;
    
    let score = 100;
    
    // Debt burden penalty (EMI/Income)
    const debtBurden = (totalEMI / totalIncome) * 100;
    if (debtBurden > 50) score -= 40;
    else if (debtBurden > 40) score -= 25;
    else if (debtBurden > 30) score -= 10;
    
    // Negative free cash penalty
    if (freeCash < 0) {
      const deficitPercent = (Math.abs(freeCash) / totalIncome) * 100;
      score -= Math.min(deficitPercent, 30);
    }
    
    // Savings bonus
    const savingsPercent = (totalSavings / totalIncome) * 100;
    if (savingsPercent >= 20) score += 5;
    else if (savingsPercent < 10) score -= 10;
    
    // Variable expenses check
    const variablePercent = (totalVariableExpenses / totalIncome) * 100;
    if (variablePercent > 30) score -= 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const healthScore = calculateHealthScore();
  
  const getHealthStatus = () => {
    if (healthScore >= 80) return { text: "Excellent", color: "text-success", bg: "bg-success" };
    if (healthScore >= 60) return { text: "Good", color: "text-primary", bg: "bg-primary" };
    if (healthScore >= 40) return { text: "Caution", color: "text-warning", bg: "bg-warning" };
    return { text: "Critical", color: "text-destructive", bg: "bg-destructive" };
  };

  const healthStatus = getHealthStatus();

  // Prepare data for donut chart
  const chartData = [
    { name: "EMIs", value: totalEMI, color: "hsl(var(--primary))" },
    { name: "Fixed Expenses", value: totalFixedExpenses, color: "hsl(var(--secondary))" },
    { name: "Lifestyle", value: totalVariableExpenses, color: "hsl(var(--accent))" },
    { name: "Savings", value: totalSavings, color: "hsl(var(--success))" },
    { name: "Free Cash", value: Math.max(0, freeCash), color: "hsl(var(--muted))" },
  ].filter(item => item.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Budget Health Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Budget Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-muted"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={healthStatus.color}
                  strokeWidth="3"
                  strokeDasharray={`${healthScore}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{healthScore}</span>
              </div>
            </div>
            <div>
              <p className={`text-lg font-semibold ${healthStatus.color}`}>{healthStatus.text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {healthScore >= 80 ? "Your budget is well-balanced" :
                 healthScore >= 60 ? "Room for improvement" :
                 healthScore >= 40 ? "Review your spending" :
                 "Immediate action needed"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Where Your Money Goes - Donut Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Where Your Money Goes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Surplus / Deficit Warning */}
      <Card className={freeCash >= 0 ? "border-success/50" : "border-destructive/50"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {freeCash >= 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            {freeCash >= 0 ? "Surplus" : "Deficit"} Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {freeCash >= 0 ? (
                <TrendingUp className="h-8 w-8 text-success" />
              ) : (
                <TrendingDown className="h-8 w-8 text-destructive" />
              )}
              <div>
                <p className={`text-2xl font-bold ${freeCash >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatINR(Math.abs(freeCash))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {freeCash >= 0 ? "Available to save or spend" : "Short by this amount"}
                </p>
              </div>
            </div>
            
            <p className="text-sm">
              {freeCash >= 0 ? (
                <span className="text-success">
                  You can still save {formatINR(freeCash)} this month!
                </span>
              ) : (
                <span className="text-destructive">
                  You are short by {formatINR(Math.abs(freeCash))}. Review expenses.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
