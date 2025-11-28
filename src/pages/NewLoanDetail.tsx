import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatINR, formatPercent } from "@/lib/currency";
import { ArrowLeft, Calendar, TrendingUp, Building2, CreditCard, Target, Calculator, FileText, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickPaySheet from "@/components/QuickPaySheet";
import AIDebtAdvisor from "@/components/AIDebtAdvisor";

export default function NewLoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amortization, setAmortization] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [showQuickPay, setShowQuickPay] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLoanDetail();

      // Subscribe to real-time changes for this specific loan
      const channel = supabase
        .channel(`loan-detail-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'loans',
            filter: `id=eq.${id}`,
          },
          () => {
            fetchLoanDetail();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'amortization_rows',
            filter: `loan_id=eq.${id}`,
          },
          () => {
            fetchLoanDetail();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const fetchLoanDetail = async () => {
    try {
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          lenders (name, type, contact, logo_url),
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

      const { data: docsData } = await supabase
        .from("documents")
        .select("*")
        .eq("loan_id", id)
        .order("added_on", { ascending: false });

      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("loan_id", id)
        .order("created_at", { ascending: false });

      setLoan(loanData);
      setAmortization(amortData || []);
      setDocuments(docsData || []);
      setGoals(goalsData || []);
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
  const paidRows = amortization.filter((row) => row.is_paid);
  const outstanding = unpaidRows[0]?.closing_principal || 0;
  const totalPaid = paidRows.reduce((sum, row) => sum + row.principal_component, 0);
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
        <Button 
          variant="outline"
          onClick={() => {
            const loanData = encodeURIComponent(JSON.stringify({
              lender_id: loan.lender_id,
              loan_name: loan.loan_name,
              principal_amount: loan.principal_amount,
              tenure_months: loan.tenure_months,
              interest_rate_apy: loan.interest_rate_apy,
              rate_type: loan.rate_type,
              compounding: loan.compounding,
              loan_type: loan.loan_type,
              processing_fee: loan.processing_fee,
              insurance_fee: loan.insurance_fee,
              gst_on_fees: loan.gst_on_fees,
              other_upfront_costs: loan.other_upfront_costs,
              recast_mode: loan.recast_mode,
              auto_debit: loan.auto_debit,
              preferred_method: loan.preferred_method,
            }));
            navigate(`/loans/new?duplicate=${loanData}`);
          }} 
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
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
              Interest Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(loan.interest_rate_apy, 1)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              EMI Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(loan.emi_amount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Principal Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent((totalPaid / loan.principal_amount) * 100, 0)} paid off
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="simulator">Payoff Simulator</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Principal Amount</p>
                <p className="font-semibold">{formatINR(loan.principal_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tenure</p>
                <p className="font-semibold">{loan.tenure_months} months</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disbursed On</p>
                <p className="font-semibold">{new Date(loan.disbursed_on).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rate Type</p>
                <p className="font-semibold">{loan.rate_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing Fee</p>
                <p className="font-semibold">{formatINR(loan.processing_fee || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lender Type</p>
                <p className="font-semibold">{loan.lenders?.type}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Amortization Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {amortization.slice(0, 12).map((row) => (
                  <div key={row.id} className={`flex items-center justify-between p-3 rounded-lg border ${row.is_paid ? 'bg-muted/50' : ''}`}>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Period {row.period_no}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(row.due_on).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatINR(row.scheduled_emi)}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.is_paid ? "Paid" : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
                {amortization.length > 12 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Showing first 12 of {amortization.length} periods
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                AI-Powered Debt Advisor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AIDebtAdvisor loans={[{...loan, outstanding}]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Payoff Goals
                </CardTitle>
                <Button size="sm">Add Goal</Button>
              </div>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No goals set for this loan. Create a goal to track your payoff progress.
                </p>
              ) : (
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div key={goal.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{goal.goal_type.replace(/_/g, ' ')}</p>
                        <Badge>Active</Badge>
                      </div>
                      {goal.target_date && (
                        <p className="text-sm text-muted-foreground">
                          Target: {new Date(goal.target_date).toLocaleDateString()}
                        </p>
                      )}
                      {goal.target_amount && (
                        <p className="text-sm text-muted-foreground">
                          Amount: {formatINR(goal.target_amount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Loan Documents
                </CardTitle>
                <Button size="sm">Upload Document</Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No documents uploaded for this loan yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">{doc.doc_type}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showQuickPay && (
        <QuickPaySheet
          open={showQuickPay}
          onOpenChange={setShowQuickPay}
          loan={loan}
          onPaymentComplete={fetchLoanDetail}
        />
      )}
    </div>
  );
}
