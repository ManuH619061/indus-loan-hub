import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { Target, Zap, Shield, TrendingUp, Calendar, DollarSign } from "lucide-react";

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
  const renderStrategy = (strategy: Strategy, key: "normal" | "aggressive" | "safe") => {
    const Icon = strategy.icon;
    return (
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelectStrategy(key)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${strategy.color}`} />
              <CardTitle>{strategy.name}</CardTitle>
            </div>
            <Badge className={strategy.color}>{key.toUpperCase()}</Badge>
          </div>
          <CardDescription>{strategy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Lifestyle Cut
              </p>
              <p className="font-semibold">{formatPercent(strategy.lifestyleExpenseReduction)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Extra EMI
              </p>
              <p className="font-semibold">{formatINR(strategy.extraEMIAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Debt-Free By
              </p>
              <p className="font-semibold text-success">{strategy.debtFreeDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Interest Saved
              </p>
              <p className="font-semibold text-success">{formatINR(strategy.interestSaved)}</p>
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Minimum Free Cash</p>
            <p className="text-lg font-bold">{formatINR(strategy.minimumFreeCash)}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Payoff Strategies</CardTitle>
        <CardDescription>
          Choose a strategy based on your financial goals and risk tolerance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="normal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="normal">Normal</TabsTrigger>
            <TabsTrigger value="aggressive">Aggressive</TabsTrigger>
            <TabsTrigger value="safe">Safe</TabsTrigger>
          </TabsList>

          <TabsContent value="normal" className="space-y-4">
            {renderStrategy(strategies.normal, "normal")}
          </TabsContent>

          <TabsContent value="aggressive" className="space-y-4">
            {renderStrategy(strategies.aggressive, "aggressive")}
          </TabsContent>

          <TabsContent value="safe" className="space-y-4">
            {renderStrategy(strategies.safe, "safe")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}