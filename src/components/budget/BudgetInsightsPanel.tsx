import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Calendar,
  CheckCircle,
  Info
} from "lucide-react";
import { format, addMonths } from "date-fns";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string;
  current_amount: number;
  monthly_contribution: number;
}

interface BudgetInsightsPanelProps {
  totalIncome: number;
  totalEMI: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalSavings: number;
  freeCash: number;
  debtBurden: number;
  forecasts: Array<{ month: string; debtBurden: number; freeCash: number }>;
  savingsGoals: SavingsGoal[];
}

export default function BudgetInsightsPanel({
  totalIncome,
  totalEMI,
  totalFixedExpenses,
  totalVariableExpenses,
  totalSavings,
  freeCash,
  debtBurden,
  forecasts,
  savingsGoals,
}: BudgetInsightsPanelProps) {
  const insights: Array<{
    type: "info" | "warning" | "success" | "alert";
    icon: React.ElementType;
    title: string;
    description: string;
  }> = [];

  // Highest cost category analysis
  const categories = [
    { name: "EMIs", value: totalEMI },
    { name: "Fixed Expenses", value: totalFixedExpenses },
    { name: "Lifestyle", value: totalVariableExpenses },
    { name: "Savings", value: totalSavings },
  ].sort((a, b) => b.value - a.value);

  if (categories[0].value > 0 && totalIncome > 0) {
    const highestPercent = (categories[0].value / totalIncome) * 100;
    insights.push({
      type: "info",
      icon: Info,
      title: "Highest Cost Category",
      description: `Your highest cost category is ${categories[0].name} at ${formatINR(categories[0].value)} (${formatPercent(highestPercent)} of income).`,
    });
  }

  // Debt burden warning
  const highDebtMonths = forecasts.filter(f => f.debtBurden > 40).length;
  if (highDebtMonths > 0) {
    insights.push({
      type: "warning",
      icon: AlertTriangle,
      title: "High Debt Burden Alert",
      description: `Debt burden is above 40% in ${highDebtMonths} of the next 12 months. Consider reducing EMIs or increasing income.`,
    });
  }

  // Negative cash flow warning
  const negativeMonths = forecasts.filter(f => f.freeCash < 0).length;
  if (negativeMonths > 0) {
    insights.push({
      type: "alert",
      icon: AlertTriangle,
      title: "Cash Flow Warning",
      description: `You'll have negative cash flow in ${negativeMonths} months. Review your budget to avoid financial stress.`,
    });
  }

  // Savings goal predictions
  savingsGoals.forEach(goal => {
    if (goal.target_amount > 0 && goal.monthly_contribution > 0) {
      const remaining = goal.target_amount - goal.current_amount;
      const monthsNeeded = Math.ceil(remaining / goal.monthly_contribution);
      const achieveDate = addMonths(new Date(), monthsNeeded);
      
      const targetDate = new Date(goal.target_date);
      const isOnTrack = achieveDate <= targetDate;

      insights.push({
        type: isOnTrack ? "success" : "warning",
        icon: isOnTrack ? Target : Calendar,
        title: `Goal: ${goal.name}`,
        description: isOnTrack 
          ? `You'll reach your ${goal.name} goal of ${formatINR(goal.target_amount)} by ${format(achieveDate, "MMM yyyy")} - on track!`
          : `At current rate, you'll reach ${goal.name} by ${format(achieveDate, "MMM yyyy")}, which is after your target date.`,
      });
    }
  });

  // Positive insights
  if (freeCash > 0 && debtBurden < 30) {
    insights.push({
      type: "success",
      icon: CheckCircle,
      title: "Great Financial Health",
      description: `Your budget is well-balanced with ${formatINR(freeCash)} free cash and a healthy debt burden of ${formatPercent(debtBurden)}.`,
    });
  }

  // Surplus recommendation
  if (freeCash > totalIncome * 0.1) {
    insights.push({
      type: "success",
      icon: TrendingUp,
      title: "Surplus Opportunity",
      description: `You have ${formatINR(freeCash)} surplus. Consider increasing savings or making extra loan payments.`,
    });
  }

  const getIconColor = (type: string) => {
    switch (type) {
      case "success": return "text-success";
      case "warning": return "text-warning";
      case "alert": return "text-destructive";
      default: return "text-primary";
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "success": return "default" as const;
      case "warning": return "secondary" as const;
      case "alert": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  if (insights.length === 0) return null;

  return (
    <Card id="insights">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-warning" />
          Budget Insights & Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div 
              key={index} 
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className={`mt-0.5 ${getIconColor(insight.type)}`}>
                <insight.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{insight.title}</p>
                  <Badge variant={getBadgeVariant(insight.type)} className="text-[10px]">
                    {insight.type === "success" ? "Good" : insight.type === "warning" ? "Attention" : insight.type === "alert" ? "Action" : "Info"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
