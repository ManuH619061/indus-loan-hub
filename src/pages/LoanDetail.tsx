import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatINR, formatPercent } from "@/lib/currency";
import { ArrowLeft, Calendar, TrendingUp, Building2, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickPaySheet from "@/components/QuickPaySheet";
import PaymentTimeline from "@/components/PaymentTimeline";

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amortization, setAmortization] = useState<any[]>([]);
  const [showQuickPay, setShowQuickPay] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLoanDetail();
    }
  }, [id]);

  const fetchLoanDetail = async () => {
    try {
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name, type, contact),
          penalty_rules (name, late_fee_flat, late_fee_percent, grace_days)
        `)
        .eq("id", id)
        .single();

      if (loanError) throw loanError;

      const { data: amortData, error: amortError } = await supabase
        .from("amortization_rows")
        .select("*")
        .eq("loan_id", id)
        .order("period_no", { ascending: true });

      if (amortError) throw amortError;

      setLoan(loanData);
      setAmortization(amortData || []);
    } catch (error) {
      console.error("Error fetching loan detail:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="h-64 bg-muted rounded" />
    </div>;
  }

  if (!loan) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loan not found</p>
        <Button onClick={() => navigate("/loans")} className="mt-4">
          Back to Loans
        </Button>
      </div>
    );
  }

  const unpaidRows = amortization.filter((row) => !row.is_paid);
  const outstanding = unpaidRows[0]?.closing_principal || 0;
  const logoUrl = loan.logo_url || loan.lenders?.logo_url;
  const initials = loan.loan_name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-12 w-12">
          {logoUrl ? <AvatarImage src={logoUrl} alt={loan.loan_name} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{loan.loan_name}</h1>
          <p className="text-muted-foreground">{loan.lenders?.name}</p>
        </div>
        <Button onClick={() => setShowQuickPay(true)} className="gap-2">
          <CreditCard className="h-4 w-4" />
          Quick Pay
        </Button>
        <Badge className={loan.status === "ACTIVE" ? "bg-success" : "bg-muted"}>
          {loan.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(outstanding)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly EMI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(loan.emi_amount || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interest Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(loan.interest_rate_apy)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tenure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loan.tenure_months} months</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Amortization Schedule</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p className="font-medium">{loan.loan_type.replace(/_/g, " ")}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Rate Type</p>
                  <p className="font-medium">{loan.rate_type}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Disbursed On</p>
                  <p className="font-medium">
                    {new Date(loan.disbursed_on).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Due Day</p>
                  <p className="font-medium">{loan.due_day} of each month</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Processing Fee</p>
                  <p className="font-medium">{formatINR(loan.processing_fee || 0)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Insurance Fee</p>
                  <p className="font-medium">{formatINR(loan.insurance_fee || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lender Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{loan.lenders?.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Type: {loan.lenders?.type}
              </p>
              {loan.lenders?.contact && (
                <p className="text-sm text-muted-foreground">
                  Contact: {loan.lenders.contact}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Amortization Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Period</th>
                      <th className="text-left p-2">Due Date</th>
                      <th className="text-right p-2">Opening</th>
                      <th className="text-right p-2">EMI</th>
                      <th className="text-right p-2">Interest</th>
                      <th className="text-right p-2">Principal</th>
                      <th className="text-right p-2">Closing</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortization.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">{row.period_no}</td>
                        <td className="p-2">
                          {new Date(row.due_on).toLocaleDateString("en-IN")}
                        </td>
                        <td className="p-2 text-right">{formatINR(row.opening_principal)}</td>
                        <td className="p-2 text-right">{formatINR(row.scheduled_emi)}</td>
                        <td className="p-2 text-right">{formatINR(row.interest_component)}</td>
                        <td className="p-2 text-right">{formatINR(row.principal_component)}</td>
                        <td className="p-2 text-right">{formatINR(row.closing_principal)}</td>
                        <td className="p-2 text-center">
                          <Badge variant={row.is_paid ? "default" : "outline"}>
                            {row.is_paid ? "Paid" : "Pending"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentTimeline loanId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QuickPaySheet
        open={showQuickPay}
        onOpenChange={setShowQuickPay}
        loan={loan}
        onPaymentComplete={() => {
          fetchLoanDetail();
        }}
      />
    </div>
  );
}
