import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/lib/currency";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react";
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  paid_on: string;
  payment_type: string;
  loans: {
    loan_name: string;
    emi_amount: number;
    due_day: number;
  };
}

interface Loan {
  id: string;
  loan_name: string;
  emi_amount: number;
  principal_amount: number;
  interest_rate_apy: number;
  status: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

export default function PaymentAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [savingIncome, setSavingIncome] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      
      if (data && (data as any).monthly_income) {
        setMonthlyIncome((data as any).monthly_income);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const saveMonthlyIncome = async () => {
    if (!monthlyIncome || parseFloat(monthlyIncome) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid income",
        description: "Please enter a valid monthly income amount"
      });
      return;
    }

    setSavingIncome(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ monthly_income: parseFloat(monthlyIncome) } as any)
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Income saved",
        description: "Your monthly income has been updated"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } finally {
      setSavingIncome(false);
    }
  };

  const fetchData = async () => {
    try {
      const [paymentsRes, loansRes] = await Promise.all([
        supabase
          .from("payments")
          .select("*, loans(loan_name, emi_amount, due_day)")
          .order("paid_on", { ascending: false }),
        supabase
          .from("loans")
          .select("*")
          .eq("status", "ACTIVE")
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data as any);
      if (loansRes.data) setLoans(loansRes.data as Loan[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate payment trends over last 12 months
  const getPaymentTrends = () => {
    const last12Months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date()
    });

    return last12Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthPayments = payments.filter(p => {
        const paidDate = parseISO(p.paid_on);
        return paidDate >= monthStart && paidDate <= monthEnd;
      });

      const totalAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const emiPayments = monthPayments.filter(p => p.payment_type === 'EMI');
      const prepayments = monthPayments.filter(p => p.payment_type === 'PART_PREPAY' || p.payment_type === 'FULL_PREPAY');

      return {
        month: format(month, 'MMM yy'),
        total: totalAmount,
        emi: emiPayments.reduce((sum, p) => sum + p.amount, 0),
        prepayment: prepayments.reduce((sum, p) => sum + p.amount, 0),
        count: monthPayments.length
      };
    });
  };

  // Calculate on-time vs late payments
  const getPaymentTimeliness = () => {
    const emiPayments = payments.filter(p => p.payment_type === 'EMI');
    
    let onTime = 0;
    let late = 0;

    emiPayments.forEach(payment => {
      const paidDate = parseISO(payment.paid_on);
      const dueDay = payment.loans?.due_day || 5;
      const paymentDay = paidDate.getDate();
      
      if (paymentDay <= dueDay + 3) {
        onTime++;
      } else {
        late++;
      }
    });

    return [
      { name: 'On-Time', value: onTime, percentage: ((onTime / (onTime + late)) * 100).toFixed(1) },
      { name: 'Late', value: late, percentage: ((late / (onTime + late)) * 100).toFixed(1) }
    ];
  };

  // Calculate interest paid over time
  const getInterestPaidTrends = () => {
    const last12Months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date()
    });

    return last12Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthPayments = payments.filter(p => {
        const paidDate = parseISO(p.paid_on);
        return paidDate >= monthStart && paidDate <= monthEnd && p.payment_type === 'EMI';
      });

      // Rough estimate: 60% of EMI goes to interest in early months
      const estimatedInterest = monthPayments.reduce((sum, p) => {
        return sum + (p.amount * 0.6);
      }, 0);

      return {
        month: format(month, 'MMM yy'),
        interest: estimatedInterest,
        principal: monthPayments.reduce((sum, p) => sum + (p.amount * 0.4), 0)
      };
    });
  };

  // Calculate EMI burden
  const getEmiBurden = () => {
    const totalEmi = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
    const income = parseFloat(monthlyIncome) || 0;
    
    if (income === 0) return { totalEmi, burden: 0, remaining: 0 };
    
    const burden = (totalEmi / income) * 100;
    const remaining = income - totalEmi;

    return { totalEmi, burden, remaining };
  };

  // Calculate summary stats
  const getSummaryStats = () => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const emiPayments = payments.filter(p => p.payment_type === 'EMI');
    const prepayments = payments.filter(p => p.payment_type === 'PART_PREPAY' || p.payment_type === 'FULL_PREPAY');
    const timeliness = getPaymentTimeliness();
    
    return {
      totalPaid,
      totalPayments: payments.length,
      avgPayment: payments.length > 0 ? totalPaid / payments.length : 0,
      totalEmiPaid: emiPayments.reduce((sum, p) => sum + p.amount, 0),
      totalPrepaid: prepayments.reduce((sum, p) => sum + p.amount, 0),
      onTimeRate: parseFloat(timeliness[0]?.percentage || '0')
    };
  };

  const paymentTrends = getPaymentTrends();
  const paymentTimeliness = getPaymentTimeliness();
  const interestTrends = getInterestPaidTrends();
  const emiBurden = getEmiBurden();
  const summaryStats = getSummaryStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Analytics</h1>
        <p className="text-muted-foreground">Track your payment history, trends, and financial health</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(summaryStats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{summaryStats.totalPayments} payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(summaryStats.avgPayment)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.onTimeRate}%</div>
            <p className="text-xs text-muted-foreground">Payment reliability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EMI Burden</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emiBurden.burden.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Of monthly income</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Income Input */}
      {(!monthlyIncome || parseFloat(monthlyIncome) === 0) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Set Your Monthly Income</CardTitle>
            <CardDescription>
              Add your monthly income to see EMI burden analysis and better financial insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="income">Monthly Income</Label>
                <Input
                  id="income"
                  type="number"
                  placeholder="Enter your monthly income"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                />
              </div>
              <Button 
                onClick={saveMonthlyIncome} 
                disabled={savingIncome}
                className="self-end"
              >
                {savingIncome ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EMI Burden Details */}
      {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>EMI Burden Analysis</CardTitle>
            <CardDescription>Your monthly loan obligations vs income</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monthly Income</span>
                <span className="text-lg font-semibold">{formatINR(parseFloat(monthlyIncome))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total EMI</span>
                <span className="text-lg font-semibold text-destructive">{formatINR(emiBurden.totalEmi)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Remaining</span>
                <span className="text-lg font-semibold text-primary">{formatINR(emiBurden.remaining)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-destructive transition-all"
                  style={{ width: `${Math.min(emiBurden.burden, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {emiBurden.burden < 40 ? (
                  <span className="text-primary">✓ Healthy EMI burden (below 40%)</span>
                ) : emiBurden.burden < 60 ? (
                  <span className="text-yellow-600">⚠ Moderate EMI burden (40-60%)</span>
                ) : (
                  <span className="text-destructive">⚠ High EMI burden (above 60%)</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Payment Trends</TabsTrigger>
          <TabsTrigger value="timeliness">On-Time Analysis</TabsTrigger>
          <TabsTrigger value="interest">Interest Breakdown</TabsTrigger>
          <TabsTrigger value="breakdown">Payment Types</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Payment Trends</CardTitle>
              <CardDescription>Track your payment patterns over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={paymentTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: any) => formatINR(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total Paid" strokeWidth={2} />
                  <Line type="monotone" dataKey="emi" stroke="hsl(var(--secondary))" name="EMI Payments" strokeWidth={2} />
                  <Line type="monotone" dataKey="prepayment" stroke="hsl(var(--accent))" name="Prepayments" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeliness" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Timeliness</CardTitle>
                <CardDescription>On-time vs late payment distribution</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentTimeliness}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentTimeliness.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Statistics</CardTitle>
                <CardDescription>Detailed breakdown of your payment behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{paymentTimeliness[0]?.value || 0}</p>
                    <p className="text-sm text-muted-foreground">On-time payments</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{paymentTimeliness[1]?.value || 0}</p>
                    <p className="text-sm text-muted-foreground">Late payments</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-accent" />
                  <div>
                    <p className="text-2xl font-bold">{summaryStats.totalPayments}</p>
                    <p className="text-sm text-muted-foreground">Total payments made</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="interest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interest vs Principal Over Time</CardTitle>
              <CardDescription>Estimated interest and principal components of your EMI payments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={interestTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: any) => formatINR(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="interest" 
                    stackId="1" 
                    stroke="hsl(var(--destructive))" 
                    fill="hsl(var(--destructive))" 
                    fillOpacity={0.6}
                    name="Interest Paid"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="principal" 
                    stackId="1" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.6}
                    name="Principal Paid"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                * Interest estimates are approximations based on typical EMI structures
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Type Breakdown</CardTitle>
              <CardDescription>Distribution of EMI vs prepayments over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={paymentTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: any) => formatINR(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="emi" fill="hsl(var(--primary))" name="EMI Payments" />
                  <Bar dataKey="prepayment" fill="hsl(var(--accent))" name="Prepayments" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total EMI Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(summaryStats.totalEmiPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">Regular installments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Prepaid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(summaryStats.totalPrepaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">Additional payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Prepayment Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {summaryStats.totalPaid > 0 
                    ? ((summaryStats.totalPrepaid / summaryStats.totalPaid) * 100).toFixed(1)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Of total payments</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
