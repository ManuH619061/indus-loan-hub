import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/currency";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
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
    { label: "Rent", value: rent, field: "rent", icon: "🏠" },
    { label: "Food", value: food, field: "food", icon: "🍽️" },
    { label: "Transport", value: transport, field: "transport", icon: "🚗" },
    { label: "Utilities", value: utilities, field: "utilities", icon: "💡" },
    { label: "Insurance", value: insurance, field: "insurance", icon: "🛡️" },
    { label: "Subscriptions", value: subscriptions, field: "subscriptions", icon: "📱" },
    { label: "School/Education", value: school, field: "school", icon: "🎓" },
  ];

  const addCustomExpense = () => {
    const newExpense: FixedExpense = {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
      category: "Others",
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
              <div key={category.field} className="space-y-2">
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
                {category.value > 0 && (
                  <p className="text-xs text-muted-foreground">{formatINR(category.value)}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Fixed Expenses</CardTitle>
            <Button onClick={addCustomExpense} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom expenses. Click "Add Expense" to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {customExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={expense.name}
                      onChange={(e) => updateCustomExpense(expense.id, "name", e.target.value)}
                      placeholder="Gym Membership"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      value={expense.amount || ""}
                      onChange={(e) =>
                        updateCustomExpense(expense.id, "amount", Number(e.target.value))
                      }
                      placeholder="1000"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeCustomExpense(expense.id)}
                      className="w-full"
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
