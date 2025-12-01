import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/currency";

interface VariableExpensesStepProps {
  eating_out: number;
  eating_out_limit: number;
  shopping: number;
  shopping_limit: number;
  travel: number;
  travel_limit: number;
  other_variable: number;
  onFieldChange: (field: string, value: number) => void;
}

export default function VariableExpensesStep({
  eating_out,
  eating_out_limit,
  shopping,
  shopping_limit,
  travel,
  travel_limit,
  other_variable,
  onFieldChange,
}: VariableExpensesStepProps) {
  const categories = [
    {
      label: "Eating Out",
      icon: "🍔",
      actual: eating_out,
      actualField: "eating_out",
      limit: eating_out_limit,
      limitField: "eating_out_limit",
    },
    {
      label: "Shopping",
      icon: "🛍️",
      actual: shopping,
      actualField: "shopping",
      limit: shopping_limit,
      limitField: "shopping_limit",
    },
    {
      label: "Travel",
      icon: "✈️",
      actual: travel,
      actualField: "travel",
      limit: travel_limit,
      limitField: "travel_limit",
    },
    {
      label: "Entertainment & Misc",
      icon: "🎮",
      actual: other_variable,
      actualField: "other_variable",
      limit: 0,
      limitField: "",
    },
  ];

  const totalVariable = eating_out + shopping + travel + other_variable;
  const totalLimit = eating_out_limit + shopping_limit + travel_limit;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variable / Lifestyle Expenses</CardTitle>
            <div className="text-sm text-muted-foreground">
              Total Budget: <span className="font-semibold text-foreground">{formatINR(totalLimit)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {categories.map((category) => {
              const percentage = category.limit > 0 ? (category.actual / category.limit) * 100 : 0;
              const isOverBudget = category.limit > 0 && category.actual > category.limit;

              return (
                <div key={category.actualField} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base">
                      <span className="text-xl">{category.icon}</span>
                      {category.label}
                    </Label>
                    {category.limit > 0 && (
                      <span
                        className={`text-sm font-medium ${
                          isOverBudget ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {formatINR(category.actual)} / {formatINR(category.limit)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Actual Spent</Label>
                      <Input
                        type="number"
                        value={category.actual || ""}
                        onChange={(e) => onFieldChange(category.actualField, Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    {category.limitField && (
                      <div>
                        <Label className="text-xs">Budget Limit</Label>
                        <Input
                          type="number"
                          value={category.limit || ""}
                          onChange={(e) => onFieldChange(category.limitField, Number(e.target.value))}
                          placeholder="Set limit"
                        />
                      </div>
                    )}
                  </div>

                  {category.limit > 0 && (
                    <div className="space-y-1">
                      <Progress value={Math.min(percentage, 100)} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percentage.toFixed(0)}% used</span>
                        {isOverBudget && (
                          <span className="text-destructive font-medium">
                            Over by {formatINR(category.actual - category.limit)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
