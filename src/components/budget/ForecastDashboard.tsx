import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, formatPercent } from "@/lib/currency";
import { AlertCircle, TrendingDown, CheckCircle, Calendar, RefreshCw, TrendingUp, Wallet, Expand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addMonths, startOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";

interface MonthForecast {
  month: string;
  monthKey: string;
  income: number;
  emis: number;
  fixedExpenses: number;
  lifestyleBudget: number;
  plannedSavings: number;
  freeCash: number;
  debtBurden: number;
  hasBudget: boolean;
}

export default function ForecastDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<MonthForecast[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchForecastData();
    }
  }, [user]);

  const fetchForecastData = async () => {
    if (!user) return;
    
    try {
      setRefreshing(true);
      
      // Fetch all data in parallel
      const [
        { data: budgets },
        { data: loans },
        { data: salarySettings },
        { data: incomeSources },
        { data: savingsGoals },
        { data: recurringExpenses },
        { data: amortizationRows }
      ] = await Promise.all([
        supabase.from("monthly_budgets").select("*").eq("user_id", user.id),
        supabase.from("loans").select("*").eq("user_id", user.id).eq("status", "ACTIVE"),
        supabase.from("salary_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("income_sources").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("savings_goals").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("recurring_expenses").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("amortization_rows").select("*, loans!inner(user_id, status)").eq("loans.user_id", user.id).eq("loans.status", "ACTIVE")
      ]);

      // Generate 12-month forecast
      const forecastData: MonthForecast[] = [];
      const today = startOfMonth(new Date());

      for (let i = 0; i < 12; i++) {
        const date = addMonths(today, i);
        const monthKey = format(date, "yyyy-MM");
        const monthLabel = format(date, "MMM yyyy");

        // Find budget for this month
        const monthBudget = budgets?.find(b => b.month_year === monthKey);
        const hasBudget = !!monthBudget;

        // Calculate income
        let income = 0;
        
        // Base salary from budget or salary settings
        if (monthBudget?.salary) {
          income += monthBudget.salary;
        } else if (salarySettings?.base_salary) {
          let baseSalary = salarySettings.base_salary;
          
          // Apply increment if applicable
          if (salarySettings.increment_month && date.getMonth() + 1 >= salarySettings.increment_month) {
            if (salarySettings.increment_type === "percentage") {
              baseSalary = baseSalary * (1 + (salarySettings.increment_value || 0) / 100);
            } else {
              baseSalary = baseSalary + (salarySettings.increment_value || 0);
            }
          }
          income += baseSalary;
        }

        // Add other income sources
        if (incomeSources) {
          for (const source of incomeSources) {
            const startDate = source.start_month ? new Date(source.start_month) : null;
            const endDate = source.end_month ? new Date(source.end_month) : null;
            
            if (startDate && date < startDate) continue;
            if (endDate && date > endDate) continue;

            if (source.frequency === "monthly") {
              income += source.amount || 0;
            } else if (source.frequency === "quarterly" && date.getMonth() % 3 === 0) {
              income += source.amount || 0;
            } else if (source.frequency === "yearly" && date.getMonth() === 0) {
              income += source.amount || 0;
            }
          }
        }

        // Calculate EMIs from amortization schedule
        let emis = 0;
        if (amortizationRows) {
          const monthEmis = amortizationRows.filter(row => {
            const dueDate = new Date(row.due_on);
            return format(dueDate, "yyyy-MM") === monthKey && !row.is_paid;
          });
          emis = monthEmis.reduce((sum, row) => sum + (row.scheduled_emi || 0), 0);
        }

        // Fallback to loan EMI amounts if no amortization data
        if (emis === 0 && loans) {
          emis = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
        }

        // Calculate fixed expenses
        let fixedExpenses = 0;
        if (monthBudget) {
          fixedExpenses = (monthBudget.rent || 0) + 
                         (monthBudget.food || 0) + 
                         (monthBudget.transport || 0) + 
                         (monthBudget.utilities || 0) + 
                         (monthBudget.school || 0) + 
                         (monthBudget.subscriptions || 0) + 
                         (monthBudget.insurance || 0);
        }

        // Add recurring expenses
        if (recurringExpenses) {
          for (const expense of recurringExpenses) {
            const startDate = expense.start_date ? new Date(expense.start_date) : null;
            const endDate = expense.end_date ? new Date(expense.end_date) : null;
            
            if (startDate && date < startDate) continue;
            if (endDate && date > endDate) continue;

            if (expense.frequency === "monthly") {
              fixedExpenses += expense.amount || 0;
            } else if (expense.frequency === "quarterly" && date.getMonth() % 3 === 0) {
              fixedExpenses += expense.amount || 0;
            } else if (expense.frequency === "yearly" && date.getMonth() === 0) {
              fixedExpenses += expense.amount || 0;
            }
          }
        }

        // Calculate lifestyle/variable budget
        let lifestyleBudget = 0;
        if (monthBudget) {
          lifestyleBudget = (monthBudget.eating_out || 0) + 
                           (monthBudget.shopping || 0) + 
                           (monthBudget.travel || 0) + 
                           (monthBudget.other_variable || 0);
        }

        // Calculate planned savings
        let plannedSavings = monthBudget?.savings_investments || 0;
        if (savingsGoals) {
          plannedSavings += savingsGoals.reduce((sum, goal) => sum + (goal.monthly_contribution || 0), 0);
        }

        // Calculate free cash
        const freeCash = income - emis - fixedExpenses - lifestyleBudget - plannedSavings;
        const debtBurden = income > 0 ? (emis / income) * 100 : 0;

        forecastData.push({
          month: monthLabel,
          monthKey,
          income,
          emis,
          fixedExpenses,
          lifestyleBudget,
          plannedSavings,
          freeCash,
          debtBurden,
          hasBudget
        });
      }

      setForecasts(forecastData);
    } catch (error) {
      console.error("Error fetching forecast data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMonthClick = (monthKey: string) => {
    navigate(`/budget-planner?month=${monthKey}`);
  };

  // Calculate totals
  const totals = forecasts.reduce(
    (acc, f) => ({
      income: acc.income + f.income,
      emis: acc.emis + f.emis,
      fixedExpenses: acc.fixedExpenses + f.fixedExpenses,
      lifestyleBudget: acc.lifestyleBudget + f.lifestyleBudget,
      plannedSavings: acc.plannedSavings + f.plannedSavings,
      freeCash: acc.freeCash + f.freeCash,
    }),
    { income: 0, emis: 0, fixedExpenses: 0, lifestyleBudget: 0, plannedSavings: 0, freeCash: 0 }
  );

  const avgDebtBurden = totals.income > 0 ? (totals.emis / totals.income) * 100 : 0;
  const negativeMonths = forecasts.filter(f => f.freeCash < 0).length;
  const healthyMonths = forecasts.filter(f => f.freeCash > 0 && f.debtBurden < 40).length;
  const monthsWithBudget = forecasts.filter(f => f.hasBudget).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="forecast">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              12-Month Financial Forecast
            </CardTitle>
            <CardDescription className="mt-1">
              Data pulled from your budgets, loans, income sources & recurring expenses
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchForecastData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate("/budget/forecast")}
            >
              <Expand className="h-4 w-4 mr-2" />
              Full View
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Budgets Set
            </div>
            <div className="text-lg font-semibold">{monthsWithBudget}/12 months</div>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              Healthy Months
            </div>
            <div className="text-lg font-semibold text-success">{healthyMonths}</div>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Deficit Months
            </div>
            <div className="text-lg font-semibold text-destructive">{negativeMonths}</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              <TrendingUp className="h-4 w-4" />
              Avg Debt Burden
            </div>
            <div className="text-lg font-semibold">{formatPercent(avgDebtBurden)}</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] font-semibold">Month</TableHead>
                <TableHead className="font-semibold text-right">Income</TableHead>
                <TableHead className="font-semibold text-right">EMIs</TableHead>
                <TableHead className="font-semibold text-right">Fixed</TableHead>
                <TableHead className="font-semibold text-right">Lifestyle</TableHead>
                <TableHead className="font-semibold text-right">Savings</TableHead>
                <TableHead className="font-semibold text-right">Free Cash</TableHead>
                <TableHead className="font-semibold text-center">Debt %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.map((forecast, index) => {
                const isNegativeCash = forecast.freeCash < 0;
                const isHighDebt = forecast.debtBurden > 40;
                const isHealthy = forecast.freeCash > 0 && forecast.debtBurden < 40;
                const isCurrentMonth = index === 0;

                return (
                  <TableRow
                    key={forecast.monthKey}
                    className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                      isNegativeCash ? "bg-destructive/10 hover:bg-destructive/15" : 
                      isHealthy ? "bg-success/5 hover:bg-success/10" : ""
                    }`}
                    onClick={() => handleMonthClick(forecast.monthKey)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{forecast.month}</span>
                        {isCurrentMonth && (
                          <Badge variant="outline" className="text-[10px] px-1">Now</Badge>
                        )}
                        {!forecast.hasBudget && (
                          <Badge variant="secondary" className="text-[10px] px-1">No Budget</Badge>
                        )}
                        {isNegativeCash && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {isHealthy && forecast.hasBudget && (
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {forecast.income > 0 ? formatINR(forecast.income) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {forecast.emis > 0 ? formatINR(forecast.emis) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {forecast.fixedExpenses > 0 ? formatINR(forecast.fixedExpenses) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {forecast.lifestyleBudget > 0 ? formatINR(forecast.lifestyleBudget) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {forecast.plannedSavings > 0 ? formatINR(forecast.plannedSavings) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`font-semibold ${isNegativeCash ? "text-destructive" : forecast.freeCash > 0 ? "text-success" : ""}`}>
                        {forecast.income > 0 ? formatINR(forecast.freeCash) : "-"}
                        {isNegativeCash && <TrendingDown className="inline h-4 w-4 ml-1" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {forecast.income > 0 ? (
                        <Badge
                          variant={isHighDebt ? "destructive" : forecast.debtBurden > 30 ? "secondary" : "default"}
                          className="text-xs"
                        >
                          {formatPercent(forecast.debtBurden)}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted font-semibold">
                <TableCell>12-Month Total</TableCell>
                <TableCell className="text-right text-success">{formatINR(totals.income)}</TableCell>
                <TableCell className="text-right text-primary">{formatINR(totals.emis)}</TableCell>
                <TableCell className="text-right">{formatINR(totals.fixedExpenses)}</TableCell>
                <TableCell className="text-right">{formatINR(totals.lifestyleBudget)}</TableCell>
                <TableCell className="text-right">{formatINR(totals.plannedSavings)}</TableCell>
                <TableCell className={`text-right ${totals.freeCash >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatINR(totals.freeCash)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={avgDebtBurden > 40 ? "destructive" : "default"} className="text-xs">
                    ~{formatPercent(avgDebtBurden)}
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell>Monthly Average</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.income / 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.emis / 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.fixedExpenses / 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.lifestyleBudget / 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.plannedSavings / 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatINR(totals.freeCash / 12)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-success/20 border border-success/50" />
            <span>Healthy ({healthyMonths})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/50" />
            <span>Deficit ({negativeMonths})</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1">No Budget</Badge>
            <span>Click to set budget</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}