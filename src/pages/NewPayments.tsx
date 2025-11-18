import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { z } from "zod";
import { Plus, Smartphone, CreditCard, Banknote, Building2, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ResponsiveChart } from "@/components/ui/responsive-chart";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const paymentSchema = z.object({
  loan_id: z.string().min(1, "Loan is required"),
  amount: z.number().positive("Amount must be positive").max(100000000, "Amount is too large"),
  paid_on: z.string().min(1, "Payment date is required"),
  payment_type: z.enum(["EMI", "PART_PREPAY", "FULL_PREPAY", "LATE_FEE", "OTHER_FEE"]),
  source: z.enum(["UPI_PHONEPE", "UPI_GPAY", "UPI_PAYTM", "NETBANKING", "CARD", "CASH"]),
  notes: z.string().max(500, "Notes must be less than 500 characters"),
});

export default function NewPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [upcomingEMIs, setUpcomingEMIs] = useState<any[]>([]);
  const [overdueEMIs, setOverdueEMIs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState({
    loan_id: "",
    amount: "",
    paid_on: new Date().toISOString().split('T')[0],
    payment_type: "EMI",
    source: "UPI_PHONEPE",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`
          *,
          loans!inner (
            loan_name,
            logo_url,
            user_id,
            lenders (name, logo_url)
          )
        `)
        .order("paid_on", { ascending: false })
        .limit(50);

      // Fetch loans for form
      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name),
          amortization_rows (due_on, scheduled_emi, is_paid)
        `)
        .eq("status", "ACTIVE");

      setPayments(paymentsData || []);
      setLoans(loansData || []);

      // Calculate upcoming and overdue EMIs
      const today = new Date();
      const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcoming: any[] = [];
      const overdue: any[] = [];

      loansData?.forEach((loan: any) => {
        loan.amortization_rows?.forEach((row: any) => {
          if (row.is_paid) return;
          const dueDate = new Date(row.due_on);
          
          if (dueDate < today) {
            overdue.push({
              ...row,
              loan_name: loan.loan_name,
              loan_id: loan.id,
            });
          } else if (dueDate <= next30Days) {
            upcoming.push({
              ...row,
              loan_name: loan.loan_name,
              loan_id: loan.id,
            });
          }
        });
      });

      setUpcomingEMIs(upcoming.sort((a, b) => new Date(a.due_on).getTime() - new Date(b.due_on).getTime()));
      setOverdueEMIs(overdue.sort((a, b) => new Date(a.due_on).getTime() - new Date(b.due_on).getTime()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validationData = {
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
      };

      const result = paymentSchema.safeParse(validationData);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.message).join(", ");
        toast({ 
          variant: "destructive",
          title: "Validation Error", 
          description: errors
        });
        return;
      }

      const { error } = await supabase.from("payments").insert(result.data as any);

      if (error) throw error;

      toast({ title: "Payment recorded successfully" });
      setPaymentForm({
        loan_id: "",
        amount: "",
        paid_on: new Date().toISOString().split('T')[0],
        payment_type: "EMI",
        source: "UPI_PHONEPE",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ 
        title: "Error recording payment", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  // Calculate analytics
  const getTrendData = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(monthDate);
      
      const monthPayments = payments.filter(p => {
        const paidDate = new Date(p.paid_on);
        return isWithinInterval(paidDate, { start: monthDate, end: monthEnd });
      });

      const emiTotal = monthPayments
        .filter(p => p.payment_type === "EMI")
        .reduce((sum, p) => sum + p.amount, 0);
      
      const prepayTotal = monthPayments
        .filter(p => p.payment_type === "PART_PREPAY" || p.payment_type === "FULL_PREPAY")
        .reduce((sum, p) => sum + p.amount, 0);

      months.push({
        month: format(monthDate, "MMM"),
        emi: emiTotal,
        prepayment: prepayTotal,
      });
    }
    return months;
  };

  if (loading) {
    return <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 bg-muted rounded-lg" />
      ))}
    </div>;
  }

  const trendData = getTrendData();
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const emiPaid = payments.filter(p => p.payment_type === "EMI").reduce((sum, p) => sum + p.amount, 0);
  const prepaid = payments.filter(p => p.payment_type === "PART_PREPAY" || p.payment_type === "FULL_PREPAY").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Record and track all your loan payments</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EMI Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(emiPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prepayments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(prepaid)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="record" className="space-y-4">
        <TabsList>
          <TabsTrigger value="record">Record Payment</TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingEMIs.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({overdueEMIs.length})
            {overdueEMIs.length > 0 && <Badge variant="destructive" className="ml-2">{overdueEMIs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record New Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Loan</Label>
                    <Select 
                      value={paymentForm.loan_id} 
                      onValueChange={(val) => setPaymentForm({...paymentForm, loan_id: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.loan_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.paid_on}
                      onChange={(e) => setPaymentForm({...paymentForm, paid_on: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label>Payment Type</Label>
                    <Select 
                      value={paymentForm.payment_type} 
                      onValueChange={(val) => setPaymentForm({...paymentForm, payment_type: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMI">EMI</SelectItem>
                        <SelectItem value="PART_PREPAY">Partial Prepayment</SelectItem>
                        <SelectItem value="FULL_PREPAY">Full Prepayment</SelectItem>
                        <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                        <SelectItem value="OTHER_FEE">Other Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Payment Method</Label>
                    <Select 
                      value={paymentForm.source} 
                      onValueChange={(val) => setPaymentForm({...paymentForm, source: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI_PHONEPE">PhonePe</SelectItem>
                        <SelectItem value="UPI_GPAY">Google Pay</SelectItem>
                        <SelectItem value="UPI_PAYTM">Paytm</SelectItem>
                        <SelectItem value="NETBANKING">Net Banking</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Notes (Optional)</Label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                      placeholder="Add any notes about this payment"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Record Payment
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming EMIs (Next 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEMIs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No upcoming EMIs in the next 30 days</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEMIs.map((emi, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-semibold">{emi.loan_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Due {format(new Date(emi.due_on), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(emi.scheduled_emi)}</p>
                        <Button size="sm" variant="outline" className="mt-2">
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Overdue EMIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueEMIs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No overdue payments. Great job!</p>
              ) : (
                <div className="space-y-3">
                  {overdueEMIs.map((emi, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                      <div>
                        <p className="font-semibold">{emi.loan_name}</p>
                        <p className="text-sm text-destructive">
                          Overdue since {format(new Date(emi.due_on), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(emi.scheduled_emi)}</p>
                        <Button size="sm" variant="destructive" className="mt-2">
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{payment.loans.loan_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.paid_on), "MMM d, yyyy")} • {payment.payment_type}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">{formatINR(payment.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Payment Trends (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveChart
                config={{
                  emi: {
                    label: "EMI",
                    color: "hsl(var(--primary))",
                  },
                  prepayment: {
                    label: "Prepayment",
                    color: "hsl(var(--success))",
                  },
                }}
                height={300}
                minHeight={250}
              >
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => formatINR(value)}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="emi" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="prepayment" stroke="hsl(var(--success))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveChart>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
