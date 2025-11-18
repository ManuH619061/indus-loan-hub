import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTableSimple } from "@/components/ui/responsive-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { AlertCircle, TrendingDown } from "lucide-react";

interface MonthForecast {
  month: string;
  income: number;
  emis: number;
  otherExpenses: number;
  plannedSavings: number;
  freeCash: number;
  debtBurden: number;
  onIncomeChange: (value: number) => void;
  onExpensesChange: (value: number) => void;
  onSavingsChange: (value: number) => void;
}

interface FutureMonthsPlannerProps {
  forecasts: MonthForecast[];
}

export default function FutureMonthsPlanner({ forecasts }: FutureMonthsPlannerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>12-Month Forecast</CardTitle>
        <CardDescription>
          Plan your budget for the next 12 months. EMIs are auto-calculated from loan schedules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveTableSimple minWidth={800}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Month</TableHead>
              <TableHead>Income</TableHead>
              <TableHead>EMIs</TableHead>
              <TableHead>Other Expenses</TableHead>
              <TableHead>Planned Savings</TableHead>
              <TableHead>Free Cash</TableHead>
              <TableHead>Debt Burden</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.map((forecast, index) => {
              const isNegativeCash = forecast.freeCash < 0;
              const isHighDebt = forecast.debtBurden > 40;

              return (
                <TableRow
                  key={forecast.month}
                  className={isNegativeCash || isHighDebt ? "bg-destructive/10" : ""}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {forecast.month}
                      {(isNegativeCash || isHighDebt) && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={forecast.income || ""}
                      onChange={(e) => forecast.onIncomeChange(Number(e.target.value))}
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell className="text-primary font-semibold">
                    {formatINR(forecast.emis)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={forecast.otherExpenses || ""}
                      onChange={(e) => forecast.onExpensesChange(Number(e.target.value))}
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={forecast.plannedSavings || ""}
                      onChange={(e) => forecast.onSavingsChange(Number(e.target.value))}
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <div className={`font-semibold ${isNegativeCash ? "text-destructive" : "text-success"}`}>
                      {formatINR(forecast.freeCash)}
                      {isNegativeCash && <TrendingDown className="inline h-4 w-4 ml-1" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isHighDebt ? "destructive" : "default"}
                    >
                      {formatPercent(forecast.debtBurden)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ResponsiveTableSimple>
      </CardContent>
    </Card>
  );
}