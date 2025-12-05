import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency";
import { format, addDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Wallet,
  Flame,
  Snowflake,
  Loader2,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CashflowStatus {
  status: "healthy" | "warning" | "critical" | "danger";
  message: string;
  score: number;
}

interface SpendingInsight {
  category: string;
  amount: number;
  trend: "up" | "down" | "stable";
  percentChange: number;
  suggestion?: string;
}

interface PrepaymentOpportunity {
  loanId: string;
  loanName: string;
  safeAmount: number;
  interestSaved: number;
  tenureReduction: number;
}

interface FreezeSpendSuggestion {
  id: string;
  category: string;
  action: string;
  duration: string;
  potentialSavings: number;
}

export const CashflowGuardian = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [cashflowStatus, setCashflowStatus] = useState<CashflowStatus>({
    status: "healthy",
    message: "Your finances are on track",
    score: 75
  });
  const [spendingInsights, setSpendingInsights] = useState<SpendingInsight[]>([]);
  const [prepayOpportunity, setPrepayOpportunity] = useState<PrepaymentOpportunity | null>(null);
  const [freezeSuggestions, setFreezeSuggestions] = useState<FreezeSpendSuggestion[]>([]);
  const [insolvencyRisk, setInsolvencyRisk] = useState<{
    months: number | null;
    riskLevel: "low" | "medium" | "high" | "critical";
    reason: string;
  } | null>(null);

  // Financial metrics
  const [metrics, setMetrics] = useState({
    monthlyIncome: 0,
    totalEMIs: 0,
    avgDailySpend: 0,
    projectedSpend: 0,
    surplus: 0,
    daysRemaining: 0,
    budgetUsed: 0
  });

  const analyzeRealtime = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
      const daysPassed = differenceInDays(today, monthStart) + 1;
      const daysRemaining = daysInMonth - daysPassed;

      // Fetch current month budget
      const currentMonth = format(today, "yyyy-MM");
      const { data: budget } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .single();

      // Fetch this month's expenses
      const { data: expenses } = await supabase
        .from("monthly_expenses")
        .select("amount, expense_date, group_id, expense_groups(name)")
        .eq("user_id", user.id)
        .gte("expense_date", monthStart.toISOString().split("T")[0])
        .lte("expense_date", monthEnd.toISOString().split("T")[0]);

      // Fetch active loans with amortization
      const { data: loans } = await supabase
        .from("loans")
        .select(`
          id, loan_name, emi_amount, interest_rate_apy, principal_amount,
          amortization_rows (due_on, is_paid, opening_principal, interest_component, scheduled_emi)
        `)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      // Calculate metrics
      const monthlyIncome = budget 
        ? Number(budget.salary || 0) + Number(budget.side_income || 0) + Number(budget.other_income || 0)
        : 0;

      const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const avgDailySpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
      const projectedSpend = avgDailySpend * daysInMonth;

      // Calculate total EMIs due this month
      let totalEMIs = 0;
      loans?.forEach(loan => {
        const amortRows = (loan.amortization_rows as any[]) || [];
        const thisMonthDue = amortRows.filter((r: any) => {
          const dueDate = new Date(r.due_on);
          return dueDate >= monthStart && dueDate <= monthEnd && !r.is_paid;
        });
        thisMonthDue.forEach((r: any) => {
          totalEMIs += Number(r.scheduled_emi || loan.emi_amount);
        });
      });

      const totalFixedExpenses = budget
        ? Number(budget.rent || 0) + Number(budget.utilities || 0) + 
          Number(budget.insurance || 0) + Number(budget.subscriptions || 0) + 
          Number(budget.school || 0)
        : 0;

      const budgetedVariable = budget
        ? Number(budget.food || 0) + Number(budget.transport || 0) + 
          Number(budget.eating_out || 0) + Number(budget.shopping || 0) + 
          Number(budget.travel || 0)
        : 0;

      const totalBudget = totalFixedExpenses + budgetedVariable + totalEMIs;
      const surplus = monthlyIncome - projectedSpend - totalEMIs - totalFixedExpenses;
      const budgetUsed = totalBudget > 0 ? Math.min((totalSpent / budgetedVariable) * 100, 100) : 0;

      setMetrics({
        monthlyIncome,
        totalEMIs,
        avgDailySpend,
        projectedSpend,
        surplus,
        daysRemaining,
        budgetUsed
      });

      // Determine cashflow status
      const utilizationRatio = monthlyIncome > 0 ? (projectedSpend + totalEMIs) / monthlyIncome : 1;
      
      let status: CashflowStatus;
      if (utilizationRatio > 1) {
        status = {
          status: "danger",
          message: "Spending exceeds income! Immediate action needed.",
          score: Math.max(0, 30 - (utilizationRatio - 1) * 30)
        };
      } else if (utilizationRatio > 0.9) {
        status = {
          status: "critical",
          message: "Very tight budget. Consider reducing discretionary spending.",
          score: Math.max(30, 50 - (utilizationRatio - 0.9) * 200)
        };
      } else if (utilizationRatio > 0.75) {
        status = {
          status: "warning",
          message: "Budget is stretched. Monitor spending carefully.",
          score: Math.max(50, 70 - (utilizationRatio - 0.75) * 133)
        };
      } else {
        status = {
          status: "healthy",
          message: "Good cashflow! You have room for savings or prepayment.",
          score: Math.min(100, 70 + (1 - utilizationRatio) * 100)
        };
      }
      setCashflowStatus(status);

      // Analyze spending by category
      const categorySpend: Record<string, number> = {};
      expenses?.forEach(e => {
        const category = (e.expense_groups as any)?.name || "Other";
        categorySpend[category] = (categorySpend[category] || 0) + Number(e.amount);
      });

      const insights: SpendingInsight[] = Object.entries(categorySpend)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([category, amount]) => {
          // Mock trend calculation (in real app, compare with previous month)
          const trend = Math.random() > 0.5 ? "up" : "down";
          const percentChange = Math.round(Math.random() * 30);
          
          return {
            category,
            amount,
            trend: trend as "up" | "down",
            percentChange,
            suggestion: trend === "up" && percentChange > 15 
              ? `Reduce ${category.toLowerCase()} to save ${formatCurrency(amount * 0.2)}/month`
              : undefined
          };
        });
      setSpendingInsights(insights);

      // Check prepayment opportunity
      if (surplus > 5000 && loans && loans.length > 0) {
        const highestInterestLoan = loans.reduce((prev, curr) => 
          curr.interest_rate_apy > prev.interest_rate_apy ? curr : prev
        );
        
        const safeAmount = Math.min(surplus * 0.5, 20000);
        const monthlyInterestRate = highestInterestLoan.interest_rate_apy / 12 / 100;
        const interestSaved = Math.round(safeAmount * monthlyInterestRate * 12);
        
        setPrepayOpportunity({
          loanId: highestInterestLoan.id,
          loanName: highestInterestLoan.loan_name,
          safeAmount,
          interestSaved,
          tenureReduction: Math.ceil(safeAmount / (highestInterestLoan.emi_amount || 5000))
        });
      } else {
        setPrepayOpportunity(null);
      }

      // Generate freeze suggestions if needed
      if (utilizationRatio > 0.85) {
        const suggestions: FreezeSpendSuggestion[] = [];
        
        if (categorySpend["Food Delivery"] || categorySpend["Eating Out"]) {
          const foodDeliverySpend = (categorySpend["Food Delivery"] || 0) + (categorySpend["Eating Out"] || 0);
          suggestions.push({
            id: "freeze-food-delivery",
            category: "Food Delivery",
            action: "Stop ordering food delivery",
            duration: "7 days",
            potentialSavings: Math.round(foodDeliverySpend / 4)
          });
        }

        if (categorySpend["Shopping"]) {
          suggestions.push({
            id: "freeze-shopping",
            category: "Shopping",
            action: "Pause non-essential shopping",
            duration: "14 days",
            potentialSavings: Math.round((categorySpend["Shopping"] || 0) / 2)
          });
        }

        if (categorySpend["Entertainment"]) {
          suggestions.push({
            id: "freeze-entertainment",
            category: "Entertainment",
            action: "Skip movies/events",
            duration: "1 month",
            potentialSavings: categorySpend["Entertainment"] || 0
          });
        }

        setFreezeSuggestions(suggestions.slice(0, 2));
      } else {
        setFreezeSuggestions([]);
      }

      // Predict insolvency (simplified)
      if (surplus < 0) {
        // How many months until bank balance depletes?
        const monthlyDeficit = Math.abs(surplus);
        const estimatedBalance = 50000; // Mock - would need bank account data
        const monthsUntilInsolvency = Math.floor(estimatedBalance / monthlyDeficit);
        
        setInsolvencyRisk({
          months: monthsUntilInsolvency,
          riskLevel: monthsUntilInsolvency <= 2 ? "critical" : monthsUntilInsolvency <= 4 ? "high" : "medium",
          reason: `At current spending rate, you may face cash shortage in ${monthsUntilInsolvency} months.`
        });
      } else {
        setInsolvencyRisk(null);
      }

    } catch (error) {
      console.error("Error in cashflow analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeRealtime();
    
    // Refresh every 5 minutes
    const interval = setInterval(analyzeRealtime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-500";
      case "warning": return "text-yellow-500";
      case "critical": return "text-orange-500";
      case "danger": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <ShieldCheck className="h-5 w-5" />;
      case "warning": return <AlertTriangle className="h-5 w-5" />;
      case "critical": return <Flame className="h-5 w-5" />;
      case "danger": return <AlertTriangle className="h-5 w-5" />;
      default: return <Wallet className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Card className="border-blue-500/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${getStatusColor(cashflowStatus.status)} bg-current/10`}>
              <span className={getStatusColor(cashflowStatus.status)}>
                {getStatusIcon(cashflowStatus.status)}
              </span>
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                AI Cashflow Guardian
                <Badge 
                  variant="secondary" 
                  className={`text-[10px] ${
                    cashflowStatus.status === "healthy" ? "bg-green-500/10 text-green-600" :
                    cashflowStatus.status === "warning" ? "bg-yellow-500/10 text-yellow-600" :
                    "bg-destructive/10 text-destructive"
                  }`}
                >
                  {cashflowStatus.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{cashflowStatus.message}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Financial Health Score</span>
            <span className="font-bold">{Math.round(cashflowStatus.score)}/100</span>
          </div>
          <Progress 
            value={cashflowStatus.score} 
            className="h-2"
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Daily Spend Avg</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.avgDailySpend)}</p>
            <p className="text-xs text-muted-foreground">{metrics.daysRemaining} days left</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Projected Surplus</p>
            <p className={`text-lg font-bold ${metrics.surplus >= 0 ? "text-green-600" : "text-destructive"}`}>
              {metrics.surplus >= 0 ? "+" : ""}{formatCurrency(metrics.surplus)}
            </p>
            <p className="text-xs text-muted-foreground">End of month</p>
          </div>
        </div>

        {/* Budget Usage */}
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Variable Budget Used</span>
            </div>
            <span className={`text-sm font-bold ${
              metrics.budgetUsed > 100 ? "text-destructive" : 
              metrics.budgetUsed > 80 ? "text-orange-500" : "text-green-600"
            }`}>
              {Math.round(metrics.budgetUsed)}%
            </span>
          </div>
          <Progress 
            value={Math.min(metrics.budgetUsed, 100)} 
            className={`h-1.5 ${metrics.budgetUsed > 100 ? "[&>div]:bg-destructive" : ""}`}
          />
        </div>

        {/* Prepayment Opportunity */}
        <AnimatePresence>
          {prepayOpportunity && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-lg border-2 border-green-500/30 bg-green-500/5"
            >
              <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-full bg-green-500/20">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    💰 Safe to Prepay Loan
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can safely prepay {formatCurrency(prepayOpportunity.safeAmount)} to <strong>{prepayOpportunity.loanName}</strong>.
                  </p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-green-600">
                      Save {formatCurrency(prepayOpportunity.interestSaved)} interest
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-blue-600">
                      -{prepayOpportunity.tenureReduction} EMIs
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Freeze Spending Suggestions */}
        {freezeSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Snowflake className="h-4 w-4 text-blue-400" />
              <span>Freeze Spending Suggestions</span>
            </div>
            {freezeSuggestions.map((suggestion) => (
              <div 
                key={suggestion.id}
                className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm">{suggestion.action}</p>
                  <p className="text-xs text-muted-foreground">for {suggestion.duration}</p>
                </div>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                  +{formatCurrency(suggestion.potentialSavings)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Insolvency Warning */}
        {insolvencyRisk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg border-2 border-destructive/50 bg-destructive/5"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Cash Flow Risk Detected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {insolvencyRisk.reason}
                </p>
                <Badge 
                  variant="destructive" 
                  className="mt-2 text-[10px]"
                >
                  {insolvencyRisk.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </div>
          </motion.div>
        )}

        {/* Detailed Spending Insights */}
        <AnimatePresence>
          {showDetails && spendingInsights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 pt-2 border-t"
            >
              <p className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Spending Breakdown
              </p>
              {spendingInsights.map((insight) => (
                <div 
                  key={insight.category}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {insight.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{insight.category}</p>
                      {insight.suggestion && (
                        <p className="text-xs text-muted-foreground">{insight.suggestion}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(insight.amount)}</p>
                    <p className={`text-xs ${insight.trend === "up" ? "text-destructive" : "text-green-500"}`}>
                      {insight.trend === "up" ? "+" : "-"}{insight.percentChange}%
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
