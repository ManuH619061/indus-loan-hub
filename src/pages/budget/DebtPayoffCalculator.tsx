import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { 
  compareStrategies, 
  type LoanForOptimization, 
  type PayoffStrategy 
} from "@/lib/debt-optimizer";
import { 
  TrendingDown, 
  Zap, 
  Target, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function DebtPayoffCalculator() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanForOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [extraPayment, setExtraPayment] = useState(5000);
  const [results, setResults] = useState<ReturnType<typeof compareStrategies> | null>(null);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch active loans with their amortization data
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*, amortization_rows(closing_principal, is_paid, period_no)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('interest_rate_apy', { ascending: false });

      if (loansError) throw loansError;

      // Calculate outstanding balance for each loan
      const loansWithOutstanding = loansData.map(loan => {
        const unpaidRows = (loan.amortization_rows || [])
          .filter((row: any) => !row.is_paid)
          .sort((a: any, b: any) => a.period_no - b.period_no);
        
        const outstanding = unpaidRows.length > 0 
          ? unpaidRows[0].closing_principal || loan.principal_amount
          : 0;

        return {
          id: loan.id,
          loan_name: loan.loan_name,
          outstanding,
          interest_rate_apy: loan.interest_rate_apy,
          emi_amount: loan.emi_amount || 0,
          rate_type: loan.rate_type as 'REDUCING' | 'FLAT',
          tenure_months: loan.tenure_months,
        };
      }).filter(loan => loan.outstanding > 0);

      setLoans(loansWithOutstanding);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      toast({
        title: "Error loading loans",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => {
    if (loans.length === 0) {
      toast({
        title: "No active loans",
        description: "Add some active loans to use the debt payoff calculator",
        variant: "destructive",
      });
      return;
    }

    setCalculating(true);
    setTimeout(() => {
      const comparison = compareStrategies(loans, extraPayment);
      setResults(comparison);
      setCalculating(false);
    }, 500);
  };

  const renderStrategyCard = (strategy: PayoffStrategy, icon: any, color: string) => {
    const Icon = icon;
    const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
    const interestSavedVsMinimum = results 
      ? results.minPaymentOnly.totalInterestPaid - strategy.totalInterestPaid
      : 0;

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${color}`} />
              <CardTitle className="text-lg">{strategy.name}</CardTitle>
            </div>
            {results?.insights && (
              <>
                {results.insights.bestForSavings === strategy.name.split(' ')[1] && (
                  <Badge variant="default" className="bg-success">Best Savings</Badge>
                )}
                {results.insights.bestForSpeed === strategy.name.split(' ')[1] && (
                  <Badge variant="default" className="bg-primary">Fastest</Badge>
                )}
              </>
            )}
          </div>
          <CardDescription>{strategy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Debt-Free Date
              </p>
              <p className="font-semibold text-success">{strategy.debtFreeDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Time to Payoff
              </p>
              <p className="font-semibold">{strategy.totalMonths} months</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Total Interest
              </p>
              <p className="font-semibold text-destructive">{formatINR(strategy.totalInterestPaid)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Total Paid
              </p>
              <p className="font-semibold">{formatINR(strategy.totalAmountPaid)}</p>
            </div>
          </div>
          
          {interestSavedVsMinimum > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-success">
                💰 Save {formatINR(interestSavedVsMinimum)} vs minimum payments
              </p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Payoff Progress</p>
            <Progress value={0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">Start paying to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPayoffScheduleTable = (strategy: PayoffStrategy) => {
    // Show first 12 months
    const displayMonths = strategy.monthlySchedule.slice(0, 12);

    return (
      <div className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Payment</TableHead>
                <TableHead className="text-right">Interest Paid</TableHead>
                <TableHead className="text-right">Remaining Debt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMonths.map((month) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">{month.month}</TableCell>
                  <TableCell>{new Date(month.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(month.totalPayment)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatINR(month.totalInterest)}</TableCell>
                  <TableCell className="text-right">{formatINR(month.remainingDebt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {strategy.monthlySchedule.length > 12 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing first 12 months of {strategy.totalMonths} total months
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
  const totalMinEMI = loans.reduce((sum, l) => sum + l.emi_amount, 0);
  const avgInterestRate = loans.length > 0 
    ? loans.reduce((sum, l) => sum + l.interest_rate_apy, 0) / loans.length 
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Debt Payoff Calculator</h1>
        <p className="text-muted-foreground">
          Compare snowball vs avalanche strategies to find the fastest path to debt freedom
        </p>
      </div>

      {loans.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No active loans found</AlertTitle>
          <AlertDescription>
            Add some active loans to start optimizing your debt payoff strategy.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding Debt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(totalDebt)}</p>
                <p className="text-xs text-muted-foreground mt-1">{loans.length} active loans</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly EMI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(totalMinEMI)}</p>
                <p className="text-xs text-muted-foreground mt-1">Minimum payment</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Interest Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{avgInterestRate.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configure Extra Payment</CardTitle>
              <CardDescription>
                How much extra can you pay each month towards debt?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="extraPayment">Extra Monthly Payment</Label>
                  <Input
                    id="extraPayment"
                    type="number"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(Number(e.target.value))}
                    min={0}
                    step={1000}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleCalculate} disabled={calculating} className="gap-2">
                  {calculating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Calculate Strategies
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <p>Total monthly payment: {formatINR(totalMinEMI + extraPayment)}</p>
              </div>
            </CardContent>
          </Card>

          {results && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {renderStrategyCard(results.avalanche, TrendingDown, "text-success")}
                {renderStrategyCard(results.snowball, Target, "text-primary")}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" />
                    Strategy Comparison
                  </CardTitle>
                  <CardDescription>
                    Side-by-side comparison of debt payoff strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Key Insights</AlertTitle>
                    <AlertDescription className="space-y-2 mt-2">
                      <p>
                        • <strong>{results.insights.bestForSavings === 'Avalanche' ? 'Avalanche' : 'Snowball'}</strong> saves you{' '}
                        <strong className="text-success">{formatINR(results.insights.savingsDifference)}</strong> more in interest
                      </p>
                      <p>
                        • <strong>{results.insights.bestForSpeed === 'Avalanche' ? 'Avalanche' : 'Snowball'}</strong> makes you debt-free{' '}
                        <strong className="text-primary">{results.insights.timeDifference} months</strong> faster
                      </p>
                      <p>
                        • With <strong>{formatINR(extraPayment)}/month</strong> extra payment, you'll save{' '}
                        <strong className="text-success">
                          {formatINR(results.minPaymentOnly.totalInterestPaid - results.avalanche.totalInterestPaid)}
                        </strong>{' '}
                        vs minimum payments
                      </p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Visual Charts Section */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Interest Comparison Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Total Interest Comparison</CardTitle>
                    <CardDescription>Compare interest paid across strategies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: 'Minimum Only',
                            interest: results.minPaymentOnly.totalInterestPaid,
                            months: results.minPaymentOnly.totalMonths,
                          },
                          {
                            name: 'Avalanche',
                            interest: results.avalanche.totalInterestPaid,
                            months: results.avalanche.totalMonths,
                          },
                          {
                            name: 'Snowball',
                            interest: results.snowball.totalInterestPaid,
                            months: results.snowball.totalMonths,
                          },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis 
                          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                          className="text-xs"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-lg">
                                  <p className="font-semibold">{payload[0].payload.name}</p>
                                  <p className="text-sm text-destructive">
                                    Interest: {formatINR(payload[0].value as number)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Duration: {payload[0].payload.months} months
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="interest" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Payoff Timeline Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payoff Timeline</CardTitle>
                    <CardDescription>Months to become debt-free</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: 'Minimum Only',
                            months: results.minPaymentOnly.totalMonths,
                            years: (results.minPaymentOnly.totalMonths / 12).toFixed(1),
                          },
                          {
                            name: 'Avalanche',
                            months: results.avalanche.totalMonths,
                            years: (results.avalanche.totalMonths / 12).toFixed(1),
                          },
                          {
                            name: 'Snowball',
                            months: results.snowball.totalMonths,
                            years: (results.snowball.totalMonths / 12).toFixed(1),
                          },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis 
                          label={{ value: 'Months', angle: -90, position: 'insideLeft' }}
                          className="text-xs"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-lg">
                                  <p className="font-semibold">{payload[0].payload.name}</p>
                                  <p className="text-sm text-primary">
                                    {payload[0].value} months ({payload[0].payload.years} years)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="months" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Debt Paydown Timeline Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Debt Paydown Timeline</CardTitle>
                  <CardDescription>
                    Track how your total debt decreases over time with each strategy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart
                      data={(() => {
                        const maxMonths = Math.max(
                          results.avalanche.totalMonths,
                          results.snowball.totalMonths,
                          Math.min(results.minPaymentOnly.totalMonths, 120) // Cap minimum at 120 months for display
                        );
                        
                        return Array.from({ length: maxMonths }, (_, i) => {
                          const month = i + 1;
                          const avalancheData = results.avalanche.monthlySchedule[i];
                          const snowballData = results.snowball.monthlySchedule[i];
                          const minData = results.minPaymentOnly.monthlySchedule[i];
                          
                          return {
                            month,
                            avalanche: avalancheData?.remainingDebt || 0,
                            snowball: snowballData?.remainingDebt || 0,
                            minimum: minData?.remainingDebt || 0,
                          };
                        });
                      })()}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorAvalanche" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorSnowball" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorMinimum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                        label={{ value: 'Remaining Debt', angle: -90, position: 'insideLeft' }}
                        className="text-xs"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg">
                                <p className="font-semibold mb-2">Month {payload[0].payload.month}</p>
                                {payload.map((entry: any, index: number) => (
                                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                                    {entry.name}: {formatINR(entry.value)}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="minimum"
                        name="Minimum Payment"
                        stroke="hsl(var(--muted-foreground))"
                        fill="url(#colorMinimum)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="snowball"
                        name="Snowball"
                        stroke="hsl(var(--primary))"
                        fill="url(#colorSnowball)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="avalanche"
                        name="Avalanche"
                        stroke="hsl(var(--success))"
                        fill="url(#colorAvalanche)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Individual Loan Balance Progression */}
              <Card>
                <CardHeader>
                  <CardTitle>Individual Loan Progression (Avalanche)</CardTitle>
                  <CardDescription>
                    See how each loan balance decreases over time with the avalanche strategy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={(() => {
                        const colors = [
                          'hsl(var(--chart-1))',
                          'hsl(var(--chart-2))',
                          'hsl(var(--chart-3))',
                          'hsl(var(--chart-4))',
                          'hsl(var(--chart-5))',
                        ];
                        
                        return results.avalanche.monthlySchedule.map((monthData, idx) => {
                          const dataPoint: any = { month: monthData.month };
                          monthData.loans.forEach((loan, loanIdx) => {
                            dataPoint[loan.loanName] = loan.remainingBalance;
                          });
                          return dataPoint;
                        });
                      })()}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                        label={{ value: 'Balance', angle: -90, position: 'insideLeft' }}
                        className="text-xs"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg max-h-64 overflow-auto">
                                <p className="font-semibold mb-2">Month {payload[0].payload.month}</p>
                                {payload.map((entry: any, index: number) => (
                                  entry.value > 0 && (
                                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                                      {entry.name}: {formatINR(entry.value)}
                                    </p>
                                  )
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {loans.map((loan, idx) => (
                        <Line
                          key={loan.id}
                          type="monotone"
                          dataKey={loan.loan_name}
                          name={loan.loan_name}
                          stroke={`hsl(var(--chart-${(idx % 5) + 1}))`}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Loan Portfolio</CardTitle>
                  <CardDescription>Current active loans sorted by priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loan Name</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Interest Rate</TableHead>
                          <TableHead className="text-right">Monthly EMI</TableHead>
                          <TableHead>Snowball Priority</TableHead>
                          <TableHead>Avalanche Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loans.map((loan, idx) => {
                          const snowballPriority = [...loans].sort((a, b) => a.outstanding - b.outstanding).findIndex(l => l.id === loan.id) + 1;
                          const avalanchePriority = [...loans].sort((a, b) => b.interest_rate_apy - a.interest_rate_apy).findIndex(l => l.id === loan.id) + 1;
                          
                          return (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">{loan.loan_name}</TableCell>
                              <TableCell className="text-right">{formatINR(loan.outstanding)}</TableCell>
                              <TableCell className="text-right">{loan.interest_rate_apy}%</TableCell>
                              <TableCell className="text-right">{formatINR(loan.emi_amount)}</TableCell>
                              <TableCell>
                                <Badge variant={snowballPriority === 1 ? "default" : "outline"}>
                                  #{snowballPriority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={avalanchePriority === 1 ? "default" : "outline"}>
                                  #{avalanchePriority}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="avalanche" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="avalanche">Avalanche Schedule</TabsTrigger>
                  <TabsTrigger value="snowball">Snowball Schedule</TabsTrigger>
                  <TabsTrigger value="minimum">Minimum Only</TabsTrigger>
                </TabsList>

                <TabsContent value="avalanche" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Avalanche Payment Schedule</CardTitle>
                      <CardDescription>
                        Monthly breakdown of payments using the avalanche method
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.avalanche)}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="snowball" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Snowball Payment Schedule</CardTitle>
                      <CardDescription>
                        Monthly breakdown of payments using the snowball method
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.snowball)}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="minimum" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Minimum Payment Schedule</CardTitle>
                      <CardDescription>
                        What happens if you only pay minimum EMIs (no extra payments)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.minPaymentOnly)}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
}
