import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/currency";

interface BudgetCategory {
  label: string;
  value: number;
  limit?: number;
  onChange: (value: number) => void;
  onLimitChange?: (value: number) => void;
}

interface MonthlyBudgetFormProps {
  income: {
    salary: BudgetCategory;
    sideIncome: BudgetCategory;
    otherIncome: BudgetCategory;
  };
  fixedExpenses: {
    rent: BudgetCategory;
    food: BudgetCategory;
    transport: BudgetCategory;
    utilities: BudgetCategory;
    school: BudgetCategory;
    subscriptions: BudgetCategory;
    insurance: BudgetCategory;
  };
  variableExpenses: {
    eatingOut: BudgetCategory;
    shopping: BudgetCategory;
    travel: BudgetCategory;
    other: BudgetCategory;
  };
  savingsInvestments: BudgetCategory;
  totalEMI: number;
}

export default function MonthlyBudgetForm({
  income,
  fixedExpenses,
  variableExpenses,
  savingsInvestments,
  totalEMI,
}: MonthlyBudgetFormProps) {
  const renderCategory = (category: BudgetCategory, showLimit: boolean = false) => (
    <div className="space-y-2">
      <Label htmlFor={category.label}>{category.label}</Label>
      <Input
        id={category.label}
        type="number"
        value={category.value || ""}
        onChange={(e) => category.onChange(Number(e.target.value))}
        placeholder="0"
      />
      {showLimit && category.limit !== undefined && category.onLimitChange && (
        <>
          <Label htmlFor={`${category.label}-limit`} className="text-xs text-muted-foreground">
            Monthly Limit
          </Label>
          <Input
            id={`${category.label}-limit`}
            type="number"
            value={category.limit || ""}
            onChange={(e) => category.onLimitChange!(Number(e.target.value))}
            placeholder="Set limit"
            className="text-sm"
          />
          {category.limit > 0 && (
            <div className="space-y-1">
              <Progress value={Math.min((category.value / category.limit) * 100, 100)} />
              <p className="text-xs text-muted-foreground text-right">
                {formatINR(category.value)} / {formatINR(category.limit)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month's Budget</CardTitle>
        <CardDescription>Enter your income and expenses for detailed tracking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Income Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            💰 Income
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {renderCategory(income.salary)}
            {renderCategory(income.sideIncome)}
            {renderCategory(income.otherIncome)}
          </div>
        </div>

        <Separator />

        {/* Fixed Expenses Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            🏠 Fixed Expenses
          </h3>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {renderCategory(fixedExpenses.rent)}
            {renderCategory(fixedExpenses.food, true)}
            {renderCategory(fixedExpenses.transport)}
            {renderCategory(fixedExpenses.utilities)}
            {renderCategory(fixedExpenses.school)}
            {renderCategory(fixedExpenses.subscriptions)}
            {renderCategory(fixedExpenses.insurance)}
          </div>
        </div>

        <Separator />

        {/* Variable Expenses Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            🛍️ Variable / Lifestyle
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderCategory(variableExpenses.eatingOut, true)}
            {renderCategory(variableExpenses.shopping, true)}
            {renderCategory(variableExpenses.travel, true)}
            {renderCategory(variableExpenses.other)}
          </div>
        </div>

        <Separator />

        {/* Savings & EMI Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            💎 Savings & EMIs
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {renderCategory(savingsInvestments)}
            <div className="space-y-2">
              <Label>Total EMIs (Auto-calculated)</Label>
              <Input
                type="text"
                value={formatINR(totalEMI)}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}