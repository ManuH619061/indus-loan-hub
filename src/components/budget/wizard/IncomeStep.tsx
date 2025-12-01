import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/currency";

interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  start_month: string;
}

interface SalarySettings {
  base_salary: number;
  increment_month: number;
  increment_type: string;
  increment_value: number;
}

interface IncomeStepProps {
  salary: number;
  salarySettings: SalarySettings | null;
  otherIncome: IncomeSource[];
  onSalaryChange: (value: number) => void;
  onSalarySettingsChange: (settings: SalarySettings) => void;
  onOtherIncomeChange: (income: IncomeSource[]) => void;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function IncomeStep({
  salary,
  salarySettings,
  otherIncome,
  onSalaryChange,
  onSalarySettingsChange,
  onOtherIncomeChange,
}: IncomeStepProps) {
  const addIncomeSource = () => {
    const newSource: IncomeSource = {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
      frequency: "Monthly",
      start_month: new Date().toISOString().slice(0, 7),
    };
    onOtherIncomeChange([...otherIncome, newSource]);
  };

  const updateIncomeSource = (id: string, field: keyof IncomeSource, value: any) => {
    onOtherIncomeChange(
      otherIncome.map((source) =>
        source.id === id ? { ...source, [field]: value } : source
      )
    );
  };

  const removeIncomeSource = (id: string) => {
    onOtherIncomeChange(otherIncome.filter((source) => source.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Base Salary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Monthly Salary</Label>
            <Input
              type="number"
              value={salary || ""}
              onChange={(e) => onSalaryChange(Number(e.target.value))}
              placeholder="Enter your monthly salary"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Current: {formatINR(salary)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <Label>Increment Month</Label>
              <Select
                value={salarySettings?.increment_month?.toString() || "4"}
                onValueChange={(value) =>
                  onSalarySettingsChange({
                    ...salarySettings,
                    base_salary: salary,
                    increment_month: Number(value),
                    increment_type: salarySettings?.increment_type || "percentage",
                    increment_value: salarySettings?.increment_value || 10,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Increment Type</Label>
              <Select
                value={salarySettings?.increment_type || "percentage"}
                onValueChange={(value) =>
                  onSalarySettingsChange({
                    ...salarySettings,
                    base_salary: salary,
                    increment_month: salarySettings?.increment_month || 4,
                    increment_type: value,
                    increment_value: salarySettings?.increment_value || 10,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage %</SelectItem>
                  <SelectItem value="amount">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Increment Value</Label>
              <Input
                type="number"
                value={salarySettings?.increment_value || ""}
                onChange={(e) =>
                  onSalarySettingsChange({
                    ...salarySettings,
                    base_salary: salary,
                    increment_month: salarySettings?.increment_month || 4,
                    increment_type: salarySettings?.increment_type || "percentage",
                    increment_value: Number(e.target.value),
                  })
                }
                placeholder={salarySettings?.increment_type === "percentage" ? "10" : "5000"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Other Income Sources</CardTitle>
            <Button onClick={addIncomeSource} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Income
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {otherIncome.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No additional income sources. Click "Add Income" to add one.
            </p>
          ) : (
            <div className="space-y-4">
              {otherIncome.map((source) => (
                <div
                  key={source.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-lg"
                >
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={source.name}
                      onChange={(e) => updateIncomeSource(source.id, "name", e.target.value)}
                      placeholder="Freelance"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      value={source.amount || ""}
                      onChange={(e) =>
                        updateIncomeSource(source.id, "amount", Number(e.target.value))
                      }
                      placeholder="10000"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Frequency</Label>
                    <Select
                      value={source.frequency}
                      onValueChange={(value) =>
                        updateIncomeSource(source.id, "frequency", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="One-time">One-time</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Start Month</Label>
                    <Input
                      type="month"
                      value={source.start_month}
                      onChange={(e) =>
                        updateIncomeSource(source.id, "start_month", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeIncomeSource(source.id)}
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
