import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, CreditCard, Wallet, DollarSign } from "lucide-react";
import { formatINR, formatPercent } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface FinancialMetrics {
  debtToIncomeRatio: number;
  monthlyIncome: number;
  totalMonthlyDebt: number;
  creditUtilization: number;
  totalCreditLimit: number;
  usedCredit: number;
  emergencyFundMonths: number;
  recommendedEmergencyFund: number;
  monthlyExpenses: number;
}

const FinancialHealth = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  useEffect(() => {
    if (user) {
      fetchFinancialMetrics();
    }
  }, [user]);

  const fetchFinancialMetrics = async () => {
    try {
      // Fetch profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user?.id)
        .single();

      // Fetch active loans
      const { data: loans } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "ACTIVE");

      // Fetch payments from last 3 months to estimate expenses
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, paid_on, payment_type")
        .gte("paid_on", threeMonthsAgo.toISOString().split('T')[0])
        .order("paid_on", { ascending: false });

      const monthlyIncome = profile?.monthly_income || 0;
      
      // Calculate total monthly debt payments (EMI)
      const totalMonthlyDebt = loans?.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0) || 0;
      
      // Calculate debt-to-income ratio
      const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;

      // Calculate credit utilization for credit card type loans
      const creditCardLoans = loans?.filter(l => 
        l.loan_type === "CREDIT_CARD_CONVERSION" || l.loan_type === "CONSUMER_DURABLE"
      ) || [];
      
      // Estimate credit limit as 2x the principal amount for credit cards
      const totalCreditLimit = creditCardLoans.reduce((sum, loan) => 
        sum + (loan.principal_amount * 2), 0
      );
      
      const usedCredit = creditCardLoans.reduce((sum, loan) => {
        // Calculate remaining principal from loan data
        return sum + loan.principal_amount;
      }, 0);
      
      const creditUtilization = totalCreditLimit > 0 ? (usedCredit / totalCreditLimit) * 100 : 0;

      // Calculate average monthly expenses (EMI + average prepayments/other payments)
      const avgMonthlyPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const monthlyExpenses = avgMonthlyPayments / 3; // 3 months average

      // Emergency fund recommendation: 6 months of expenses
      const recommendedEmergencyFund = monthlyExpenses * 6;
      
      // Assume emergency fund is the remaining income after debt payments
      // In a real app, you'd track actual savings
      const estimatedSavings = Math.max(0, monthlyIncome - totalMonthlyDebt);
      const emergencyFundMonths = monthlyExpenses > 0 ? estimatedSavings / monthlyExpenses : 0;

      setMetrics({
        debtToIncomeRatio,
        monthlyIncome,
        totalMonthlyDebt,
        creditUtilization,
        totalCreditLimit,
        usedCredit,
        emergencyFundMonths,
        recommendedEmergencyFund,
        monthlyExpenses,
      });
    } catch (error) {
      console.error("Error fetching financial metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (dtiRatio: number) => {
    if (dtiRatio <= 36) return { label: "Excellent", color: "text-green-600", bg: "bg-green-100" };
    if (dtiRatio <= 43) return { label: "Good", color: "text-blue-600", bg: "bg-blue-100" };
    if (dtiRatio <= 50) return { label: "Fair", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { label: "Poor", color: "text-red-600", bg: "bg-red-100" };
  };

  const getCreditUtilStatus = (utilization: number) => {
    if (utilization <= 30) return { label: "Excellent", color: "text-green-600" };
    if (utilization <= 50) return { label: "Good", color: "text-blue-600" };
    if (utilization <= 70) return { label: "Fair", color: "text-yellow-600" };
    return { label: "Poor", color: "text-red-600" };
  };

  const getEmergencyFundStatus = (months: number) => {
    if (months >= 6) return { label: "Strong", color: "text-green-600" };
    if (months >= 3) return { label: "Adequate", color: "text-blue-600" };
    if (months >= 1) return { label: "Building", color: "text-yellow-600" };
    return { label: "Critical", color: "text-red-600" };
  };

  if (loading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load financial health metrics. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const healthStatus = getHealthStatus(metrics.debtToIncomeRatio);
  const creditStatus = getCreditUtilStatus(metrics.creditUtilization);
  const emergencyStatus = getEmergencyFundStatus(metrics.emergencyFundMonths);

  const incomeBreakdownData = [
    { name: "Debt Payments", value: metrics.totalMonthlyDebt, color: "hsl(var(--destructive))" },
    { name: "Available", value: Math.max(0, metrics.monthlyIncome - metrics.totalMonthlyDebt), color: "hsl(var(--primary))" },
  ];

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Financial Health Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your debt-to-income ratio, credit utilization, and emergency fund status
        </p>
      </div>

      {metrics.monthlyIncome === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please update your monthly income in your profile to get accurate financial health metrics.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Debt-to-Income Ratio */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Debt-to-Income Ratio</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardDescription>Monthly debt vs income</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{formatPercent(metrics.debtToIncomeRatio, 1)}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${healthStatus.bg} ${healthStatus.color}`}>
                {healthStatus.label}
              </span>
            </div>
            <Progress value={Math.min(metrics.debtToIncomeRatio, 100)} className="h-2" />
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Income</span>
                <span className="font-medium">{formatINR(metrics.monthlyIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Debt</span>
                <span className="font-medium">{formatINR(metrics.totalMonthlyDebt)}</span>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                {metrics.debtToIncomeRatio <= 36 && "Excellent! Lenders typically prefer DTI below 36%."}
                {metrics.debtToIncomeRatio > 36 && metrics.debtToIncomeRatio <= 43 && "Good standing. Consider reducing debt to improve borrowing power."}
                {metrics.debtToIncomeRatio > 43 && "High DTI may affect loan approvals. Focus on debt reduction."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Credit Utilization */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Credit Utilization</CardTitle>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardDescription>Credit card usage vs limit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{formatPercent(metrics.creditUtilization, 1)}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${creditStatus.color}`}>
                {creditStatus.label}
              </span>
            </div>
            <Progress value={Math.min(metrics.creditUtilization, 100)} className="h-2" />
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-medium">{formatINR(metrics.totalCreditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used Credit</span>
                <span className="font-medium">{formatINR(metrics.usedCredit)}</span>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                {metrics.creditUtilization <= 30 && "Great! Keep utilization below 30% for optimal credit score."}
                {metrics.creditUtilization > 30 && metrics.creditUtilization <= 50 && "Consider paying down balances to improve credit score."}
                {metrics.creditUtilization > 50 && "High utilization may negatively impact your credit score."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Emergency Fund */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Emergency Fund</CardTitle>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardDescription>Months of expenses covered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{metrics.emergencyFundMonths.toFixed(1)}</span>
              <span className="text-lg text-muted-foreground">months</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${emergencyStatus.color}`}>
                {emergencyStatus.label}
              </span>
            </div>
            <Progress value={(metrics.emergencyFundMonths / 6) * 100} className="h-2" />
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recommended Fund</span>
                <span className="font-medium">{formatINR(metrics.recommendedEmergencyFund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Expenses</span>
                <span className="font-medium">{formatINR(metrics.monthlyExpenses)}</span>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                {metrics.emergencyFundMonths >= 6 && "Excellent buffer! You're well-prepared for emergencies."}
                {metrics.emergencyFundMonths >= 3 && metrics.emergencyFundMonths < 6 && "Good start! Aim for 6 months of expenses."}
                {metrics.emergencyFundMonths < 3 && "Build your emergency fund to 3-6 months of expenses."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Income Breakdown</CardTitle>
          <CardDescription>How your monthly income is allocated</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              debt: {
                label: "Debt Payments",
                color: "hsl(var(--destructive))",
              },
              available: {
                label: "Available Income",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incomeBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Financial Health Recommendations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.debtToIncomeRatio > 43 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Priority:</strong> Your debt-to-income ratio is high. Focus on paying down high-interest debt and consider debt consolidation options.
              </AlertDescription>
            </Alert>
          )}
          {metrics.creditUtilization > 50 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Credit Health:</strong> Reduce credit card balances below 30% utilization to improve your credit score and borrowing power.
              </AlertDescription>
            </Alert>
          )}
          {metrics.emergencyFundMonths < 3 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Emergency Preparedness:</strong> Build an emergency fund of at least 3-6 months of expenses. Start by saving {formatINR(metrics.monthlyExpenses)} per month.
              </AlertDescription>
            </Alert>
          )}
          {metrics.debtToIncomeRatio <= 36 && metrics.creditUtilization <= 30 && metrics.emergencyFundMonths >= 6 && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>Excellent Financial Health!</strong> You're maintaining healthy debt levels, good credit utilization, and a strong emergency fund. Keep up the great work!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialHealth;
