import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Target, Plus, Calendar, TrendingUp, Sparkles, AlertTriangle, Pause, CreditCard, Flag } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInMonths } from "date-fns";
import FadeInStagger from "@/components/FadeInStagger";

interface Goal {
  id: string;
  goal_type: string;
  target_amount: number;
  target_date: string;
  monthly_extra_payment: number;
  notes?: string;
  loan_id?: string;
  created_at: string;
}

interface DebtFreeGoal {
  debtFreeDate: Date | null;
  totalDebt: number;
  monthlyEmi: number;
}

export default function SavingsGoals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [debtFreeGoal, setDebtFreeGoal] = useState<DebtFreeGoal | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: "savings",
    targetAmount: "",
    targetDate: "",
    monthlyAmount: "",
    notes: "",
    priority: "medium",
  });

  useEffect(() => {
    if (user) {
      fetchGoals();
      fetchDebtFreeGoal();
      fetchMonthlyIncome();
    }
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch goals");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtFreeGoal = async () => {
    if (!user) return;
    try {
      const { data: loans } = await supabase
        .from('loans')
        .select('*, amortization_rows(*)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (loans && loans.length > 0) {
        const totalDebt = loans.reduce((sum, loan) => {
          const lastRow = loan.amortization_rows
            ?.filter((r: any) => !r.is_paid)
            .sort((a: any, b: any) => new Date(b.due_on).getTime() - new Date(a.due_on).getTime())[0];
          return sum + (lastRow?.opening_principal || 0);
        }, 0);

        const monthlyEmi = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
        
        // Find the last EMI date
        let lastEmiDate: Date | null = null;
        loans.forEach(loan => {
          loan.amortization_rows?.forEach((row: any) => {
            const dueDate = new Date(row.due_on);
            if (!lastEmiDate || dueDate > lastEmiDate) {
              lastEmiDate = dueDate;
            }
          });
        });

        setDebtFreeGoal({ debtFreeDate: lastEmiDate, totalDebt, monthlyEmi });
      }
    } catch (error) {
      console.error('Error fetching debt-free goal:', error);
    }
  };

  const fetchMonthlyIncome = async () => {
    if (!user) return;
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const { data: budget } = await supabase
        .from('monthly_budgets')
        .select('salary, side_income, other_income')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .maybeSingle();

      if (budget) {
        setMonthlyIncome((budget.salary || 0) + (budget.side_income || 0) + (budget.other_income || 0));
      }
    } catch (error) {
      console.error('Error fetching income:', error);
    }
  };

  const handleAddGoal = async () => {
    if (!user || !newGoal.targetAmount || !newGoal.targetDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        goal_type: newGoal.type,
        target_amount: parseFloat(newGoal.targetAmount),
        target_date: newGoal.targetDate,
        monthly_extra_payment: parseFloat(newGoal.monthlyAmount) || 0,
        notes: newGoal.notes ? `${newGoal.priority}|${newGoal.notes}` : newGoal.priority,
      });

      if (error) throw error;

      toast.success("Goal added successfully");
      setOpenAddDialog(false);
      setNewGoal({
        type: "savings",
        targetAmount: "",
        targetDate: "",
        monthlyAmount: "",
        notes: "",
        priority: "medium",
      });
      fetchGoals();
    } catch (error: any) {
      toast.error("Failed to add goal");
    }
  };

  const calculateProgress = (goal: Goal) => {
    const monthsSinceCreation = Math.max(
      1,
      Math.floor((Date.now() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    const currentSavings = goal.monthly_extra_payment * monthsSinceCreation;
    const progress = (currentSavings / goal.target_amount) * 100;
    return Math.min(100, progress);
  };

  const calculateMonthsRemaining = (goal: Goal) => {
    return differenceInMonths(new Date(goal.target_date), new Date());
  };

  const getRequiredMonthly = (goal: Goal) => {
    const monthsRemaining = calculateMonthsRemaining(goal);
    if (monthsRemaining <= 0) return 0;
    
    const monthsSinceCreation = Math.max(
      1,
      Math.floor((Date.now() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    const currentSavings = goal.monthly_extra_payment * monthsSinceCreation;
    const remaining = goal.target_amount - currentSavings;
    
    return remaining / monthsRemaining;
  };

  const getPriority = (goal: Goal) => {
    const notes = goal.notes || '';
    if (notes.startsWith('high')) return 'high';
    if (notes.startsWith('low')) return 'low';
    return 'medium';
  };

  const getIncomePercent = (monthlyContribution: number) => {
    if (monthlyIncome === 0) return 0;
    return (monthlyContribution / monthlyIncome) * 100;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Goals
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track savings goals and debt-free targets
          </p>
        </div>
        <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Savings Goal</DialogTitle>
              <DialogDescription>Set a new financial goal to track your progress</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Amount</Label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Contribution</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={newGoal.monthlyAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, monthlyAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newGoal.priority} onValueChange={(v) => setNewGoal({ ...newGoal, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="e.g., Emergency fund, New car, Vacation..."
                  value={newGoal.notes}
                  onChange={(e) => setNewGoal({ ...newGoal, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddGoal}>Add Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Debt-Free Goal (Auto-generated) */}
      {debtFreeGoal && debtFreeGoal.totalDebt > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 via-transparent to-transparent dark:from-blue-950/20 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Debt-Free Goal
              </CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Auto-tracked</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Debt</p>
                <p className="text-lg font-bold text-red-600">{formatINR(debtFreeGoal.totalDebt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly EMI</p>
                <p className="text-lg font-bold">{formatINR(debtFreeGoal.monthlyEmi)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Debt-Free By</p>
                <p className="text-lg font-bold text-green-600">
                  {debtFreeGoal.debtFreeDate ? format(debtFreeGoal.debtFreeDate, 'MMM yyyy') : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Use the simulation tool in Overview to see how prepayments can accelerate your debt-free date.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Goals */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No savings goals yet</p>
            <p className="text-sm text-muted-foreground mb-4">Start by adding your first financial goal</p>
            <Button onClick={() => setOpenAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const progress = calculateProgress(goal);
            const monthsRemaining = calculateMonthsRemaining(goal);
            const requiredMonthly = getRequiredMonthly(goal);
            const isOnTrack = goal.monthly_extra_payment >= requiredMonthly;
            const priority = getPriority(goal);
            const incomePercent = getIncomePercent(goal.monthly_extra_payment);

            return (
              <Card key={goal.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">
                        {goal.notes?.split('|')[1] || goal.goal_type === "savings" ? "Savings Goal" : "Goal"}
                      </CardTitle>
                      <Badge 
                        variant="outline" 
                        className={
                          priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                          priority === 'low' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        <Flag className="h-3 w-3 mr-1" />
                        {priority}
                      </Badge>
                    </div>
                    <Badge variant={isOnTrack ? "default" : "destructive"}>
                      {isOnTrack ? "On Track" : "Behind"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-base font-bold">{formatINR(goal.target_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly</p>
                      <p className="text-base font-bold">{formatINR(goal.monthly_extra_payment)}</p>
                      <p className="text-xs text-muted-foreground">{incomePercent.toFixed(1)}% of income</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Required</p>
                      <p className={`text-base font-bold ${!isOnTrack ? 'text-destructive' : ''}`}>
                        {formatINR(requiredMonthly)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Months Left</p>
                      <p className="text-base font-bold flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {Math.max(0, monthsRemaining)}
                      </p>
                    </div>
                  </div>

                  {!isOnTrack && priority === 'low' && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <Pause className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Suggestion</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Consider pausing this low-priority goal to save {formatINR(goal.monthly_extra_payment)}/month for higher priorities.
                        </p>
                      </div>
                    </div>
                  )}

                  {!isOnTrack && priority !== 'low' && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Action Needed</p>
                        <p className="text-xs text-muted-foreground">
                          Increase contribution to {formatINR(requiredMonthly)}/month to reach goal on time.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </FadeInStagger>
  );
}
