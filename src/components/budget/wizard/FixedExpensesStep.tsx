import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Info, CreditCard } from "lucide-react";
import { formatINR } from "@/lib/currency";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDay?: number;
  paidFrom?: string;
}

interface FixedExpensesStepProps {
  rent: number;
  food: number;
  transport: number;
  utilities: number;
  insurance: number;
  subscriptions: number;
  school: number;
  customExpenses: FixedExpense[];
  onFieldChange: (field: string, value: number) => void;
  onCustomExpensesChange: (expenses: FixedExpense[]) => void;
}

export default function FixedExpensesStep({
  rent,
  food,
  transport,
  utilities,
  insurance,
  subscriptions,
  school,
  customExpenses,
  onFieldChange,
  onCustomExpensesChange,
}: FixedExpensesStepProps) {
  const fixedCategories = [
    { label: "Rent", value: rent, field: "rent", icon: "🏠", hint: "Monthly rent or mortgage" },
    { label: "Groceries & Food", value: food, field: "food", icon: "🍽️", hint: "Regular grocery budget" },
    { label: "Transport", value: transport, field: "transport", icon: "🚗", hint: "Fuel, passes, parking" },
    { label: "Utilities", value: utilities, field: "utilities", icon: "💡", hint: "Electricity, water, gas" },
    { label: "Insurance", value: insurance, field: "insurance", icon: "🛡️", hint: "Health, life, vehicle" },
    { label: "Subscriptions", value: subscriptions, field: "subscriptions", icon: "📱", hint: "Netflix, Spotify, etc." },
    { label: "School/Education", value: school, field: "school", icon: "🎓", hint: "Tuition, courses" },
  ];

  const addCustomExpense = () => {
    const newExpense: FixedExpense = {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
      category: "Others",
      dueDay: 1,
      paidFrom: "Bank",
    };
    onCustomExpensesChange([...customExpenses, newExpense]);
  };

  const updateCustomExpense = (id: string, field: keyof FixedExpense, value: any) => {
    onCustomExpensesChange(
      customExpenses.map((expense) =>
        expense.id === id ? { ...expense, [field]: value } : expense
      )
    );
  };

  const removeCustomExpense = (id: string) => {
    onCustomExpensesChange(customExpenses.filter((expense) => expense.id !== id));
  };

  const totalFixed =
    rent +
    food +
    transport +
    utilities +
    insurance +
    subscriptions +
    school +
    customExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* EMI Note */}
      <Alert className="border-primary/30 bg-primary/5">
        <CreditCard className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Note:</strong> Loan EMIs are automatically added from your Loan Manager.
          You don't need to include them here.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Standard Fixed Expenses</CardTitle>
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatINR(totalFixed)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fixedCategories.map((category) => (
              <div key={category.field} className="space-y-2 p-3 border rounded-lg">
                <Label className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  {category.label}
                </Label>
                <Input
                  type="number"
                  value={category.value || ""}
                  onChange={(e) => onFieldChange(category.field, Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">{category.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Fixed Expenses</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add any recurring bills not covered above
              </p>
            </div>
            <Button onClick={addCustomExpense} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customExpenses.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed rounded-lg">
              <Info className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No custom expenses. Add gym membership, maid salary, society maintenance, etc.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-lg"
                >
                  <div className="md:col-span-2">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={expense.name}
                      onChange={(e) => updateCustomExpense(expense.id, "name", e.target.value)}
                      placeholder="Gym Membership, Maid, etc."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input
                      type="number"
                      value={expense.amount || ""}
                      onChange={(e) =>
                        updateCustomExpense(expense.id, "amount", Number(e.target.value))
                      }
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Day</Label>
                    <Select
                      value={expense.dueDay?.toString() || "1"}
                      onValueChange={(value) =>
                        updateCustomExpense(expense.id, "dueDay", Number(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Paid From</Label>
                      <Select
                        value={expense.paidFrom || "Bank"}
                        onValueChange={(value) =>
                          updateCustomExpense(expense.id, "paidFrom", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank">Bank</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeCustomExpense(expense.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
