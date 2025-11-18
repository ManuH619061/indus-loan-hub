import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, AlertCircle, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

interface BudgetSummaryCardsProps {
  totalIncome: number;
  totalExpenses: number;
  totalEMI: number;
  savings: number;
  freeCash: number;
  debtBurden: number;
}

export default function BudgetSummaryCards({
  totalIncome,
  totalExpenses,
  totalEMI,
  savings,
  freeCash,
  debtBurden,
}: BudgetSummaryCardsProps) {
  const cards = [
    {
      title: "Total Income",
      value: totalIncome,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Total Expenses",
      value: totalExpenses,
      icon: DollarSign,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Total EMI",
      value: totalEMI,
      icon: CreditCard,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Savings",
      value: savings,
      icon: PiggyBank,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Free Cash Flow",
      value: freeCash,
      icon: freeCash >= 0 ? TrendingUp : TrendingDown,
      color: freeCash >= 0 ? "text-success" : "text-destructive",
      bgColor: freeCash >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
    {
      title: "Debt Burden",
      value: debtBurden,
      icon: AlertCircle,
      color: debtBurden > 50 ? "text-destructive" : debtBurden > 40 ? "text-warning" : "text-success",
      bgColor: debtBurden > 50 ? "bg-destructive/10" : debtBurden > 40 ? "bg-warning/10" : "bg-success/10",
      isPercent: true,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Card className={card.bgColor}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>
                  {card.isPercent ? formatPercent(card.value) : formatINR(card.value)}
                </div>
                {card.title === "Debt Burden" && (
                  <div className="mt-2 space-y-1">
                    <Progress value={Math.min(card.value, 100)} />
                    <Badge
                      variant={
                        card.value > 50 ? "destructive" : card.value > 40 ? "secondary" : "default"
                      }
                      className="text-xs"
                    >
                      {card.value > 50 ? "Critical" : card.value > 40 ? "High" : "Healthy"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}