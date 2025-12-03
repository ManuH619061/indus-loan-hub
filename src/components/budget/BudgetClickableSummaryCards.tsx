import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/currency";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Receipt, 
  CreditCard, 
  Percent,
  ExternalLink 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BudgetClickableSummaryCardsProps {
  totalIncome: number;
  totalExpenses: number;
  totalEMI: number;
  freeCash: number;
  debtBurden: number;
  monthLabel: string;
  onScrollToSection: (section: string) => void;
}

export default function BudgetClickableSummaryCards({
  totalIncome,
  totalExpenses,
  totalEMI,
  freeCash,
  debtBurden,
  monthLabel,
  onScrollToSection,
}: BudgetClickableSummaryCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Total Income",
      value: formatINR(totalIncome),
      subtitle: monthLabel,
      icon: Wallet,
      color: "text-success",
      bgColor: "bg-success/10",
      onClick: () => onScrollToSection("income"),
    },
    {
      title: "Total Expenses",
      value: formatINR(totalExpenses),
      subtitle: "Fixed + Variable",
      icon: Receipt,
      color: "text-foreground",
      bgColor: "bg-muted",
      onClick: () => onScrollToSection("expenses"),
    },
    {
      title: "Total EMI",
      value: formatINR(totalEMI),
      subtitle: "From Loan Manager",
      icon: CreditCard,
      color: "text-primary",
      bgColor: "bg-primary/10",
      onClick: () => navigate("/loans"),
      external: true,
    },
    {
      title: "Free Cash Flow",
      value: formatINR(freeCash),
      subtitle: freeCash >= 0 ? "Surplus" : "Deficit",
      icon: freeCash >= 0 ? TrendingUp : TrendingDown,
      color: freeCash >= 0 ? "text-success" : "text-destructive",
      bgColor: freeCash >= 0 ? "bg-success/10" : "bg-destructive/10",
      badge: freeCash >= 0 ? { text: "+", variant: "default" as const } : { text: "-", variant: "destructive" as const },
      onClick: () => onScrollToSection("forecast"),
    },
    {
      title: "Debt Burden",
      value: formatPercent(debtBurden),
      subtitle: debtBurden < 40 ? "Healthy" : debtBurden < 50 ? "Warning" : "Critical",
      icon: Percent,
      color: debtBurden < 40 ? "text-success" : debtBurden < 50 ? "text-warning" : "text-destructive",
      bgColor: debtBurden < 40 ? "bg-success/10" : debtBurden < 50 ? "bg-warning/10" : "bg-destructive/10",
      badge: debtBurden < 40 
        ? { text: "Good", variant: "default" as const } 
        : debtBurden < 50 
        ? { text: "Warning", variant: "secondary" as const } 
        : { text: "Critical", variant: "destructive" as const },
      onClick: () => onScrollToSection("insights"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
          onClick={card.onClick}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
                {card.title}
              </span>
              {card.external && (
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline justify-between">
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              {card.badge && (
                <Badge variant={card.badge.variant} className="text-[10px] px-1.5 py-0">
                  {card.badge.text}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
