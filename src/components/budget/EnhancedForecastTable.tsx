import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { AlertCircle, TrendingDown, CheckCircle, Calendar } from "lucide-react";

interface MonthForecast {
  month: string;
  monthKey: string;
  income: number;
  emis: number;
  fixedExpenses: number;
  lifestyleBudget: number;
  plannedSavings: number;
  freeCash: number;
  debtBurden: number;
}

interface EnhancedForecastTableProps {
  forecasts: MonthForecast[];
  onLifestyleChange: (monthKey: string, value: number) => void;
  onSavingsChange: (monthKey: string, value: number) => void;
  onMonthClick: (monthKey: string) => void;
}

export default function EnhancedForecastTable({
  forecasts,
  onLifestyleChange,
  onSavingsChange,
  onMonthClick,
}: EnhancedForecastTableProps) {
  return (
    <Card id="forecast">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          12-Month Forecast
        </CardTitle>
        <CardDescription>
          Plan your budget for the next 12 months. Click any row to edit that month's budget. EMIs are auto-calculated from loan schedules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] font-semibold">Month</TableHead>
                <TableHead className="font-semibold text-right">Income</TableHead>
                <TableHead className="font-semibold text-right">EMIs</TableHead>
                <TableHead className="font-semibold text-right">Fixed</TableHead>
                <TableHead className="font-semibold text-right">Lifestyle</TableHead>
                <TableHead className="font-semibold text-right">Savings</TableHead>
                <TableHead className="font-semibold text-right">Free Cash</TableHead>
                <TableHead className="font-semibold text-center">Debt %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.map((forecast, index) => {
                const isNegativeCash = forecast.freeCash < 0;
                const isHighDebt = forecast.debtBurden > 40;
                const isHealthy = forecast.freeCash > 0 && forecast.debtBurden < 40;

                return (
                  <TableRow
                    key={forecast.monthKey}
                    className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                      isNegativeCash ? "bg-destructive/10 hover:bg-destructive/15" : 
                      isHealthy ? "bg-success/5 hover:bg-success/10" : ""
                    }`}
                    onClick={() => onMonthClick(forecast.monthKey)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{forecast.month}</span>
                        {isNegativeCash && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {isHealthy && index === 0 && (
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {formatINR(forecast.income)}
                    </TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {formatINR(forecast.emis)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatINR(forecast.fixedExpenses)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        value={forecast.lifestyleBudget || ""}
                        onChange={(e) => onLifestyleChange(forecast.monthKey, Number(e.target.value))}
                        className="w-24 h-8 text-right text-sm"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        value={forecast.plannedSavings || ""}
                        onChange={(e) => onSavingsChange(forecast.monthKey, Number(e.target.value))}
                        className="w-24 h-8 text-right text-sm"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`font-semibold ${isNegativeCash ? "text-destructive" : "text-success"}`}>
                        {formatINR(forecast.freeCash)}
                        {isNegativeCash && <TrendingDown className="inline h-4 w-4 ml-1" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={isHighDebt ? "destructive" : forecast.debtBurden > 30 ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {formatPercent(forecast.debtBurden)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-success/20 border border-success/50" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/50" />
            <span>Deficit</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-destructive" />
            <span>Needs attention</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
