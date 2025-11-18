import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Target, Plus, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
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

export default function SavingsGoals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: "savings",
    targetAmount: "",
    targetDate: "",
    monthlyAmount: "",
    notes: "",
  });

  useEffect(() => {
    fetchGoals();
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
        notes: newGoal.notes || null,
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
    const targetDate = new Date(goal.target_date);
    const now = new Date();
    const monthsRemaining = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0, monthsRemaining);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Savings & Goals</h1>
          <p className="text-muted-foreground">Track your financial goals and savings targets</p>
        </div>
        <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
          <DialogTrigger asChild>
            <Button>
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
              <div className="space-y-2">
                <Label htmlFor="target-amount">Target Amount</Label>
                <Input
                  id="target-amount"
                  type="number"
                  placeholder="100000"
                  value={newGoal.targetAmount}
                  onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-date">Target Date</Label>
                <Input
                  id="target-date"
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-amount">Monthly Contribution</Label>
                <Input
                  id="monthly-amount"
                  type="number"
                  placeholder="5000"
                  value={newGoal.monthlyAmount}
                  onChange={(e) => setNewGoal({ ...newGoal, monthlyAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this goal..."
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

      <FadeInStagger>
        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No goals yet</p>
              <p className="text-sm text-muted-foreground mb-4">Start by adding your first savings goal</p>
              <Button onClick={() => setOpenAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {goals.map((goal) => {
              const progress = calculateProgress(goal);
              const monthsRemaining = calculateMonthsRemaining(goal);
              const requiredMonthly = getRequiredMonthly(goal);
              const isOnTrack = goal.monthly_extra_payment >= requiredMonthly;

              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          {goal.goal_type === "savings" ? "Savings Goal" : "Loan Payoff Goal"}
                        </CardTitle>
                        {goal.notes && (
                          <CardDescription className="mt-2">{goal.notes}</CardDescription>
                        )}
                      </div>
                      <Badge variant={isOnTrack ? "default" : "destructive"}>
                        {isOnTrack ? "On Track" : "Behind"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-muted-foreground">{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Target Amount</p>
                        <p className="text-lg font-bold">{formatINR(goal.target_amount)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                        <p className="text-lg font-bold">{formatINR(goal.monthly_extra_payment)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Required Monthly</p>
                        <p className={`text-lg font-bold ${!isOnTrack ? 'text-destructive' : ''}`}>
                          {formatINR(requiredMonthly)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Months Remaining</p>
                        <p className="text-lg font-bold flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {monthsRemaining}
                        </p>
                      </div>
                    </div>

                    {!isOnTrack && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                        <Sparkles className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Suggestion</p>
                          <p className="text-sm text-muted-foreground">
                            Increase your monthly contribution to {formatINR(requiredMonthly)} to reach your goal on time.
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
    </div>
  );
}
