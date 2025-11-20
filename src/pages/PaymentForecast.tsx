import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { formatINR, formatINRDetailed } from '@/lib/currency';
import { format } from 'date-fns';
import {
  generatePaymentForecast,
  calculateQuarterlySummary,
  getPeakPaymentMonths,
  calculateAverageMonthlyPayment,
  getLoanPaymentDistribution,
  MonthlyForecast,
  LoanData,
} from '@/lib/payment-forecast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export default function PaymentForecast() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [forecasts, setForecasts] = useState<MonthlyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthsAhead, setMonthsAhead] = useState(12);

  useEffect(() => {
    fetchLoansAndForecasts();
  }, []);

  useEffect(() => {
    if (loans.length > 0) {
      const newForecasts = generatePaymentForecast(loans, monthsAhead);
      setForecasts(newForecasts);
    }
  }, [loans, monthsAhead]);

  const fetchLoansAndForecasts = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          lender:lenders(name),
          amortization_rows(
            due_on,
            scheduled_emi,
            principal_component,
            interest_component,
            closing_principal,
            is_paid,
            period_no
          )
        `)
        .eq('user_id', user.user.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLoans(data || []);
      
      if (data && data.length > 0) {
        const forecasts = generatePaymentForecast(data, monthsAhead);
        setForecasts(forecasts);
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-1/3"></div>
          <div className="h-64 bg-secondary rounded"></div>
        </div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No active loans found. Add a loan to see payment forecasts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalForecast = forecasts.reduce((sum, f) => sum + f.totalPayments, 0);
  const averageMonthly = calculateAverageMonthlyPayment(forecasts);
  const peakMonths = getPeakPaymentMonths(forecasts, 3);
  const loanDistribution = getLoanPaymentDistribution(forecasts);
  const quarterlySummary = calculateQuarterlySummary(forecasts);

  const chartData = forecasts.map(f => ({
    month: f.month,
    total: f.totalPayments,
    principal: f.totalPrincipal,
    interest: f.totalInterest,
    count: f.loanCount,
  }));

  const pieData = loanDistribution.map(loan => ({
    name: loan.loanName,
    value: loan.totalAmount,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Payment Forecast</h1>
          <p className="text-muted-foreground">Projected payment schedule for the next {monthsAhead} months</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={monthsAhead === 6 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthsAhead(6)}
          >
            6 Months
          </Button>
          <Button
            variant={monthsAhead === 12 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthsAhead(12)}
          >
            12 Months
          </Button>
          <Button
            variant={monthsAhead === 24 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthsAhead(24)}
          >
            24 Months
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forecast</CardTitle>
            <DollarSign className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalForecast)}</div>
            <p className="text-xs text-muted-foreground">Next {monthsAhead} months</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Monthly</CardTitle>
            <TrendingUp className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(averageMonthly)}</div>
            <p className="text-xs text-muted-foreground">Per month average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Month</CardTitle>
            <AlertCircle className="ml-auto h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(peakMonths[0]?.totalPayments || 0)}</div>
            <p className="text-xs text-muted-foreground">{peakMonths[0]?.month}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Calendar className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.length}</div>
            <p className="text-xs text-muted-foreground">Tracked loans</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Payment Projection</CardTitle>
          <CardDescription>Total payments breakdown by month</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={100} />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatINR(value)} />
              <Legend />
              <Bar dataKey="principal" name="Principal" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="interest" name="Interest" stackId="a" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Trend</CardTitle>
            <CardDescription>Monthly payment amounts over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatINR(value)} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total Payment" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Distribution</CardTitle>
            <CardDescription>Total payments by loan</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quarterly Summary</CardTitle>
          <CardDescription>Payment totals by quarter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(quarterlySummary).map(([quarter, data]) => (
              <Card key={quarter}>
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground">{quarter}</div>
                  <div className="text-2xl font-bold mt-2">{formatINR(data.total)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{data.count} payments</p>
                  <p className="text-xs text-muted-foreground">{data.months.join(', ')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Payment Schedule</CardTitle>
          <CardDescription>Detailed breakdown of upcoming payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {forecasts.map((forecast, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{forecast.month}</CardTitle>
                    <Badge variant={forecast.totalPayments > averageMonthly * 1.2 ? 'destructive' : 'secondary'}>
                      {formatINR(forecast.totalPayments)}
                    </Badge>
                  </div>
                  <CardDescription>
                    {forecast.loanCount} payment{forecast.loanCount !== 1 ? 's' : ''} due
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {forecast.loanPayments.length > 0 ? (
                    <div className="space-y-2">
                      {forecast.loanPayments.map((payment, payIdx) => (
                        <div key={payIdx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{payment.loanName}</div>
                            <div className="text-sm text-muted-foreground">
                              {payment.lenderName} • Due: {format(payment.dueDate, 'dd MMM yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Principal: {formatINR(payment.principalComponent)} | 
                              Interest: {formatINR(payment.interestComponent)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{formatINR(payment.emiAmount)}</div>
                            <div className="text-xs text-muted-foreground">
                              Balance: {formatINR(payment.outstandingBalance)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No payments due this month</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan Payment Summary</CardTitle>
          <CardDescription>Total payments per loan over forecast period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Loan</th>
                  <th className="text-right py-3 px-4">Payment Count</th>
                  <th className="text-right py-3 px-4">Total Amount</th>
                  <th className="text-right py-3 px-4">Average Payment</th>
                </tr>
              </thead>
              <tbody>
                {loanDistribution.map((loan, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-3 px-4 font-medium">{loan.loanName}</td>
                    <td className="text-right py-3 px-4">{loan.paymentCount}</td>
                    <td className="text-right py-3 px-4">{formatINR(loan.totalAmount)}</td>
                    <td className="text-right py-3 px-4">{formatINR(loan.averagePayment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
