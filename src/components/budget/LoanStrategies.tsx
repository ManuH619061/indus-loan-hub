import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { Target, Zap, Shield } from "lucide-react";
import { ResponsiveChart } from "@/components/ui/responsive-chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface Strategy {
  name: string;
  description: string;
  lifestyleExpenseReduction: number;
  extraEMIAmount: number;
  debtFreeDate: string;
  interestSaved: number;
  minimumFreeCash: number;
  icon: typeof Target;
  color: string;
}

interface LoanStrategiesProps {
  strategies: {
    normal: Strategy;
    aggressive: Strategy;
    safe: Strategy;
  };
  onSelectStrategy: (strategy: "normal" | "aggressive" | "safe") => void;
}

export default function LoanStrategies({ strategies, onSelectStrategy }: LoanStrategiesProps) {
  const comparisonData = [
    {
      metric: "Interest Saved",
      Normal: strategies.normal.interestSaved,
      Aggressive: strategies.aggressive.interestSaved,
      Safe: strategies.safe.interestSaved
    },
    {
      metric: "Extra EMI",
      Normal: strategies.normal.extraEMIAmount,
      Aggressive: strategies.aggressive.extraEMIAmount,
      Safe: strategies.safe.extraEMIAmount
    },
    {
      metric: "Min Free Cash",
      Normal: strategies.normal.minimumFreeCash,
      Aggressive: strategies.aggressive.minimumFreeCash,
      Safe: strategies.safe.minimumFreeCash
    }
  ];

  const radarData = [
    {
      metric: "Savings",
      Normal: Math.min(strategies.normal.interestSaved / 10000, 100),
      Aggressive: Math.min(strategies.aggressive.interestSaved / 10000, 100),
      Safe: Math.min(strategies.safe.interestSaved / 10000, 100)
    },
    {
      metric: "Safety",
      Normal: Math.min(strategies.normal.minimumFreeCash / 1000, 100),
      Aggressive: Math.min(strategies.aggressive.minimumFreeCash / 1000, 100),
      Safe: Math.min(strategies.safe.minimumFreeCash / 1000, 100)
    },
    {
      metric: "Speed",
      Normal: 60,
      Aggressive: 90,
      Safe: 40
    }
  ];

  return (
    <div className="space-y-4">
      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(strategies).map(([key, strategy]) => {
          const Icon = strategy.icon;
          const strategyKey = key as "normal" | "aggressive" | "safe";
          return (
            <Card 
              key={key} 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
              onClick={() => onSelectStrategy(strategyKey)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${strategy.color}`} />
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                  </div>
                  <Badge className={strategy.color}>{key.toUpperCase()}</Badge>
                </div>
                <CardDescription className="text-xs">{strategy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Interest Saved</span>
                  <span className="font-bold text-success">{formatINR(strategy.interestSaved)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Debt-Free By</span>
                  <span className="font-semibold">{strategy.debtFreeDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Min Free Cash</span>
                  <span className="font-semibold">{formatINR(strategy.minimumFreeCash)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Comparison</CardTitle>
          <CardDescription>Compare key metrics across all strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveChart
            config={{
              Normal: { label: "Normal", color: "hsl(var(--primary))" },
              Aggressive: { label: "Aggressive", color: "hsl(var(--destructive))" },
              Safe: { label: "Safe", color: "hsl(var(--success))" }
            }}
            height={300}
          >
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="metric" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2">{payload[0]?.payload.metric}</p>
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
              <Bar dataKey="Normal" fill="hsl(var(--primary))" />
              <Bar dataKey="Aggressive" fill="hsl(var(--destructive))" />
              <Bar dataKey="Safe" fill="hsl(var(--success))" />
            </BarChart>
          </ResponsiveChart>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Profile Analysis</CardTitle>
          <CardDescription>Visual comparison of strategy characteristics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveChart
            config={{
              Normal: { label: "Normal", color: "hsl(var(--primary))" },
              Aggressive: { label: "Aggressive", color: "hsl(var(--destructive))" },
              Safe: { label: "Safe", color: "hsl(var(--success))" }
            }}
            height={350}
          >
            <RadarChart data={radarData}>
              <PolarGrid className="stroke-muted" />
              <PolarAngleAxis dataKey="metric" className="text-xs" />
              <PolarRadiusAxis className="text-xs" />
              <Tooltip />
              <Legend />
              <Radar name="Normal" dataKey="Normal" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              <Radar name="Aggressive" dataKey="Aggressive" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} />
              <Radar name="Safe" dataKey="Safe" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveChart>
        </CardContent>
      </Card>
    </div>
  );
}