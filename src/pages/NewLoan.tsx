import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Upload, FileText, Loader2 } from "lucide-react";
import { calculateReducingEMI, calculateFlatEMI, generateAmortizationSchedule } from "@/lib/emi-calculator";
import { formatINR } from "@/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Lender {
  id: string;
  name: string;
  type: string;
  requires_sanction_letter: boolean;
}

const STEPS = [
  { num: 1, title: "Loan Basics", desc: "Core information" },
  { num: 2, title: "Fees & Rules", desc: "Charges" },
  { num: 3, title: "Documents", desc: "Upload files" },
  { num: 4, title: "Preview", desc: "Review" },
];

export default function NewLoan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    loan_name: "",
    principal_amount: "",
    tenure_months: "",
    interest_rate_apy: "",
    disbursed_on: new Date().toISOString().split("T")[0],
    due_day: "5",
    rate_type: "REDUCING" as const,
    loan_type: "PERSONAL" as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(formData.interest_rate_apy);
      const tenure = parseInt(formData.tenure_months);
      
      const emi = calculateReducingEMI(principal, rate, tenure);

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: user?.id,
          ...formData,
          principal_amount: principal,
          tenure_months: tenure,
          interest_rate_apy: rate,
          emi_amount: emi,
          due_day: parseInt(formData.due_day),
        })
        .select()
        .single();

      if (loanError) throw loanError;

      const schedule = generateAmortizationSchedule(
        principal,
        rate,
        tenure,
        new Date(formData.disbursed_on),
        parseInt(formData.due_day),
        formData.rate_type
      );

      const amortRows = schedule.map((row) => ({
        loan_id: loan.id,
        period_no: row.periodNo,
        period_start: row.periodStart.toISOString().split("T")[0],
        due_on: row.dueOn.toISOString().split("T")[0],
        opening_principal: row.openingPrincipal,
        scheduled_emi: row.scheduledEmi,
        interest_component: row.interestComponent,
        principal_component: row.principalComponent,
        extra_payment: row.extraPayment,
        closing_principal: row.closingPrincipal,
      }));

      const { error: amortError } = await supabase
        .from("amortization_rows")
        .insert(amortRows);

      if (amortError) throw amortError;

      toast({ title: "Loan created successfully!" });
      navigate(`/loans/${loan.id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Loan</h1>
          <p className="text-muted-foreground">Enter your loan details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loan_name">Loan Name *</Label>
              <Input
                id="loan_name"
                required
                value={formData.loan_name}
                onChange={(e) => setFormData({ ...formData, loan_name: e.target.value })}
                placeholder="e.g., HDFC Personal Loan"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="principal_amount">Principal Amount (₹) *</Label>
                <Input
                  id="principal_amount"
                  type="number"
                  required
                  value={formData.principal_amount}
                  onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                  placeholder="100000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenure_months">Tenure (Months) *</Label>
                <Input
                  id="tenure_months"
                  type="number"
                  required
                  value={formData.tenure_months}
                  onChange={(e) => setFormData({ ...formData, tenure_months: e.target.value })}
                  placeholder="24"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interest_rate_apy">Interest Rate (% p.a.) *</Label>
                <Input
                  id="interest_rate_apy"
                  type="number"
                  step="0.01"
                  required
                  value={formData.interest_rate_apy}
                  onChange={(e) => setFormData({ ...formData, interest_rate_apy: e.target.value })}
                  placeholder="14.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_day">EMI Due Day *</Label>
                <Input
                  id="due_day"
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="disbursed_on">Disbursed On *</Label>
                <Input
                  id="disbursed_on"
                  type="date"
                  required
                  value={formData.disbursed_on}
                  onChange={(e) => setFormData({ ...formData, disbursed_on: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loan_type">Loan Type *</Label>
                <Select
                  value={formData.loan_type}
                  onValueChange={(value: any) => setFormData({ ...formData, loan_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                    <SelectItem value="CREDIT_CARD_CONVERSION">Credit Card EMI</SelectItem>
                    <SelectItem value="EDUCATION">Education Loan</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                    <SelectItem value="HOME_TOPUP">Home Loan Top-up</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Loan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
