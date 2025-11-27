import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Upload, FileText, Loader2, Plus } from "lucide-react";
import { calculateReducingEMI, calculateFlatEMI, generateAmortizationSchedule } from "@/lib/emi-calculator";
import { formatINR, formatPercent } from "@/lib/currency";
import { loanAppsLibrary } from "@/lib/loan-apps-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SmartLenderSelector from "@/components/SmartLenderSelector";

interface Lender {
  id: string;
  name: string;
  type: string;
  requires_sanction_letter: boolean;
}

const STEPS = [
  { num: 1, title: "Loan Basics", desc: "Core information" },
  { num: 2, title: "Fees & Rules", desc: "Charges & settings" },
  { num: 3, title: "Documents", desc: "Upload files" },
  { num: 4, title: "Preview", desc: "Review & confirm" },
];

export default function NewLoan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [newLenderOpen, setNewLenderOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  
  // Real-time validation state
  const [fieldValidation, setFieldValidation] = useState({
    lender_id: false,
    loan_name: false,
    principal_amount: false,
    tenure_months: false,
    interest_rate_apy: false,
    disbursed_on: false,
    billing_day: false,
    due_day: false,
  });
  
  const [formData, setFormData] = useState({
    lender_id: "",
    loan_name: "",
    loan_type: "PERSONAL" as const,
    principal_amount: "",
    disbursed_on: new Date().toISOString().split("T")[0],
    tenure_months: "",
    interest_rate_apy: "",
    rate_type: "REDUCING" as const,
    compounding: "MONTHLY" as const,
    billing_day: "5",
    due_day: "5",
    processing_fee: "0",
    insurance_fee: "0",
    gst_on_fees: "0",
    other_upfront_costs: "0",
    auto_debit: false,
    recast_mode: "REDUCE_TENURE" as const,
    preferred_method: "",
    remarks: "",
  });

  const [newLenderData, setNewLenderData] = useState({
    name: "",
    type: "BANK" as const,
    requires_sanction_letter: true,
  });

  // Validation functions
  const validateField = (field: string, value: any) => {
    switch (field) {
      case 'lender_id':
        return !!value;
      case 'loan_name':
        return !!value?.trim();
      case 'principal_amount':
        return value && parseFloat(value) > 0;
      case 'tenure_months':
        return value && parseInt(value) > 0;
      case 'interest_rate_apy':
        return value && parseFloat(value) > 0;
      case 'disbursed_on':
        return !!value;
      case 'billing_day':
        const billingDay = parseInt(value);
        return billingDay >= 1 && billingDay <= 31;
      case 'due_day':
        const dueDay = parseInt(value);
        return dueDay >= 1 && dueDay <= 31;
      default:
        return false;
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update validation status
    if (field in fieldValidation) {
      setFieldValidation(prev => ({
        ...prev,
        [field]: validateField(field, value)
      }));
    }
  };

  useEffect(() => {
    fetchLenders();
    
    // Check for pre-selected lender from URL
    const params = new URLSearchParams(window.location.search);
    const lenderId = params.get("lender");
    if (lenderId) {
      setFormData((prev) => ({ ...prev, lender_id: lenderId }));
    }

    // Pre-fill form if duplicating a loan
    const duplicateParam = searchParams.get('duplicate');
    if (duplicateParam) {
      try {
        const loanData = JSON.parse(decodeURIComponent(duplicateParam));
        setFormData(prev => ({
          ...prev,
          lender_id: loanData.lender_id || "",
          loan_name: `${loanData.loan_name || ""} (Copy)`,
          principal_amount: loanData.principal_amount || "",
          tenure_months: loanData.tenure_months || "",
          interest_rate_apy: loanData.interest_rate_apy || "",
          rate_type: loanData.rate_type || "REDUCING",
          compounding: loanData.compounding || "MONTHLY",
          loan_type: loanData.loan_type || "PERSONAL",
          processing_fee: loanData.processing_fee || "0",
          insurance_fee: loanData.insurance_fee || "0",
          gst_on_fees: loanData.gst_on_fees || "0",
          other_upfront_costs: loanData.other_upfront_costs || "0",
          recast_mode: loanData.recast_mode || "REDUCE_TENURE",
          auto_debit: loanData.auto_debit || false,
          preferred_method: loanData.preferred_method || "",
        }));
        toast({ 
          title: "Loan duplicated", 
          description: "Review and update the details before saving" 
        });
      } catch (error) {
        console.error("Error parsing duplicate loan data:", error);
      }
    }
  }, [user, searchParams]);

  const fetchLenders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lenders")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if (data) setLenders(data);
  };

  const handleLenderChange = async (value: string) => {
    if (value === "__add_custom__") {
      setNewLenderOpen(true);
      return;
    }

    // Check if it's from library
    if (value.startsWith("library:")) {
      const appId = value.replace("library:", "");
      const app = loanAppsLibrary.find((a) => a.id === appId);
      
      if (app && user) {
        // Check if lender already exists
        const { data: existingLender } = await supabase
          .from("lenders")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", app.name)
          .maybeSingle();

        if (existingLender) {
          updateFormData('lender_id', existingLender.id);
        } else {
          // Create new lender from library
          const lenderType = 
            app.category === "INSTANT_LOAN" ? "OTHER" as const :
            app.category === "SALARY_ADVANCE" ? "OTHER" as const :
            app.category === "CREDIT_CARD" ? "CARD" as const :
            app.category as "BANK" | "NBFC" | "OTHER";

          const { data: newLender } = await supabase
            .from("lenders")
            .insert([{
              user_id: user.id,
              name: app.name,
              type: lenderType,
              logo_url: app.logo_url,
              website: app.website,
              app_link: app.app_link,
              upi_vpa: app.upi_vpa,
              notes: app.description,
            }] as any)
            .select()
            .single();

          if (newLender) {
            setLenders([...lenders, newLender]);
            updateFormData('lender_id', newLender.id);
            toast({ title: "Lender added from library!" });
          }
        }
      }
    } else {
      updateFormData('lender_id', value);
    }
  };

  const handleAddLender = async () => {
    if (!user || !newLenderData.name) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lenders")
        .insert({ ...newLenderData, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      
      setLenders([...lenders, data]);
      setFormData({ ...formData, lender_id: data.id });
      setNewLenderOpen(false);
      setNewLenderData({ name: "", type: "BANK", requires_sanction_letter: true });
      toast({ title: "Lender added successfully!" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.lender_id) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please select a lender" });
          return false;
        }
        if (!formData.loan_name?.trim()) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please enter a loan name" });
          return false;
        }
        if (!formData.principal_amount || parseFloat(formData.principal_amount) <= 0) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please enter a valid principal amount" });
          return false;
        }
        if (!formData.tenure_months || parseInt(formData.tenure_months) <= 0) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please enter a valid tenure" });
          return false;
        }
        if (!formData.interest_rate_apy || parseFloat(formData.interest_rate_apy) <= 0) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please enter a valid interest rate" });
          return false;
        }
        if (!formData.disbursed_on) {
          toast({ variant: "destructive", title: "Validation Error", description: "Please select a disbursement date" });
          return false;
        }
        return true;
      case 2:
        return true;
      case 3:
        const selectedLender = lenders.find(l => l.id === formData.lender_id);
        if (selectedLender?.requires_sanction_letter && !documentFile) {
          toast({ variant: "destructive", title: "Sanction letter is required for this lender" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(4, prev + 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const calculateEMI = () => {
    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate_apy);
    const tenure = parseInt(formData.tenure_months);
    
    if (!principal || !rate || !tenure) return 0;
    
    return formData.rate_type === "REDUCING"
      ? calculateReducingEMI(principal, rate, tenure)
      : calculateFlatEMI(principal, rate, tenure);
  };

  const getPreviewSchedule = () => {
    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate_apy);
    const tenure = parseInt(formData.tenure_months);
    
    if (!principal || !rate || !tenure) return [];
    
    const schedule = generateAmortizationSchedule(
      principal,
      rate,
      tenure,
      new Date(formData.disbursed_on),
      parseInt(formData.due_day),
      formData.rate_type
    );
    
    return schedule.slice(0, 12);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ 
        variant: "destructive", 
        title: "Authentication required", 
        description: "Please log in to create a loan" 
      });
      return;
    }
    
    setLoading(true);

    try {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(formData.interest_rate_apy);
      const tenure = parseInt(formData.tenure_months);
      
      if (!principal || !rate || !tenure) {
        throw new Error("Please fill in all required fields");
      }
      
      const emi = calculateEMI();

      console.log("Creating loan with data:", {
        user_id: user.id,
        lender_id: formData.lender_id,
        loan_name: formData.loan_name,
      });

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: user.id,
          lender_id: formData.lender_id,
          loan_name: formData.loan_name,
          loan_type: formData.loan_type,
          principal_amount: principal,
          disbursed_on: formData.disbursed_on,
          tenure_months: tenure,
          interest_rate_apy: rate,
          rate_type: formData.rate_type,
          compounding: formData.compounding,
          emi_amount: emi,
          billing_day: parseInt(formData.billing_day),
          due_day: parseInt(formData.due_day),
          processing_fee: parseFloat(formData.processing_fee),
          insurance_fee: parseFloat(formData.insurance_fee),
          gst_on_fees: parseFloat(formData.gst_on_fees),
          other_upfront_costs: parseFloat(formData.other_upfront_costs),
          auto_debit: formData.auto_debit,
          recast_mode: formData.recast_mode,
          preferred_method: formData.preferred_method || null,
          remarks: formData.remarks || null,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (loanError) {
        console.error("Loan creation error:", loanError);
        throw loanError;
      }

      console.log("Loan created successfully:", loan);

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

      if (documentFile) {
        const filePath = `${user.id}/${loan.id}/${Date.now()}_${documentFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("loan-documents")
          .upload(filePath, documentFile);

        if (uploadError) throw uploadError;

        await supabase.from("documents").insert({
          loan_id: loan.id,
          doc_type: "SANCTION_LETTER",
          label: "Sanction Letter",
          file_url: filePath,
          file_name: documentFile.name,
          file_size: documentFile.size,
          added_on: new Date().toISOString(),
        });
      }

      toast({ 
        title: "Loan created successfully!",
        description: "Your loan has been saved to the database"
      });
      
      // Navigate to dashboard to see the new loan
      setTimeout(() => {
        navigate(`/dashboard`);
      }, 800);
    } catch (error: any) {
      console.error("Error creating loan:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedLender = lenders.find(l => l.id === formData.lender_id);
  const previewEMI = calculateEMI();
  const previewSchedule = getPreviewSchedule();

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Loan</h1>
          <p className="text-muted-foreground">Create a new loan with complete details</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  currentStep >= step.num
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-muted-foreground/30"
                }`}
              >
                {currentStep > step.num ? <Check className="h-5 w-5" /> : step.num}
              </div>
              <div className="text-center mt-2">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 ${
                  currentStep > step.num ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lender *</Label>
                <div className="relative">
                  <SmartLenderSelector
                    value={formData.lender_id}
                    onChange={handleLenderChange}
                    onAddCustom={() => setNewLenderOpen(true)}
                  />
                  {fieldValidation.lender_id && (
                    <Check className="absolute right-10 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500 pointer-events-none z-10" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Loan Name *</Label>
                <div className="relative">
                  <Input
                    value={formData.loan_name}
                    onChange={(e) => updateFormData('loan_name', e.target.value)}
                    placeholder="e.g., Personal Loan - Home Renovation"
                    className={fieldValidation.loan_name ? "pr-10" : ""}
                  />
                  {fieldValidation.loan_name && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Loan Type *</Label>
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
                    <SelectItem value="CONSUMER_DURABLE">Consumer Durable</SelectItem>
                    <SelectItem value="EDUCATION">Education Loan</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle Loan</SelectItem>
                    <SelectItem value="HOME_TOPUP">Home Top-up</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount (₹) *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.principal_amount}
                      onChange={(e) => updateFormData('principal_amount', e.target.value)}
                      placeholder="100000"
                      className={fieldValidation.principal_amount ? "pr-10" : ""}
                    />
                    {fieldValidation.principal_amount && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Disbursed On *</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={formData.disbursed_on}
                      onChange={(e) => updateFormData('disbursed_on', e.target.value)}
                      className={fieldValidation.disbursed_on ? "pr-10" : ""}
                    />
                    {fieldValidation.disbursed_on && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tenure (Months) *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.tenure_months}
                      onChange={(e) => updateFormData('tenure_months', e.target.value)}
                      placeholder="12"
                      className={fieldValidation.tenure_months ? "pr-10" : ""}
                    />
                    {fieldValidation.tenure_months && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (% p.a.) *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.interest_rate_apy}
                      onChange={(e) => updateFormData('interest_rate_apy', e.target.value)}
                      placeholder="12.50"
                      className={fieldValidation.interest_rate_apy ? "pr-10" : ""}
                    />
                    {fieldValidation.interest_rate_apy && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate Type *</Label>
                  <Select
                    value={formData.rate_type}
                    onValueChange={(value: any) => setFormData({ ...formData, rate_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REDUCING">Reducing Balance</SelectItem>
                      <SelectItem value="FLAT">Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compounding *</Label>
                  <Select
                    value={formData.compounding}
                    onValueChange={(value: any) => setFormData({ ...formData, compounding: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Day *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.billing_day}
                      onChange={(e) => updateFormData('billing_day', e.target.value)}
                      className={fieldValidation.billing_day ? "pr-10" : ""}
                    />
                    {fieldValidation.billing_day && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Day *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.due_day}
                      onChange={(e) => updateFormData('due_day', e.target.value)}
                      className={fieldValidation.due_day ? "pr-10" : ""}
                    />
                    {fieldValidation.due_day && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Processing Fee (₹)</Label>
                  <Input
                    type="number"
                    value={formData.processing_fee}
                    onChange={(e) => setFormData({ ...formData, processing_fee: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Insurance Fee (₹)</Label>
                  <Input
                    type="number"
                    value={formData.insurance_fee}
                    onChange={(e) => setFormData({ ...formData, insurance_fee: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GST on Fees (₹)</Label>
                  <Input
                    type="number"
                    value={formData.gst_on_fees}
                    onChange={(e) => setFormData({ ...formData, gst_on_fees: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Other Upfront Costs (₹)</Label>
                  <Input
                    type="number"
                    value={formData.other_upfront_costs}
                    onChange={(e) => setFormData({ ...formData, other_upfront_costs: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recast Mode (for prepayments)</Label>
                <Select
                  value={formData.recast_mode}
                  onValueChange={(value: any) => setFormData({ ...formData, recast_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REDUCE_TENURE">Reduce Tenure</SelectItem>
                    <SelectItem value="REDUCE_EMI">Reduce EMI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preferred Payment Method</Label>
                <Input
                  value={formData.preferred_method}
                  onChange={(e) => setFormData({ ...formData, preferred_method: e.target.value })}
                  placeholder="e.g., UPI, Net Banking, Auto-debit"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.auto_debit}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_debit: checked })}
                />
                <Label>Auto-debit Enabled</Label>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any additional notes about this loan"
                  rows={3}
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              {selectedLender?.requires_sanction_letter && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    ⚠️ Sanction letter is mandatory for {selectedLender.name}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Sanction Letter {selectedLender?.requires_sanction_letter && "*"}
                </Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {documentFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{documentFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(documentFile.size / 1024).toFixed(2)} KB
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocumentFile(null)}
                          className="mt-2"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload sanction letter (PDF, JPG, PNG)
                      </p>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setDocumentFile(file);
                        }}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Loan Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lender:</span>
                      <span className="font-medium">{selectedLender?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loan Name:</span>
                      <span className="font-medium">{formData.loan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Principal:</span>
                      <span className="font-medium">{formatINR(parseFloat(formData.principal_amount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tenure:</span>
                      <span className="font-medium">{formData.tenure_months} months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest Rate:</span>
                      <span className="font-medium">{formatPercent(parseFloat(formData.interest_rate_apy))}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">EMI Calculation</h3>
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Monthly EMI</p>
                    <p className="text-3xl font-bold">{formatINR(previewEMI)}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Fees:</span>
                      <span className="font-medium">
                        {formatINR(
                          parseFloat(formData.processing_fee) +
                          parseFloat(formData.insurance_fee) +
                          parseFloat(formData.gst_on_fees) +
                          parseFloat(formData.other_upfront_costs)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rate Type:</span>
                      <Badge variant="outline">{formData.rate_type}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Amortization Schedule (First 12 Months)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Month</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">EMI</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewSchedule.map((row) => (
                        <TableRow key={row.periodNo}>
                          <TableCell className="font-medium">{row.periodNo}</TableCell>
                          <TableCell>{row.dueOn.toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{formatINR(row.scheduledEmi)}</TableCell>
                          <TableCell className="text-right">{formatINR(row.interestComponent)}</TableCell>
                          <TableCell className="text-right">{formatINR(row.principalComponent)}</TableCell>
                          <TableCell className="text-right">{formatINR(row.closingPrincipal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parseInt(formData.tenure_months) > 12 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing first 12 months of {formData.tenure_months} months total
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1 || loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < 4 ? (
          <Button onClick={nextStep}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Loan
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
