import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, formatPercent } from "@/lib/currency";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, DollarSign, CheckCircle } from "lucide-react";
import { format, parseISO, startOfMonth, isBefore, isAfter } from "date-fns";

interface PaymentData {
  id: string;
  amount: number;
  paid_on: string;
  payment_type: string;
  method: string | null;
  loan_id: string;
  loans: {
    loan_name: string;
    due_day: number | null;
  };
  amortization_rows?: {
    due_on: string;
  }[];
}

interface MonthlyData {
  month: string;
  amount: number;
  count: number;
}

interface PaymentTypeData {
  name: string;
  value: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

export default function PaymentAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [paymentTypeData, setPaymentTypeData] = useState<PaymentTypeData[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentTypeData[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [avgAmount, setAvgAmount] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState(0);

  useEffect(() => {
    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  const fetchPaymentData = async () => {
    try {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          paid_on,
          payment_type,
          method,
          loan_id,
          loans (
            loan_name,
            due_day
          )
        `)
        .order("paid_on", { ascending: false });

      if (error) throw error;

      // Fetch amortization rows to check on-time payments
      const loanIds = paymentsData?.map(p => p.loan_id) || [];
      const { data: amortData } = await supabase
        .from("amortization_rows")
        .select("loan_id, due_on, period_no")
        .in("loan_id", loanIds)
        .eq("is_paid", true);

      // Merge amortization data with payments
      const paymentsWithAmort = paymentsData?.map(payment => ({
        ...payment,
        amortization_rows: amortData?.filter(a => a.loan_id === payment.loan_id) || []
      })) || [];

      setPayments(paymentsWithAmort);
      calculateAnalytics(paymentsWithAmort);
    } catch (error) {
      console.error("Error fetching payment data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (data: PaymentData[]) => {
    // Total and average amount
    const total = data.reduce((sum, p) => sum + Number(p.amount), 0);
    setTotalAmount(total);
    setAvgAmount(data.length > 0 ? total / data.length : 0);

    // Monthly data
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    data.forEach(payment => {
      const month = format(parseISO(payment.paid_on), "MMM yyyy");
      const existing = monthlyMap.get(month) || { amount: 0, count: 0 };
      monthlyMap.set(month, {
        amount: existing.amount + Number(payment.amount),
        count: existing.count + 1
      });
    });
    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .reverse()
      .slice(-12);
    setMonthlyData(monthly);

    // Payment type distribution
    const typeMap = new Map<string, number>();
    data.forEach(payment => {
      const type = payment.payment_type || "OTHER";
      typeMap.set(type, (typeMap.get(type) || 0) + Number(payment.amount));
    });
    const typeData = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));
    setPaymentTypeData(typeData);

    // Payment method distribution
    const methodMap = new Map<string, number>();
    data.forEach(payment => {
      const method = payment.method || "Not specified";
      methodMap.set(method, (methodMap.get(method) || 0) + 1);
    });
    const methodData = Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));
    setPaymentMethodData(methodData);

    // On-time payment rate (EMI payments only)
    const emiPayments = data.filter(p => p.payment_type === "EMI");
    let onTimeCount = 0;
    emiPayments.forEach(payment => {
      const dueDay = payment.loans?.due_day;
      if (dueDay) {
        const paidDate = parseISO(payment.paid_on);
        const paidDay = paidDate.getDate();
        // Consider on-time if paid on or before due day
        if (paidDay <= dueDay) {
          onTimeCount++;
        }
      }
    });
    const rate = emiPayments.length > 0 ? (onTimeCount / emiPayments.length) * 100 : 0;
    setOnTimeRate(rate);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Analytics</h1>
        <p className="text-muted-foreground">Insights into your payment history and trends</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{payments.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(avgAmount)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(onTimeRate, 1)}</div>
            <p className="text-xs text-muted-foreground">EMI payments on time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatINR(monthlyData[monthlyData.length - 1]?.amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthlyData[monthlyData.length - 1]?.count || 0} payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Payment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Payment Trend</CardTitle>
            <CardDescription>Payment amounts over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatINR(value)}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Amount"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Count by Month */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Frequency</CardTitle>
            <CardDescription>Number of payments per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--secondary))" name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Type Distribution</CardTitle>
            <CardDescription>Breakdown by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatINR(entry.value)}`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {paymentTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatINR(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Distribution by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="hsl(var(--accent))"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
