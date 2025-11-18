import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { ResponsiveChart } from "@/components/ui/responsive-chart";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  const chartData = forecasts.map(f => ({
    month: f.month,
    Income: f.income,
    EMIs: f.emis,
    "Other Expenses": f.otherExpenses,
    "Planned Savings": f.plannedSavings,
    "Free Cash": f.freeCash,
    "Debt Burden": f.debtBurden
  }));

  const negativeMonths = forecasts.filter(f => f.freeCash < 0).length;
  const highDebtMonths = forecasts.filter(f => f.debtBurden > 40).length;
  const avgFreeCash = forecasts.reduce((sum, f) => sum + f.freeCash, 0) / forecasts.length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{formatINR(avgFreeCash)}</div>
            <p className="text-xs text-muted-foreground">Avg Free Cash</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive">{negativeMonths}</div>
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground">Negative Months</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-warning">{highDebtMonths}</div>
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground">High Debt Months</p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Projection</CardTitle>
          <CardDescription>Income, expenses, and free cash over 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveChart
            config={{
              Income: { label: "Income", color: "hsl(var(--success))" },
              EMIs: { label: "EMIs", color: "hsl(var(--primary))" },
              "Other Expenses": { label: "Other Expenses", color: "hsl(var(--warning))" },
              "Free Cash": { label: "Free Cash", color: "hsl(var(--chart-2))" }
            }}
            height={300}
          >
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2">{payload[0]?.payload.month}</p>
                      {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span>{entry.name}: {formatINR(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="EMIs" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="Other Expenses" stroke="hsl(var(--warning))" strokeWidth={2} />
              <Line type="monotone" dataKey="Free Cash" stroke="hsl(var(--chart-2))" strokeWidth={2} />
            </LineChart>
          </ResponsiveChart>
        </CardContent>
      </Card>

      {/* Debt Burden Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Debt Burden Trend</CardTitle>
          <CardDescription>Percentage of income going to EMIs</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveChart
            config={{
              "Debt Burden": { label: "Debt Burden %", color: "hsl(var(--destructive))" }
            }}
            height={250}
          >
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{payload[0].payload.month}</p>
                      <p className="text-sm">{formatPercent(payload[0].value as number)}</p>
                    </div>
                  );
                }}
              />
              <Area 
                type="monotone" 
                dataKey="Debt Burden" 
                stroke="hsl(var(--destructive))" 
                fillOpacity={1} 
                fill="url(#debtGradient)" 
              />
            </AreaChart>
          </ResponsiveChart>
        </CardContent>
      </Card>

      {/* Quick Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Adjustments</CardTitle>
          <CardDescription>Update your monthly projections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {forecasts.slice(0, 3).map((forecast) => (
              <div key={forecast.month} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2 font-medium">
                  {forecast.month}
                  {(forecast.freeCash < 0 || forecast.debtBurden > 40) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Income</label>
                  <Input
                    type="number"
                    value={forecast.income || ""}
                    onChange={(e) => forecast.onIncomeChange(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Expenses</label>
                  <Input
                    type="number"
                    value={forecast.otherExpenses || ""}
                    onChange={(e) => forecast.onExpensesChange(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Savings</label>
                  <Input
                    type="number"
                    value={forecast.plannedSavings || ""}
                    onChange={(e) => forecast.onSavingsChange(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}