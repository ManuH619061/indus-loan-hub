import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Target } from "lucide-react";
import { formatINR } from "@/lib/currency";
import { differenceInMonths, parseISO } from "date-fns";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string;
  current_amount: number;
  monthly_contribution: number;
}

interface SavingsGoalsStepProps {
  savings_investments: number;
  goals: SavingsGoal[];
  onSavingsChange: (value: number) => void;
  onGoalsChange: (goals: SavingsGoal[]) => void;
}

export default function SavingsGoalsStep({
  savings_investments,
  goals,
  onSavingsChange,
  onGoalsChange,
}: SavingsGoalsStepProps) {
  const addGoal = () => {
    const newGoal: SavingsGoal = {
      id: crypto.randomUUID(),
      name: "",
      target_amount: 0,
      target_date: new Date().toISOString().slice(0, 10),
      current_amount: 0,
      monthly_contribution: 0,
    };
    onGoalsChange([...goals, newGoal]);
  };

  const updateGoal = (id: string, field: keyof SavingsGoal, value: any) => {
    onGoalsChange(
      goals.map((goal) => {
        if (goal.id === id) {
          const updatedGoal = { ...goal, [field]: value };
          
          // Auto-calculate monthly contribution when target amount or date changes
          if (field === 'target_amount' || field === 'target_date') {
            const monthsRemaining = differenceInMonths(
              parseISO(updatedGoal.target_date),
              new Date()
            );
            const remaining = updatedGoal.target_amount - updatedGoal.current_amount;
            if (monthsRemaining > 0 && remaining > 0) {
              updatedGoal.monthly_contribution = Math.ceil(remaining / monthsRemaining);
            }
          }
          
          return updatedGoal;
        }
        return goal;
      })
    );
  };

  const removeGoal = (id: string) => {
    onGoalsChange(goals.filter((goal) => goal.id !== id));
  };

  const totalMonthlyContributions = goals.reduce(
    (sum, goal) => sum + (goal.monthly_contribution || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            General Savings & Investments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Monthly Savings Amount</Label>
            <Input
              type="number"
              value={savings_investments || ""}
              onChange={(e) => onSavingsChange(Number(e.target.value))}
              placeholder="Enter monthly savings"
            />
            <p className="text-sm text-muted-foreground">
              General savings not tied to specific goals: {formatINR(savings_investments)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Savings Goals</CardTitle>
            <Button onClick={addGoal} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No savings goals. Click "Add Goal" to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const percentage =
                  goal.target_amount > 0
                    ? (goal.current_amount / goal.target_amount) * 100
                    : 0;
                const monthsRemaining = differenceInMonths(
                  parseISO(goal.target_date),
                  new Date()
                );

                return (
                  <div key={goal.id} className="p-4 border rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-xs">Goal Name</Label>
                        <Input
                          value={goal.name}
                          onChange={(e) => updateGoal(goal.id, "name", e.target.value)}
                          placeholder="e.g., Emergency Fund, Vacation"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Target Amount</Label>
                        <Input
                          type="number"
                          value={goal.target_amount || ""}
                          onChange={(e) =>
                            updateGoal(goal.id, "target_amount", Number(e.target.value))
                          }
                          placeholder="100000"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Target Date</Label>
                        <Input
                          type="date"
                          value={goal.target_date}
                          onChange={(e) => updateGoal(goal.id, "target_date", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Current Amount</Label>
                        <Input
                          type="number"
                          value={goal.current_amount || ""}
                          onChange={(e) =>
                            updateGoal(goal.id, "current_amount", Number(e.target.value))
                          }
                          placeholder="20000"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Suggested Monthly</Label>
                        <Input
                          type="number"
                          value={goal.monthly_contribution || ""}
                          onChange={(e) =>
                            updateGoal(goal.id, "monthly_contribution", Number(e.target.value))
                          }
                          placeholder="Auto-calculated"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Progress value={Math.min(percentage, 100)} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {formatINR(goal.current_amount)} / {formatINR(goal.target_amount)} (
                          {percentage.toFixed(0)}%)
                        </span>
                        <span>
                          {monthsRemaining > 0
                            ? `${monthsRemaining} months remaining`
                            : "Target date passed"}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeGoal(goal.id)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove Goal
                    </Button>
                  </div>
                );
              })}

              {goals.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Total Monthly Contributions:</span>
                    <span className="font-semibold">{formatINR(totalMonthlyContributions)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
