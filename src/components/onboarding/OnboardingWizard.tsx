import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet,
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  CreditCard,
  Loader2,
  PartyPopper,
  ChevronRight,
} from "lucide-react";
import { calculateReducingEMI, generateAmortizationSchedule } from "@/lib/emi-calculator";
import { formatINR } from "@/lib/currency";
import { loanAppsLibrary } from "@/lib/loan-apps-library";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "lender", title: "Add Lender", icon: Building2 },
  { id: "loan", title: "Add Loan", icon: Wallet },
  { id: "complete", title: "Complete", icon: PartyPopper },
];

export function OnboardingWizard({ open, onComplete, onSkip }: OnboardingWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdLenderId, setCreatedLenderId] = useState<string | null>(null);
  const [createdLenderName, setCreatedLenderName] = useState<string>("");

  // Lender form
  const [lenderData, setLenderData] = useState({
    name: "",
    type: "BANK" as "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER",
    contact: "",
  });

  // Loan form
  const [loanData, setLoanData] = useState({
    loan_name: "",
    principal_amount: "",
    tenure_months: "",
    interest_rate_apy: "",
    disbursed_on: new Date().toISOString().split("T")[0],
    due_day: "5",
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleCreateLender = async () => {
    if (!user || !lenderData.name.trim()) {
      toast.error("Please enter a lender name");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lenders")
        .insert({
          user_id: user.id,
          name: lenderData.name.trim(),
          type: lenderData.type,
          contact: lenderData.contact?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedLenderId(data.id);
      setCreatedLenderName(data.name);
      setLoanData((prev) => ({ ...prev, loan_name: `${data.name} Loan` }));
      toast.success("Lender created successfully!");
      setCurrentStep(2);
    } catch (error: any) {
      toast.error("Failed to create lender: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFromLibrary = async (appId: string) => {
    if (!user) return;

    const app = loanAppsLibrary.find((a) => a.id === appId);
    if (!app) return;

    setLoading(true);
    try {
      const lenderType =
        app.category === "INSTANT_LOAN" || app.category === "SALARY_ADVANCE"
          ? ("OTHER" as const)
          : app.category === "CREDIT_CARD"
          ? ("CARD" as const)
          : (app.category as "BANK" | "NBFC" | "OTHER");

      const { data, error } = await supabase
        .from("lenders")
        .insert({
          user_id: user.id,
          name: app.name,
          type: lenderType,
          logo_url: app.logo_url,
          website: app.website,
          app_link: app.app_link,
          upi_vpa: app.upi_vpa,
          notes: app.description,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedLenderId(data.id);
      setCreatedLenderName(data.name);
      setLoanData((prev) => ({ ...prev, loan_name: `${data.name} Loan` }));
      toast.success(`${app.name} added as lender!`);
      setCurrentStep(2);
    } catch (error: any) {
      toast.error("Failed to add lender: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoan = async () => {
    if (!user || !createdLenderId) return;

    const principal = parseFloat(loanData.principal_amount);
    const rate = parseFloat(loanData.interest_rate_apy);
    const tenure = parseInt(loanData.tenure_months);

    if (!principal || principal <= 0) {
      toast.error("Please enter a valid principal amount");
      return;
    }
    if (!rate || rate <= 0) {
      toast.error("Please enter a valid interest rate");
      return;
    }
    if (!tenure || tenure <= 0) {
      toast.error("Please enter a valid tenure");
      return;
    }

    setLoading(true);
    try {
      const emi = calculateReducingEMI(principal, rate, tenure);

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: user.id,
          lender_id: createdLenderId,
          loan_name: loanData.loan_name || `${createdLenderName} Loan`,
          loan_type: "PERSONAL",
          principal_amount: principal,
          disbursed_on: loanData.disbursed_on,
          tenure_months: tenure,
          interest_rate_apy: rate,
          rate_type: "REDUCING",
          compounding: "MONTHLY",
          emi_amount: emi,
          billing_day: parseInt(loanData.due_day),
          due_day: parseInt(loanData.due_day),
          status: "ACTIVE",
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Generate amortization schedule
      const schedule = generateAmortizationSchedule(
        principal,
        rate,
        tenure,
        new Date(loanData.disbursed_on),
        parseInt(loanData.due_day),
        "REDUCING"
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

      const { error: amortError } = await supabase.from("amortization_rows").insert(amortRows);

      if (amortError) throw amortError;

      toast.success("Loan created successfully!");
      setCurrentStep(3);
    } catch (error: any) {
      toast.error("Failed to create loan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedEMI = () => {
    const principal = parseFloat(loanData.principal_amount);
    const rate = parseFloat(loanData.interest_rate_apy);
    const tenure = parseInt(loanData.tenure_months);
    if (!principal || !rate || !tenure) return 0;
    return calculateReducingEMI(principal, rate, tenure);
  };

  const popularLenders = loanAppsLibrary.slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" hideCloseButton>
        {/* Progress Bar */}
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 text-xs ${
                  index <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Welcome to Loan Tracker!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Let's get you started by setting up your first lender and loan. This will only take a minute.
                </p>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">What you'll set up:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>Add your first lender (bank, NBFC, or app)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span>Create your first loan with EMI details</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span>Auto-generate your amortization schedule</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onSkip} className="flex-1">
                  Skip for Now
                </Button>
                <Button onClick={() => setCurrentStep(1)} className="flex-1">
                  Let's Start
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Add Lender */}
          {currentStep === 1 && (
            <motion.div
              key="lender"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="text-center space-y-2">
                <Building2 className="h-10 w-10 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Add Your First Lender</h2>
                <p className="text-muted-foreground text-sm">
                  Choose from popular lenders or add a custom one
                </p>
              </div>

              {/* Popular Lenders */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Quick Pick - Popular Lenders</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {popularLenders.map((app) => (
                    <Button
                      key={app.id}
                      variant="outline"
                      className="h-auto py-3 flex-col gap-1 text-xs"
                      onClick={() => handleSelectFromLibrary(app.id)}
                      disabled={loading}
                    >
                      {app.logo_url ? (
                        <img src={app.logo_url} alt={app.name} className="h-6 w-6 rounded" />
                      ) : (
                        <Building2 className="h-6 w-6" />
                      )}
                      <span className="truncate w-full text-center">{app.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or add custom</span>
                </div>
              </div>

              {/* Custom Lender Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="lender-name">Lender Name *</Label>
                    <Input
                      id="lender-name"
                      placeholder="e.g., HDFC Bank"
                      value={lenderData.name}
                      onChange={(e) => setLenderData({ ...lenderData, name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="lender-type">Type</Label>
                    <Select
                      value={lenderData.type}
                      onValueChange={(v) => setLenderData({ ...lenderData, type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK">Bank</SelectItem>
                        <SelectItem value="NBFC">NBFC</SelectItem>
                        <SelectItem value="CARD">Credit Card</SelectItem>
                        <SelectItem value="FRIEND">Friend/Family</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="lender-contact">Contact (optional)</Label>
                  <Input
                    id="lender-contact"
                    placeholder="Phone or email"
                    value={lenderData.contact}
                    onChange={(e) => setLenderData({ ...lenderData, contact: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateLender}
                  disabled={!lenderData.name.trim() || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Add Lender & Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Add Loan */}
          {currentStep === 2 && (
            <motion.div
              key="loan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="text-center space-y-2">
                <Wallet className="h-10 w-10 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Add Your First Loan</h2>
                <p className="text-muted-foreground text-sm">
                  Lender: <Badge variant="secondary">{createdLenderName}</Badge>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="loan-name">Loan Name</Label>
                  <Input
                    id="loan-name"
                    placeholder="e.g., Personal Loan"
                    value={loanData.loan_name}
                    onChange={(e) => setLoanData({ ...loanData, loan_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="principal">Principal Amount (₹) *</Label>
                    <Input
                      id="principal"
                      type="number"
                      placeholder="100000"
                      value={loanData.principal_amount}
                      onChange={(e) => setLoanData({ ...loanData, principal_amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tenure">Tenure (months) *</Label>
                    <Input
                      id="tenure"
                      type="number"
                      placeholder="12"
                      value={loanData.tenure_months}
                      onChange={(e) => setLoanData({ ...loanData, tenure_months: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="interest">Interest Rate (% p.a.) *</Label>
                    <Input
                      id="interest"
                      type="number"
                      step="0.1"
                      placeholder="12"
                      value={loanData.interest_rate_apy}
                      onChange={(e) => setLoanData({ ...loanData, interest_rate_apy: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="due-day">EMI Due Day</Label>
                    <Input
                      id="due-day"
                      type="number"
                      min="1"
                      max="31"
                      value={loanData.due_day}
                      onChange={(e) => setLoanData({ ...loanData, due_day: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="disbursed">Disbursement Date</Label>
                  <Input
                    id="disbursed"
                    type="date"
                    value={loanData.disbursed_on}
                    onChange={(e) => setLoanData({ ...loanData, disbursed_on: e.target.value })}
                  />
                </div>

                {/* EMI Preview */}
                {calculatedEMI() > 0 && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Your Monthly EMI</p>
                      <p className="text-3xl font-bold text-primary">{formatINR(calculatedEMI())}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateLoan}
                  disabled={
                    !loanData.principal_amount ||
                    !loanData.tenure_months ||
                    !loanData.interest_rate_apy ||
                    loading
                  }
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Create Loan
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <PartyPopper className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold">You're All Set!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Congratulations! You've successfully set up your first lender and loan. Your dashboard is now ready.
                </p>
              </div>

              <Card className="bg-emerald-500/10 border-emerald-500/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-emerald-700 dark:text-emerald-400">
                    What's next?
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-600" />
                      <span>View your loan details and EMI schedule</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-600" />
                      <span>Add more loans and lenders anytime</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-600" />
                      <span>Set up bank accounts to track transactions</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-600" />
                      <span>Use AI advisor for personalized financial insights</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Button onClick={onComplete} className="w-full" size="lg">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
