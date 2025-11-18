import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PiggyBank, 
  Zap,
  Target,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";
import { motion } from "framer-motion";

interface BudgetData {
  monthlyIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  savingsTarget: number;
  emiCapacityPercent: number;
}

interface Loan {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  emi_amount: number;
  tenure_months: number;
  disbursed_on: string;
  status: string;
}

export default function BudgetPlanner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [budget, setBudget] = useState<BudgetData>({
    monthlyIncome: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    savingsTarget: 0,
    emiCapacityPercent: 40,
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      if (loansError) throw loansError;
      setLoans(loansData || []);

      // Load budget from localStorage
      const savedBudget = localStorage.getItem(`budget_${user.id}`);
      if (savedBudget) {
        setBudget(JSON.parse(savedBudget));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const saveBudget = () => {
    if (!user) return;
    localStorage.setItem(`budget_${user.id}`, JSON.stringify(budget));
    toast.success("Budget saved successfully");
  };

  // Calculations
  const totalEMI = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
  const totalExpenses = budget.fixedExpenses + budget.variableExpenses + totalEMI;
  const freeCashFlow = budget.monthlyIncome - totalExpenses;
  const emiAffordability = (budget.monthlyIncome * budget.emiCapacityPercent) / 100;
  const debtBurden = budget.monthlyIncome > 0 ? (totalEMI / budget.monthlyIncome) * 100 : 0;
  const savingsAchievement = freeCashFlow >= budget.savingsTarget;

  // Snowball method: smallest balance first
  const snowballOrder = [...loans].sort((a, b) => {
    const aBalance = calculateOutstanding(a);
    const bBalance = calculateOutstanding(b);
    return aBalance - bBalance;
  });

  // Avalanche method: highest interest first
  const avalancheOrder = [...loans].sort((a, b) => b.interest_rate_apy - a.interest_rate_apy);

  function calculateOutstanding(loan: Loan): number {
    const monthsPassed = Math.floor(
      (new Date().getTime() - new Date(loan.disbursed_on).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    const paidEMIs = Math.min(monthsPassed, loan.tenure_months);
    const totalPaid = paidEMIs * (loan.emi_amount || 0);
    return Math.max(0, loan.principal_amount - totalPaid * 0.7); // rough estimate
  }

  function calculateTotalInterest(loan: Loan): number {
    return (loan.emi_amount || 0) * loan.tenure_months - loan.principal_amount;
  }

  const getAISuggestions = () => {
    const suggestions = [];

    if (debtBurden > 50) {
      suggestions.push({
        type: "critical",
        message: "Your debt burden is very high (>50%). Focus on aggressive debt repayment and avoid new loans.",
      });
    } else if (debtBurden > 40) {
      suggestions.push({
        type: "warning",
        message: "Debt burden is elevated. Consider using extra income for prepayments.",
      });
    }

    if (freeCashFlow < 0) {
      suggestions.push({
        type: "critical",
        message: "Negative cash flow! Reduce variable expenses or increase income urgently.",
      });
    } else if (freeCashFlow > emiAffordability * 0.3) {
      suggestions.push({
        type: "success",
        message: `You have ₹${formatINR(freeCashFlow)} free cash. Consider making extra EMI payments to save on interest.`,
      });
    }

    if (!savingsAchievement && budget.savingsTarget > 0) {
      suggestions.push({
        type: "warning",
        message: "You're not meeting your savings target. Review variable expenses.",
      });
    }

    if (avalancheOrder.length > 0) {
      const highestInterestLoan = avalancheOrder[0];
      suggestions.push({
        type: "info",
        message: `Focus on "${highestInterestLoan.loan_name}" (${formatPercent(highestInterestLoan.interest_rate_apy)}% interest) - highest interest loan. Pay this off first to save the most money.`,
      });
    }

    if (snowballOrder.length > 0) {
      const smallestLoan = snowballOrder[0];
      const balance = calculateOutstanding(smallestLoan);
      suggestions.push({
        type: "info",
        message: `"${smallestLoan.loan_name}" has the smallest balance (₹${formatINR(balance)}). Clearing this quickly can boost motivation.`,
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        type: "success",
        message: "Great job! Your finances look healthy. Keep maintaining this balance.",
      });
    }

    return suggestions;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const suggestions = getAISuggestions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Budget Planner</h1>
        <p className="text-muted-foreground mt-2">
          Manage your budget, plan loan payoffs, and get AI-powered recommendations
        </p>
      </div>

      <FadeInStagger>
        {/* Budget Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Free Cash Flow</CardTitle>
                {freeCashFlow >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${freeCashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatINR(freeCashFlow)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  After all expenses & EMIs
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">EMI Affordability</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatINR(emiAffordability)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {budget.emiCapacityPercent}% of income
                </p>
                <Progress value={Math.min((totalEMI / emiAffordability) * 100, 100)} className="mt-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Debt Burden</CardTitle>
                <AlertCircle className={`h-4 w-4 ${debtBurden > 50 ? 'text-destructive' : 'text-warning'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(debtBurden)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  EMI / Monthly Income
                </p>
                <Progress 
                  value={Math.min(debtBurden, 100)} 
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Savings Target</CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatINR(budget.savingsTarget)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {savingsAchievement ? "Target met!" : "Below target"}
                </p>
                <Badge variant={savingsAchievement ? "default" : "secondary"} className="mt-2">
                  {savingsAchievement ? "On Track" : "Needs Attention"}
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Budget Form */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Budget</CardTitle>
            <CardDescription>Configure your income, expenses, and savings targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="income">Monthly Income</Label>
                <Input
                  id="income"
                  type="number"
                  value={budget.monthlyIncome || ""}
                  onChange={(e) => setBudget({ ...budget, monthlyIncome: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fixed">Fixed Expenses</Label>
                <Input
                  id="fixed"
                  type="number"
                  value={budget.fixedExpenses || ""}
                  onChange={(e) => setBudget({ ...budget, fixedExpenses: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variable">Variable Expenses</Label>
                <Input
                  id="variable"
                  type="number"
                  value={budget.variableExpenses || ""}
                  onChange={(e) => setBudget({ ...budget, variableExpenses: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="savings">Savings Target</Label>
                <Input
                  id="savings"
                  type="number"
                  value={budget.savingsTarget || ""}
                  onChange={(e) => setBudget({ ...budget, savingsTarget: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emiCapacity">EMI Capacity %</Label>
                <Input
                  id="emiCapacity"
                  type="number"
                  value={budget.emiCapacityPercent || ""}
                  onChange={(e) => setBudget({ ...budget, emiCapacityPercent: Number(e.target.value) })}
                  placeholder="40"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={saveBudget} className="w-full">
                  Save Budget
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total EMIs</p>
                  <p className="font-semibold text-lg">{formatINR(totalEMI)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Expenses</p>
                  <p className="font-semibold text-lg">{formatINR(totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Active Loans</p>
                  <p className="font-semibold text-lg">{loans.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Free Cash</p>
                  <p className={`font-semibold text-lg ${freeCashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatINR(freeCashFlow)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Payoff Planning */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Loan Payoff Strategies
            </CardTitle>
            <CardDescription>
              Compare Snowball (smallest first) vs Avalanche (highest interest first) methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="snowball">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="snowball">Snowball Method</TabsTrigger>
                <TabsTrigger value="avalanche">Avalanche Method</TabsTrigger>
              </TabsList>

              <TabsContent value="snowball" className="space-y-4">
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    Pay smallest loans first for quick wins and motivation. Great for building momentum!
                  </AlertDescription>
                </Alert>
                {snowballOrder.map((loan, index) => (
                  <Card key={loan.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <h4 className="font-semibold">{loan.loan_name}</h4>
                          </div>
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Outstanding</p>
                              <p className="font-semibold">{formatINR(calculateOutstanding(loan))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Interest Rate</p>
                              <p className="font-semibold">{formatPercent(loan.interest_rate_apy)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Monthly EMI</p>
                              <p className="font-semibold">{formatINR(loan.emi_amount || 0)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Interest</p>
                              <p className="font-semibold text-warning">{formatINR(calculateTotalInterest(loan))}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="avalanche" className="space-y-4">
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    Pay highest interest loans first to save the most money. Best for long-term savings!
                  </AlertDescription>
                </Alert>
                {avalancheOrder.map((loan, index) => (
                  <Card key={loan.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <h4 className="font-semibold">{loan.loan_name}</h4>
                            <Badge variant="destructive">{formatPercent(loan.interest_rate_apy)} APY</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Outstanding</p>
                              <p className="font-semibold">{formatINR(calculateOutstanding(loan))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Interest Rate</p>
                              <p className="font-semibold text-destructive">{formatPercent(loan.interest_rate_apy)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Monthly EMI</p>
                              <p className="font-semibold">{formatINR(loan.emi_amount || 0)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Interest to Save</p>
                              <p className="font-semibold text-success">{formatINR(calculateTotalInterest(loan) * 0.3)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>Smart suggestions based on your financial profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <Alert
                key={index}
                variant={suggestion.type === "critical" ? "destructive" : "default"}
                className={
                  suggestion.type === "success"
                    ? "border-success bg-success/10"
                    : suggestion.type === "warning"
                    ? "border-warning bg-warning/10"
                    : ""
                }
              >
                {suggestion.type === "critical" ? (
                  <ArrowDownCircle className="h-4 w-4" />
                ) : suggestion.type === "success" ? (
                  <ArrowUpCircle className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <AlertDescription>{suggestion.message}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}
