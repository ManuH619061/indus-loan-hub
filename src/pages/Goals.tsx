import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Target, TrendingDown, Calendar, DollarSign, Lightbulb, Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/currency";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import AIDebtAdvisor from "@/components/AIDebtAdvisor";

interface Goal {
  id: string;
  loan_id: string | null;
  goal_type: string;
  target_date: string | null;
  target_amount: number | null;
  monthly_extra_payment: number;
  notes: string | null;
  loans?: any;
}

interface Loan {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  emi_amount: number;
  outstanding: number;
  rate_type: string;
}

export default function Goals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    loan_id: "",
    goal_type: "PAYOFF_BY_DATE",
    target_date: "",
    target_amount: "",
    monthly_extra_payment: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile for monthly income
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user?.id)
        .single();

      if (!profileError && profileData) {
        setMonthlyIncome(profileData.monthly_income || undefined);
      }

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from("goals")
        .select("*, loans(loan_name, principal_amount, interest_rate_apy, emi_amount)")
        .order("created_at", { ascending: false });

      if (goalsError) throw goalsError;

      // Fetch loans with amortization data
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select(`
          id,
          loan_name,
          principal_amount,
          interest_rate_apy,
          tenure_months,
          emi_amount,
          rate_type,
          amortization_rows(closing_principal, is_paid)
        `)
        .eq("status", "ACTIVE");

      if (loansError) throw loansError;

      // Calculate outstanding for each loan
      const loansWithOutstanding = loansData?.map((loan: any) => {
        const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
        const outstanding = unpaidRows[0]?.closing_principal || 0;
        return { ...loan, outstanding };
      }) || [];

      setGoals(goalsData || []);
      setLoans(loansWithOutstanding);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase.from("goals").insert({
        user_id: user?.id,
        loan_id: formData.loan_id || null,
        goal_type: formData.goal_type,
        target_date: formData.target_date || null,
        target_amount: formData.target_amount ? parseFloat(formData.target_amount) : null,
        monthly_extra_payment: formData.monthly_extra_payment ? parseFloat(formData.monthly_extra_payment) : 0,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({ title: "Goal created successfully" });
      setDialogOpen(false);
      setFormData({
        loan_id: "",
        goal_type: "PAYOFF_BY_DATE",
        target_date: "",
        target_amount: "",
        monthly_extra_payment: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error creating goal", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
      toast({ title: "Goal deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error deleting goal", description: error.message, variant: "destructive" });
    }
  };

  const calculateGoalProgress = (goal: Goal) => {
    if (!goal.loan_id) {
      // All loans goal
      const totalOutstanding = loans.reduce((sum, loan) => sum + loan.outstanding, 0);
      const totalOriginal = loans.reduce((sum, loan) => sum + loan.principal_amount, 0);
      const paid = totalOriginal - totalOutstanding;
      return {
        current: totalOutstanding,
        target: goal.target_amount || totalOriginal,
        progress: (paid / totalOriginal) * 100,
        paid,
      };
    } else {
      // Single loan goal
      const loan = loans.find(l => l.id === goal.loan_id);
      if (!loan) return { current: 0, target: 0, progress: 0, paid: 0 };
      const paid = loan.principal_amount - loan.outstanding;
      return {
        current: loan.outstanding,
        target: goal.target_amount || loan.principal_amount,
        progress: (paid / loan.principal_amount) * 100,
        paid,
      };
    }
  };

  const generatePrepaymentSuggestions = () => {
    // Sort loans by interest rate (highest first) for optimal prepayment
    const sortedLoans = [...loans]
      .sort((a, b) => b.interest_rate_apy - a.interest_rate_apy)
      .filter(loan => loan.outstanding > 0);

    return sortedLoans.map((loan, index) => {
      const monthlyInterest = (loan.outstanding * loan.interest_rate_apy) / 12 / 100;
      const payoffMonths = loan.outstanding / (loan.emi_amount || 1);
      const totalInterest = (loan.emi_amount || 0) * payoffMonths - loan.outstanding;

      // Calculate savings with extra payment
      const extraPayment = 5000; // Example extra payment
      const newMonthlyPayment = (loan.emi_amount || 0) + extraPayment;
      const newPayoffMonths = Math.ceil(loan.outstanding / newMonthlyPayment);
      const savedMonths = payoffMonths - newPayoffMonths;
      const interestSavings = monthlyInterest * savedMonths;

      return {
        loan,
        priority: index + 1,
        monthlyInterest,
        payoffMonths: Math.ceil(payoffMonths),
        totalInterest,
        recommendation: index === 0 ? "Highest Priority" : index === 1 ? "Medium Priority" : "Lower Priority",
        potentialSavings: interestSavings,
        extraPaymentSuggestion: extraPayment,
      };
    });
  };

  const suggestions = generatePrepaymentSuggestions();

  // Generate projection chart data
  const generateProjectionData = () => {
    const months = 12;
    const data = [];
    let currentTotal = loans.reduce((sum, loan) => sum + loan.outstanding, 0);
    const monthlyPayment = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
    const avgInterestRate = loans.length > 0 
      ? loans.reduce((sum, loan) => sum + loan.interest_rate_apy, 0) / loans.length 
      : 0;

    for (let i = 0; i <= months; i++) {
      if (i > 0) {
        const interest = (currentTotal * avgInterestRate) / 12 / 100;
        const principal = monthlyPayment - interest;
        currentTotal = Math.max(0, currentTotal - principal);
      }
      
      data.push({
        month: format(new Date(new Date().setMonth(new Date().getMonth() + i)), "MMM yy"),
        outstanding: Math.round(currentTotal),
      });
    }

    return data;
  };

  const projectionData = generateProjectionData();

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="h-64 bg-muted rounded" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debt Payoff Goals</h1>
          <p className="text-muted-foreground">Track your debt reduction targets and optimize prepayments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Debt Payoff Goal</DialogTitle>
              <DialogDescription>Set a target for debt reduction</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="loan_id">Loan (Optional - leave empty for all loans)</Label>
                <Select value={formData.loan_id} onValueChange={(value) => setFormData({ ...formData, loan_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Loans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Loans</SelectItem>
                    {loans.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id}>
                        {loan.loan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="goal_type">Goal Type</Label>
                <Select value={formData.goal_type} onValueChange={(value) => setFormData({ ...formData, goal_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYOFF_BY_DATE">Pay Off By Date</SelectItem>
                    <SelectItem value="REDUCE_BY_AMOUNT">Reduce By Amount</SelectItem>
                    <SelectItem value="SAVE_INTEREST">Save Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.goal_type === "PAYOFF_BY_DATE" && (
                <div>
                  <Label htmlFor="target_date">Target Date</Label>
                  <Input
                    id="target_date"
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    required
                  />
                </div>
              )}

              {formData.goal_type === "REDUCE_BY_AMOUNT" && (
                <div>
                  <Label htmlFor="target_amount">Target Amount</Label>
                  <Input
                    id="target_amount"
                    type="number"
                    placeholder="50000"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="monthly_extra_payment">Monthly Extra Payment</Label>
                <Input
                  id="monthly_extra_payment"
                  type="number"
                  placeholder="5000"
                  value={formData.monthly_extra_payment}
                  onChange={(e) => setFormData({ ...formData, monthly_extra_payment: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this goal..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">Create Goal</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Active Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{goals.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatINR(loans.reduce((sum, loan) => sum + loan.outstanding, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Avg Interest Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loans.length > 0 
                ? (loans.reduce((sum, loan) => sum + loan.interest_rate_apy, 0) / loans.length).toFixed(2)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Debt Advisor */}
      <AIDebtAdvisor loans={loans} monthlyIncome={monthlyIncome} goals={goals} />

      {/* Debt Projection Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Debt Reduction Projection</CardTitle>
          <CardDescription>Projected outstanding balance over the next 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              outstanding: {
                label: "Outstanding",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="outstanding" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Prepayment Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Optimal Prepayment Strategy
          </CardTitle>
          <CardDescription>Prioritized recommendations to minimize interest costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active loans to optimize</p>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.loan.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={suggestion.priority === 1 ? "default" : "secondary"}>
                        Priority #{suggestion.priority}
                      </Badge>
                      <h3 className="font-semibold">{suggestion.loan.loan_name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Interest Rate: {suggestion.loan.interest_rate_apy}% APY
                    </p>
                  </div>
                  <Badge className={
                    suggestion.priority === 1 
                      ? "bg-red-500/10 text-red-600 border-red-500/20" 
                      : suggestion.priority === 2 
                      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                      : "bg-green-500/10 text-green-600 border-green-500/20"
                  }>
                    {suggestion.recommendation}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current Outstanding</p>
                    <p className="font-semibold">{formatINR(suggestion.loan.outstanding)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Interest</p>
                    <p className="font-semibold">{formatINR(suggestion.monthlyInterest)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payoff Time</p>
                    <p className="font-semibold">{suggestion.payoffMonths} months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Interest</p>
                    <p className="font-semibold">{formatINR(suggestion.totalInterest)}</p>
                  </div>
                </div>

                <div className="bg-primary/5 rounded p-3 border border-primary/20">
                  <p className="text-sm font-medium text-primary mb-1">💡 Suggestion</p>
                  <p className="text-sm">
                    Pay an extra {formatINR(suggestion.extraPaymentSuggestion)}/month to save approximately{" "}
                    <span className="font-semibold text-green-600">
                      {formatINR(suggestion.potentialSavings)}
                    </span>{" "}
                    in interest
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Goals List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Goals</h2>
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No goals yet. Create your first debt payoff goal!</p>
              <Button onClick={() => setDialogOpen(true)}>Create Goal</Button>
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress = calculateGoalProgress(goal);
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {goal.goal_type === "PAYOFF_BY_DATE" && <Calendar className="h-5 w-5" />}
                        {goal.goal_type === "REDUCE_BY_AMOUNT" && <TrendingDown className="h-5 w-5" />}
                        {goal.goal_type === "SAVE_INTEREST" && <DollarSign className="h-5 w-5" />}
                        {goal.loans?.loan_name || "All Loans"}
                      </CardTitle>
                      <CardDescription>
                        {goal.goal_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                        {goal.target_date && ` by ${format(new Date(goal.target_date), "MMM dd, yyyy")}`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(goal.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{Math.round(progress.progress)}%</span>
                    </div>
                    <Progress value={progress.progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Paid</p>
                      <p className="font-semibold">{formatINR(progress.paid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current</p>
                      <p className="font-semibold">{formatINR(progress.current)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-semibold">{formatINR(progress.target)}</p>
                    </div>
                  </div>

                  {goal.monthly_extra_payment > 0 && (
                    <div className="bg-muted rounded p-3">
                      <p className="text-sm text-muted-foreground">Monthly Extra Payment</p>
                      <p className="font-semibold">{formatINR(goal.monthly_extra_payment)}</p>
                    </div>
                  )}

                  {goal.notes && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Notes:</p>
                      <p>{goal.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
