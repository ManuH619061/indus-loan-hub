import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, Area } from "recharts";
import FadeInStagger from "@/components/FadeInStagger";

interface CashFlowMonth {
  month: string;
  income: number;
  expenses: number;
  emis: number;
  savings: number;
  freeCash: number;
  debtBurden: number;
  isNegative: boolean;
  isHighDebt: boolean;
}

export default function FutureCashFlow() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<CashFlowMonth[]>([]);
  const [forecastMonths, setForecastMonths] = useState(12);
  const [salaryIncrease, setSalaryIncrease] = useState<number>(0);
  const [bonusMonth, setBonusMonth] = useState<string>("");
  const [bonusAmount, setBonusAmount] = useState<number>(0);

  useEffect(() => {
    generateForecast();
  }, [user, forecastMonths]);

  const generateForecast = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch current budget
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      
      const { data: currentBudget } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .maybeSingle();

      // Fetch active loans
      const { data: loans } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      const forecastData: CashFlowMonth[] = [];
      
      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, "0")}`;
        
        // Calculate income with salary increase
        const baseIncome = (currentBudget?.salary || 0) + (currentBudget?.side_income || 0) + (currentBudget?.other_income || 0);
        const income = baseIncome + (salaryIncrease || 0);
        
        // Add bonus if applicable
        const bonus = bonusMonth === monthKey ? (bonusAmount || 0) : 0;
        const totalIncome = income + bonus;

        // Calculate expenses
        const fixedExpenses = 
          (currentBudget?.rent || 0) +
          (currentBudget?.food || 0) +
          (currentBudget?.transport || 0) +
          (currentBudget?.utilities || 0) +
          (currentBudget?.school || 0) +
          (currentBudget?.subscriptions || 0) +
          (currentBudget?.insurance || 0);

        const variableExpenses = 
          (currentBudget?.eating_out || 0) +
          (currentBudget?.shopping || 0) +
          (currentBudget?.travel || 0) +
          (currentBudget?.other_variable || 0);

        const totalExpenses = fixedExpenses + variableExpenses;

        // Calculate EMIs for this month
        const totalEMI = loans?.reduce((sum, loan) => {
          const disbursedDate = new Date(loan.disbursed_on);
          const monthsSinceDisbursement = Math.floor(
            (forecastDate.getTime() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          );
          
          if (monthsSinceDisbursement >= 0 && monthsSinceDisbursement < loan.tenure_months) {
            return sum + (loan.emi_amount || 0);
          }
          return sum;
        }, 0) || 0;

        const savings = currentBudget?.savings_investments || 0;
        const freeCash = totalIncome - totalExpenses - totalEMI - savings;
        const debtBurden = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;

        forecastData.push({
          month: monthKey,
          income: totalIncome,
          expenses: totalExpenses,
          emis: totalEMI,
          savings,
          freeCash,
          debtBurden,
          isNegative: freeCash < 0,
          isHighDebt: debtBurden > 50,
        });
      }

      setForecast(forecastData);
    } catch (error: any) {
      toast.error("Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySimulation = () => {
    generateForecast();
    toast.success("Simulation applied to forecast");
  };

  const negativeMonths = forecast.filter(m => m.isNegative).length;
  const highDebtMonths = forecast.filter(m => m.isHighDebt).length;
  const avgFreeCash = forecast.reduce((sum, m) => sum + m.freeCash, 0) / (forecast.length || 1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Future Cash-Flow</h1>
          <p className="text-muted-foreground">Forecast your financial position for the next {forecastMonths} months</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setForecastMonths(12)}>
            12 Months
          </Button>
          <Button variant="outline" onClick={() => setForecastMonths(24)}>
            24 Months
          </Button>
        </div>
      </div>

      <FadeInStagger>
        {(negativeMonths > 0 || highDebtMonths > 0) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warning: {negativeMonths} month(s) with negative free cash and {highDebtMonths} month(s) with high debt burden (&gt;50%)
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Avg Free Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${avgFreeCash < 0 ? 'text-destructive' : 'text-success'}`}>
                {formatINR(avgFreeCash)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Per month average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Negative Months</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{negativeMonths}</div>
              <p className="text-sm text-muted-foreground mt-1">Months with deficit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>High Debt Months</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{highDebtMonths}</div>
              <p className="text-sm text-muted-foreground mt-1">Debt burden &gt; 50%</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What-If Simulation</CardTitle>
            <CardDescription>Adjust parameters to see impact on cash flow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="salary-increase">Monthly Salary Increase</Label>
                <Input
                  id="salary-increase"
                  type="number"
                  placeholder="0"
                  value={salaryIncrease || ""}
                  onChange={(e) => setSalaryIncrease(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus-month">Bonus Month</Label>
                <Input
                  id="bonus-month"
                  type="month"
                  value={bonusMonth}
                  onChange={(e) => setBonusMonth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus-amount">Bonus Amount</Label>
                <Input
                  id="bonus-amount"
                  type="number"
                  placeholder="0"
                  value={bonusAmount || ""}
                  onChange={(e) => setBonusAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleApplySimulation}>
                <Sparkles className="h-4 w-4 mr-2" />
                Apply Simulation
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Forecast</CardTitle>
            <CardDescription>Income, expenses, EMIs, and free cash projection</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatINR(value)} />
                <Legend />
                <Bar dataKey="income" fill="hsl(var(--success))" name="Income" />
                <Bar dataKey="expenses" fill="hsl(var(--warning))" name="Expenses" />
                <Bar dataKey="emis" fill="hsl(var(--destructive))" name="EMIs" />
                <Line type="monotone" dataKey="freeCash" stroke="hsl(var(--primary))" strokeWidth={2} name="Free Cash" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debt Burden Trend</CardTitle>
            <CardDescription>EMI as percentage of income over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
                <Area type="monotone" dataKey="debtBurden" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" name="Debt Burden %" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Month-by-Month Breakdown</CardTitle>
            <CardDescription>Detailed forecast for each month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {forecast.map((month) => (
                <div key={month.month} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{month.month}</div>
                      <div className="text-sm text-muted-foreground">
                        Income: {formatINR(month.income)} | Expenses: {formatINR(month.expenses)} | EMIs: {formatINR(month.emis)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {month.isNegative && <Badge variant="destructive">Negative</Badge>}
                    {month.isHighDebt && <Badge variant="outline" className="border-warning text-warning">High Debt</Badge>}
                    <div className={`text-lg font-bold ${month.freeCash < 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatINR(month.freeCash)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}
