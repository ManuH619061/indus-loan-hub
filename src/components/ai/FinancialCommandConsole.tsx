import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency";
import { differenceInDays, format, addDays } from "date-fns";
import { 
  AlertTriangle, 
  Zap, 
  Lightbulb, 
  CreditCard, 
  Receipt, 
  ArrowRight,
  TrendingUp,
  Shield,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PriorityAction {
  id: string;
  title: string;
  description: string;
  urgency: "critical" | "high" | "medium" | "low";
  type: "emi" | "expense" | "saving" | "opportunity";
  action: string;
  route?: string;
  savings?: number;
  daysLeft?: number;
}

interface RiskAlert {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  metric?: string;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  potentialSavings: number;
  difficulty: "easy" | "medium" | "hard";
}

export const FinancialCommandConsole = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const analyzeFinances = async () => {
    if (!user) return;
    
    try {
      const today = new Date();
      const actions: PriorityAction[] = [];
      const alerts: RiskAlert[] = [];
      const opps: Opportunity[] = [];

      // Fetch loans with amortization for upcoming EMIs
      const { data: loans } = await supabase
        .from("loans")
        .select(`
          id, loan_name, emi_amount, interest_rate_apy, principal_amount, status,
          lenders (name),
          amortization_rows (due_on, is_paid, interest_component, principal_component, scheduled_emi)
        `)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      // Fetch recent expenses
      const thirtyDaysAgo = addDays(today, -30);
      const { data: expenses } = await supabase
        .from("monthly_expenses")
        .select("amount, expense_date, group_id, expense_groups(name)")
        .eq("user_id", user.id)
        .gte("expense_date", thirtyDaysAgo.toISOString().split("T")[0]);

      // Fetch budget
      const currentMonth = format(today, "yyyy-MM");
      const { data: budget } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .single();

      // Analyze upcoming EMIs
      if (loans) {
        for (const loan of loans) {
          const amortRows = (loan.amortization_rows as any[]) || [];
          const unpaidRows = amortRows
            .filter((r: any) => !r.is_paid)
            .sort((a: any, b: any) => new Date(a.due_on).getTime() - new Date(b.due_on).getTime());

          if (unpaidRows.length > 0) {
            const nextDue = unpaidRows[0];
            const dueDate = new Date(nextDue.due_on);
            const daysUntilDue = differenceInDays(dueDate, today);
            
            // Calculate potential interest savings for early payment
            const dailyInterestRate = loan.interest_rate_apy / 365 / 100;
            const potentialSavings = Math.round(nextDue.opening_principal * dailyInterestRate * Math.max(0, daysUntilDue));

            if (daysUntilDue <= 0) {
              // Overdue
              actions.push({
                id: `emi-overdue-${loan.id}`,
                title: `⚠️ ${loan.loan_name} EMI Overdue`,
                description: `Payment was due ${Math.abs(daysUntilDue)} days ago. Late fees may apply.`,
                urgency: "critical",
                type: "emi",
                action: "Pay Now",
                route: `/payments?loan=${loan.id}`,
                daysLeft: daysUntilDue
              });

              alerts.push({
                id: `alert-overdue-${loan.id}`,
                title: "Overdue EMI Detected",
                message: `${loan.loan_name} EMI is ${Math.abs(daysUntilDue)} days overdue. This may affect your credit score.`,
                severity: "critical",
                metric: formatCurrency(nextDue.scheduled_emi || loan.emi_amount)
              });
            } else if (daysUntilDue <= 3) {
              actions.push({
                id: `emi-urgent-${loan.id}`,
                title: `🔥 ${loan.loan_name} EMI Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
                description: potentialSavings > 0 
                  ? `Paying early saves ${formatCurrency(potentialSavings)} in interest.`
                  : `EMI amount: ${formatCurrency(nextDue.scheduled_emi || loan.emi_amount)}`,
                urgency: daysUntilDue <= 1 ? "critical" : "high",
                type: "emi",
                action: "Pay Today",
                route: `/payments?loan=${loan.id}`,
                savings: potentialSavings,
                daysLeft: daysUntilDue
              });
            } else if (daysUntilDue <= 7) {
              actions.push({
                id: `emi-upcoming-${loan.id}`,
                title: `📌 ${loan.loan_name} EMI Due ${format(dueDate, 'MMM d')}`,
                description: `${daysUntilDue} days left. Amount: ${formatCurrency(nextDue.scheduled_emi || loan.emi_amount)}`,
                urgency: "medium",
                type: "emi",
                action: "Schedule Payment",
                route: `/payments?loan=${loan.id}`,
                daysLeft: daysUntilDue
              });
            }

            // High interest loan opportunity
            if (loan.interest_rate_apy > 15) {
              opps.push({
                id: `refinance-${loan.id}`,
                title: `Refinance ${loan.loan_name}`,
                description: `Current rate ${loan.interest_rate_apy}% is high. Balance transfer could save you money.`,
                potentialSavings: Math.round((loan.principal_amount * (loan.interest_rate_apy - 12)) / 100 / 12),
                difficulty: "medium"
              });
            }
          }
        }
      }

      // Analyze spending patterns
      if (expenses && expenses.length > 0) {
        const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const dailyAverage = totalSpent / 30;
        const projectedMonthly = dailyAverage * 30;

        const totalIncome = budget 
          ? Number(budget.salary || 0) + Number(budget.side_income || 0) + Number(budget.other_income || 0)
          : 0;

        if (totalIncome > 0 && projectedMonthly > totalIncome * 0.9) {
          alerts.push({
            id: "spending-warning",
            title: "High Spending Alert",
            message: `Your projected monthly spending (${formatCurrency(projectedMonthly)}) is ${Math.round((projectedMonthly / totalIncome) * 100)}% of your income.`,
            severity: "warning",
            metric: `${Math.round((projectedMonthly / totalIncome) * 100)}%`
          });
        }

        // Category analysis
        const categoryTotals: Record<string, number> = {};
        expenses.forEach(e => {
          const category = (e.expense_groups as any)?.name || "Other";
          categoryTotals[category] = (categoryTotals[category] || 0) + Number(e.amount);
        });

        // Find top spending category
        const topCategory = Object.entries(categoryTotals)
          .sort(([, a], [, b]) => b - a)[0];

        if (topCategory && topCategory[1] > totalSpent * 0.4) {
          opps.push({
            id: "reduce-top-category",
            title: `Reduce ${topCategory[0]} Spending`,
            description: `${topCategory[0]} accounts for ${Math.round((topCategory[1] / totalSpent) * 100)}% of your expenses.`,
            potentialSavings: Math.round(topCategory[1] * 0.2),
            difficulty: "easy"
          });
        }
      }

      // Budget surplus opportunity
      if (budget) {
        const totalIncome = Number(budget.salary || 0) + Number(budget.side_income || 0) + Number(budget.other_income || 0);
        const fixedExpenses = Number(budget.rent || 0) + Number(budget.utilities || 0) + 
                            Number(budget.insurance || 0) + Number(budget.subscriptions || 0);
        const variableExpenses = Number(budget.food || 0) + Number(budget.transport || 0) + 
                                Number(budget.eating_out || 0) + Number(budget.shopping || 0);
        
        const surplus = totalIncome - fixedExpenses - variableExpenses;
        
        if (surplus > 5000) {
          opps.push({
            id: "surplus-prepay",
            title: "Use Surplus for Loan Prepayment",
            description: `You have ${formatCurrency(surplus)} surplus this month. Prepaying could reduce loan tenure.`,
            potentialSavings: Math.round(surplus * 0.15),
            difficulty: "easy"
          });
        }
      }

      // Add quick action if no priority actions
      if (actions.length === 0) {
        actions.push({
          id: "record-expense",
          title: "📝 Record Today's Expenses",
          description: "Keep your spending tracker up to date for accurate insights.",
          urgency: "low",
          type: "expense",
          action: "Add Expense",
          route: "/budget/monthly-expenses?action=add"
        });
      }

      // Default opportunity
      if (opps.length === 0) {
        opps.push({
          id: "track-spending",
          title: "Build Spending History",
          description: "Track expenses consistently to unlock personalized insights.",
          potentialSavings: 0,
          difficulty: "easy"
        });
      }

      setPriorityActions(actions.slice(0, 3));
      setRiskAlerts(alerts.slice(0, 3));
      setOpportunities(opps.slice(0, 2));
    } catch (error) {
      console.error("Error analyzing finances:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    analyzeFinances();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    analyzeFinances();
    toast.success("Financial analysis refreshed");
  };

  const handleQuickAction = (action: string, route?: string) => {
    if (route) {
      navigate(route);
    } else {
      toast.info(`Action: ${action}`);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Financial Command Console</CardTitle>
              <p className="text-xs text-muted-foreground">AI-powered priority insights</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Priority Actions */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Top Priority Actions
          </h4>
          <AnimatePresence>
            <div className="space-y-2">
              {priorityActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer"
                  onClick={() => handleQuickAction(action.action, action.route)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] ${getUrgencyColor(action.urgency)}`}>
                          {action.urgency.toUpperCase()}
                        </Badge>
                        {action.daysLeft !== undefined && action.daysLeft <= 3 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {action.daysLeft <= 0 ? "Overdue" : `${action.daysLeft}d left`}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate">{action.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{action.description}</p>
                      {action.savings && action.savings > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Save {formatCurrency(action.savings)}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="secondary" className="shrink-0">
                      {action.action}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </div>

        {/* Risk Alerts */}
        {riskAlerts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" />
              Critical Risk Alerts
            </h4>
            <div className="space-y-2">
              {riskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.severity === "critical" 
                      ? "border-l-destructive bg-destructive/5" 
                      : "border-l-yellow-500 bg-yellow-500/5"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                    {alert.metric && (
                      <Badge variant="outline" className="shrink-0">
                        {alert.metric}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Money Opportunities */}
        {opportunities.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              Money Opportunities
            </h4>
            <div className="grid gap-2">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{opp.title}</p>
                      <p className="text-xs text-muted-foreground">{opp.description}</p>
                    </div>
                    {opp.potentialSavings > 0 && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        +{formatCurrency(opp.potentialSavings)}/mo
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => navigate("/budget/monthly-expenses?action=add")}
            >
              <Receipt className="h-3.5 w-3.5 mr-2" />
              Record Expense
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => navigate("/payments")}
            >
              <CreditCard className="h-3.5 w-3.5 mr-2" />
              Pay EMI
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
