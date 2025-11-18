import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  AlertCircle, TrendingUp, Activity, Brain, 
  CreditCard, Wallet, Target, DollarSign 
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import AIDebtAdvisor from "@/components/AIDebtAdvisor";

export default function NewInsights() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<any[]>([]);
  const [financialMetrics, setFinancialMetrics] = useState({
    debtToIncomeRatio: 0,
    creditUtilization: 0,
    monthlyIncome: 0,
    totalMonthlyDebt: 0,
    emergencyFundMonths: 0,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user?.id)
        .single();

      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name),
          amortization_rows (closing_principal, is_paid, scheduled_emi, interest_component, principal_component)
        `)
        .eq("status", "ACTIVE");

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("amount, paid_on, payment_type")
        .gte("paid_on", threeMonthsAgo.toISOString().split('T')[0]);

      const { data: goalsData } = await supabase
        .from("goals")
        .select("*");

      setProfile(profileData);
      setLoans(loansData || []);
      setPayments(paymentsData || []);
      setGoals(goalsData || []);

      // Calculate metrics
      const monthlyIncome = profileData?.monthly_income || 0;
      let totalMonthlyDebt = 0;
      let totalCreditUsed = 0;
      let totalCreditLimit = 0;
      const alerts: any[] = [];

      loansData?.forEach((loan: any) => {
        const unpaidRows = loan.amortization_rows?.filter((r: any) => !r.is_paid) || [];
        const outstanding = unpaidRows[0]?.closing_principal || 0;
        
        totalMonthlyDebt += loan.emi_amount || 0;

        // Risk alerts
        if (outstanding > loan.principal_amount * 0.8) {
          alerts.push({
            type: "warning",
            message: `${loan.loan_name}: High outstanding balance (${formatPercent((outstanding / loan.principal_amount) * 100, 0)} of principal)`,
            loanId: loan.id,
          });
        }

        if (loan.interest_rate_apy > 18) {
          alerts.push({
            type: "error",
            message: `${loan.loan_name}: Very high interest rate (${formatPercent(loan.interest_rate_apy, 1)}) - consider refinancing`,
            loanId: loan.id,
          });
        }

        // Credit utilization for card loans
        if (loan.loan_type === "CREDIT_CARD_CONVERSION" || loan.loan_type === "CONSUMER_DURABLE") {
          totalCreditLimit += loan.principal_amount * 2;
          totalCreditUsed += outstanding;
        }
      });

      const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;
      const creditUtilization = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;

      // Emergency fund calculation
      const avgMonthlyExpenses = paymentsData?.reduce((sum, p) => sum + p.amount, 0) / 3 || totalMonthlyDebt;
      const remainingIncome = Math.max(0, monthlyIncome - totalMonthlyDebt);
      const emergencyFundMonths = avgMonthlyExpenses > 0 ? remainingIncome / avgMonthlyExpenses : 0;

      setFinancialMetrics({
        debtToIncomeRatio,
        creditUtilization,
        monthlyIncome,
        totalMonthlyDebt,
        emergencyFundMonths,
      });
      setRiskAlerts(alerts);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const getHealthStatus = (dtiRatio: number) => {
    if (dtiRatio <= 36) return { label: "Excellent", color: "text-green-600" };
    if (dtiRatio <= 43) return { label: "Good", color: "text-blue-600" };
    if (dtiRatio <= 50) return { label: "Fair", color: "text-yellow-600" };
    return { label: "Poor", color: "text-red-600" };
  };

  const healthStatus = getHealthStatus(financialMetrics.debtToIncomeRatio);

  const incomeBreakdownData = [
    { name: "Debt Payments", value: financialMetrics.totalMonthlyDebt, color: "hsl(var(--destructive))" },
    { name: "Available", value: Math.max(0, financialMetrics.monthlyIncome - financialMetrics.totalMonthlyDebt), color: "hsl(var(--primary))" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Insights</h1>
        <p className="text-muted-foreground">Deep analysis of your financial health and risk factors</p>
      </div>

      {/* Key Health Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Debt-to-Income Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{formatPercent(financialMetrics.debtToIncomeRatio, 1)}</span>
                <span className={`text-sm font-medium ${healthStatus.color}`}>{healthStatus.label}</span>
              </div>
              <Progress value={Math.min(financialMetrics.debtToIncomeRatio, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {financialMetrics.debtToIncomeRatio <= 36 ? "Ideal range for lending" : "Above recommended threshold"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Credit Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{formatPercent(financialMetrics.creditUtilization, 1)}</span>
                <span className={`text-sm font-medium ${financialMetrics.creditUtilization <= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {financialMetrics.creditUtilization <= 30 ? 'Good' : 'High'}
                </span>
              </div>
              <Progress value={Math.min(financialMetrics.creditUtilization, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Keep below 30% for optimal credit score
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Emergency Fund
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{financialMetrics.emergencyFundMonths.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">months</span>
              </div>
              <Progress value={(financialMetrics.emergencyFundMonths / 6) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Target: 6 months of expenses
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Risk Alerts & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riskAlerts.length === 0 ? (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>All Clear!</strong> No major risk factors detected. Your debt is well-managed.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {riskAlerts.map((alert, idx) => (
                <Alert key={idx} variant={alert.type === "error" ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {financialMetrics.debtToIncomeRatio > 43 && (
            <Alert className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>High DTI Alert:</strong> Your debt-to-income ratio is above 43%. Consider debt consolidation or increasing income.
              </AlertDescription>
            </Alert>
          )}

          {financialMetrics.emergencyFundMonths < 3 && (
            <Alert className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Emergency Fund Low:</strong> Build up to at least 3-6 months of expenses for financial security.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Income vs Debt Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Income Breakdown</CardTitle>
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
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Monthly Income</span>
                <span className="font-semibold">{formatINR(financialMetrics.monthlyIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Debt Payments</span>
                <span className="font-semibold">{formatINR(financialMetrics.totalMonthlyDebt)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span>Available for Savings</span>
                <span className="font-semibold text-primary">
                  {formatINR(Math.max(0, financialMetrics.monthlyIncome - financialMetrics.totalMonthlyDebt))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Distribution by Interest Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Interest Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loans.map((loan) => {
                const unpaidRows = loan.amortization_rows?.filter((r: any) => !r.is_paid) || [];
                const outstanding = unpaidRows[0]?.closing_principal || 0;

                return (
                  <div key={loan.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{loan.loan_name}</p>
                      <p className="text-sm font-semibold">{formatPercent(loan.interest_rate_apy, 1)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={Math.min((loan.interest_rate_apy / 20) * 100, 100)} 
                        className="flex-1 h-2"
                      />
                      <span className="text-xs text-muted-foreground">{formatINR(outstanding)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Debt Advisor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AIDebtAdvisor 
            loans={loans.map(l => ({
              ...l,
              outstanding: l.amortization_rows?.filter((r: any) => !r.is_paid)[0]?.closing_principal || 0
            }))} 
            monthlyIncome={financialMetrics.monthlyIncome}
            goals={goals}
          />
        </CardContent>
      </Card>
    </div>
  );
}
