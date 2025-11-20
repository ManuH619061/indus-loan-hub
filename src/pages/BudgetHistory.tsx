import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { TrendingUp, TrendingDown, Calendar, PiggyBank, CreditCard, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import FadeInStagger from "@/components/FadeInStagger";

interface BudgetHistoryData {
  monthYear: string;
  totalIncome: number;
  totalExpenses: number;
  totalEMI: number;
  savings: number;
  freeCash: number;
  debtBurden: number;
  savingsRate: number;
}

interface DebtData {
  monthYear: string;
  totalDebt: number;
  loanCount: number;
}

export default function BudgetHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryData[]>([]);
  const [debtHistory, setDebtHistory] = useState<DebtData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchHistoricalData();
  }, [user]);

  const fetchHistoricalData = async () => {
    if (!user) return;
    
    try {
      // Get last 12 months of budget data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      
      const months: string[] = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate);
        date.setMonth(startDate.getMonth() + i);
        months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      }

      // Fetch budget data
      const { data: budgets } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .in("month_year", months)
        .order("month_year");

      // Fetch loans data for debt tracking
      const { data: loans } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id);

      // Process budget history
      const historyData: BudgetHistoryData[] = months.map((month) => {
        const budget = budgets?.find((b) => b.month_year === month);
        
        const income = (budget?.salary || 0) + (budget?.side_income || 0) + (budget?.other_income || 0);
        const fixedExpenses = (budget?.rent || 0) + (budget?.food || 0) + (budget?.transport || 0) + 
                            (budget?.utilities || 0) + (budget?.school || 0) + (budget?.subscriptions || 0) + 
                            (budget?.insurance || 0);
        const variableExpenses = (budget?.eating_out || 0) + (budget?.shopping || 0) + 
                               (budget?.travel || 0) + (budget?.other_variable || 0);
        const totalExpenses = fixedExpenses + variableExpenses;
        
        // Calculate EMI for this month from active loans
        const monthDate = new Date(month + "-01");
        const totalEMI = loans?.reduce((sum, loan) => {
          if (loan.status !== "ACTIVE") return sum;
          const disbursedDate = new Date(loan.disbursed_on);
          const monthsSinceDisbursement = Math.floor((monthDate.getTime() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          if (monthsSinceDisbursement >= 0 && monthsSinceDisbursement < loan.tenure_months) {
            return sum + (loan.emi_amount || 0);
          }
          return sum;
        }, 0) || 0;

        const savings = budget?.savings_investments || 0;
        const freeCash = income - totalExpenses - totalEMI - savings;
        const debtBurden = income > 0 ? (totalEMI / income) * 100 : 0;
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;

        return {
          monthYear: month,
          totalIncome: income,
          totalExpenses,
          totalEMI,
          savings,
          freeCash,
          debtBurden,
          savingsRate,
        };
      });

      // Process debt history
      const debtData: DebtData[] = months.map((month) => {
        const monthDate = new Date(month + "-01");
        const activeLoans = loans?.filter((loan) => {
          if (loan.status !== "ACTIVE") return false;
          const disbursedDate = new Date(loan.disbursed_on);
          const monthsSinceDisbursement = Math.floor((monthDate.getTime() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          return monthsSinceDisbursement >= 0 && monthsSinceDisbursement < loan.tenure_months;
        }) || [];

        // Calculate remaining principal for each loan
        const totalDebt = activeLoans.reduce((sum, loan) => {
          const disbursedDate = new Date(loan.disbursed_on);
          const monthsSinceDisbursement = Math.floor((monthDate.getTime() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          const monthlyRate = loan.interest_rate_apy / 100 / 12;
          const emi = loan.emi_amount || 0;
          const remainingMonths = loan.tenure_months - monthsSinceDisbursement;
          
          // Calculate remaining principal using EMI formula
          const remainingPrincipal = remainingMonths > 0 
            ? emi * ((Math.pow(1 + monthlyRate, remainingMonths) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)))
            : 0;
          
          return sum + remainingPrincipal;
        }, 0);

        return {
          monthYear: month,
          totalDebt,
          loanCount: activeLoans.length,
        };
      });

      // Process expense categories for comparison
      const categories = months.map((month) => {
        const budget = budgets?.find((b) => b.month_year === month);
        return {
          month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          Rent: budget?.rent || 0,
          Food: budget?.food || 0,
          Transport: budget?.transport || 0,
          Shopping: budget?.shopping || 0,
          "Eating Out": budget?.eating_out || 0,
          Travel: budget?.travel || 0,
          Other: (budget?.utilities || 0) + (budget?.school || 0) + (budget?.subscriptions || 0) + (budget?.insurance || 0) + (budget?.other_variable || 0),
        };
      });

      setBudgetHistory(historyData);
      setDebtHistory(debtData);
      setExpenseCategories(categories);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = budgetHistory.map((item, index) => ({
    month: new Date(item.monthYear + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Income: item.totalIncome,
    Expenses: item.totalExpenses,
    EMI: item.totalEMI,
    Savings: item.savings,
    "Free Cash": item.freeCash,
    "Debt Burden": item.debtBurden,
    "Savings Rate": item.savingsRate,
    "Total Debt": debtHistory[index]?.totalDebt || 0,
  }));

  // Calculate summary metrics
  const avgIncome = budgetHistory.reduce((sum, item) => sum + item.totalIncome, 0) / (budgetHistory.length || 1);
  const avgSavingsRate = budgetHistory.reduce((sum, item) => sum + item.savingsRate, 0) / (budgetHistory.length || 1);
  const debtReduction = debtHistory.length > 1 ? debtHistory[0].totalDebt - debtHistory[debtHistory.length - 1].totalDebt : 0;
  const currentDebtBurden = budgetHistory.length > 0 ? budgetHistory[budgetHistory.length - 1].debtBurden : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Budget History</h1>
        <p className="text-muted-foreground mt-2">12-month trends, patterns, and progress tracking</p>
      </div>

      <FadeInStagger>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Monthly Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(avgIncome)}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 12 months</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Savings Rate</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgSavingsRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Of total income</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Debt Reduction</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(debtReduction)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total reduced</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Debt Burden</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentDebtBurden.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">EMI to income ratio</p>
            </CardContent>
          </Card>
        </div>

        {/* Income vs Expenses Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 items-center">
              <BarChart3 className="h-5 w-5" />
              Income vs Expenses Trend
            </CardTitle>
            <CardDescription>Monthly comparison of income, expenses, EMI, and savings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Area type="monotone" dataKey="Income" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Expenses" stackId="2" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="EMI" stackId="2" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Savings" stackId="2" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Pattern Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 items-center">
              <Calendar className="h-5 w-5" />
              Expense Pattern Analysis
            </CardTitle>
            <CardDescription>Category-wise spending breakdown over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={expenseCategories}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="Rent" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Food" stackId="a" fill="hsl(var(--secondary))" />
                <Bar dataKey="Transport" stackId="a" fill="hsl(var(--accent))" />
                <Bar dataKey="Shopping" stackId="a" fill="hsl(var(--warning))" />
                <Bar dataKey="Eating Out" stackId="a" fill="hsl(var(--destructive))" />
                <Bar dataKey="Travel" stackId="a" fill="hsl(var(--success))" />
                <Bar dataKey="Other" stackId="a" fill="hsl(var(--muted))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Savings Rate & Debt Burden */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <PiggyBank className="h-5 w-5" />
                Savings Rate Tracking
              </CardTitle>
              <CardDescription>Percentage of income saved each month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `${value}%`} />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="Savings Rate" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <CreditCard className="h-5 w-5" />
                Debt Burden Trend
              </CardTitle>
              <CardDescription>EMI to income ratio over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `${value}%`} />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="Debt Burden" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Debt Reduction Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 items-center">
              <TrendingDown className="h-5 w-5" />
              Debt Reduction Progress
            </CardTitle>
            <CardDescription>Total outstanding debt over 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="Total Debt" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Free Cash Flow Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 items-center">
              <TrendingUp className="h-5 w-5" />
              Free Cash Flow Analysis
            </CardTitle>
            <CardDescription>Available cash after all expenses and EMIs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="Free Cash" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}
