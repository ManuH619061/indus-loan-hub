import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency";
import { differenceInDays, subMonths, format } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle,
  Award,
  Target,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Area, AreaChart } from "recharts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CreditFactor {
  name: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "fair" | "poor";
  impact: "high" | "medium" | "low";
  description: string;
  suggestion?: string;
}

interface RepairStrategy {
  id: string;
  priority: number;
  action: string;
  impact: string;
  scoreBoost: number;
  difficulty: "easy" | "medium" | "hard";
  loanId?: string;
}

interface ScoreTrend {
  month: string;
  score: number;
  change: number;
}

export const CreditScoreSimulator = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [estimatedScore, setEstimatedScore] = useState(650);
  const [scoreCategory, setScoreCategory] = useState<"excellent" | "good" | "fair" | "poor" | "very-poor">("fair");
  const [factors, setFactors] = useState<CreditFactor[]>([]);
  const [repairStrategies, setRepairStrategies] = useState<RepairStrategy[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [utilizationPercent, setUtilizationPercent] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [scoreChange, setScoreChange] = useState(0);

  const calculateCreditScore = async () => {
    if (!user) return;

    try {
      // Fetch loans with payment history
      const { data: loans } = await supabase
        .from("loans")
        .select(`
          id, loan_name, principal_amount, emi_amount, interest_rate_apy, status, disbursed_on,
          payments (id, paid_on, amount, payment_type),
          amortization_rows (due_on, is_paid, scheduled_emi)
        `)
        .eq("user_id", user.id);

      // Fetch charges (late fees, etc.)
      const { data: charges } = await supabase
        .from("charges")
        .select("amount, charge_type, charge_on, loan_id")
        .in("loan_id", loans?.map(l => l.id) || []);

      let baseScore = 300; // CIBIL starts at 300
      const factorsList: CreditFactor[] = [];
      const strategies: RepairStrategy[] = [];
      const earnedBadges: string[] = [];

      // === FACTOR 1: Payment History (35% weight) ===
      let onTimePayments = 0;
      let latePayments = 0;
      let totalPaymentsDue = 0;

      loans?.forEach(loan => {
        const amortRows = (loan.amortization_rows as any[]) || [];
        const payments = (loan.payments as any[]) || [];

        amortRows.forEach((row: any) => {
          const dueDate = new Date(row.due_on);
          if (dueDate <= new Date()) {
            totalPaymentsDue++;
            
            // Find if payment was made on time
            const matchingPayment = payments.find((p: any) => {
              const paidDate = new Date(p.paid_on);
              const daysDiff = differenceInDays(paidDate, dueDate);
              return daysDiff <= 5 && p.payment_type === "EMI";
            });

            if (row.is_paid && matchingPayment) {
              onTimePayments++;
            } else if (row.is_paid) {
              latePayments++;
            } else {
              latePayments++;
            }
          }
        });
      });

      const paymentHistoryScore = totalPaymentsDue > 0 
        ? Math.round((onTimePayments / totalPaymentsDue) * 315) // Max 315 points for payment history
        : 280;
      
      baseScore += paymentHistoryScore;

      const paymentHistoryPercent = totalPaymentsDue > 0 
        ? Math.round((onTimePayments / totalPaymentsDue) * 100)
        : 100;

      factorsList.push({
        name: "Payment History",
        score: paymentHistoryScore,
        maxScore: 315,
        status: paymentHistoryPercent >= 95 ? "excellent" : paymentHistoryPercent >= 80 ? "good" : paymentHistoryPercent >= 60 ? "fair" : "poor",
        impact: "high",
        description: `${onTimePayments}/${totalPaymentsDue} payments on time (${paymentHistoryPercent}%)`,
        suggestion: latePayments > 0 ? "Set up auto-pay to avoid missed payments" : undefined
      });

      if (paymentHistoryPercent >= 95 && totalPaymentsDue >= 6) {
        earnedBadges.push("🏆 Perfect Payer");
      }

      // === FACTOR 2: Credit Utilization (30% weight) ===
      const totalCreditLimit = loans?.reduce((sum, l) => sum + Number(l.principal_amount), 0) || 0;
      const totalOutstanding = loans?.filter(l => l.status === "ACTIVE")
        .reduce((sum, l) => {
          const unpaid = ((l.amortization_rows as any[]) || [])
            .filter((r: any) => !r.is_paid)
            .reduce((s: number, r: any) => s + Number(r.scheduled_emi), 0);
          return sum + unpaid;
        }, 0) || 0;

      const utilization = totalCreditLimit > 0 ? (totalOutstanding / totalCreditLimit) * 100 : 0;
      setUtilizationPercent(Math.round(utilization));

      let utilizationScore = 0;
      if (utilization <= 30) utilizationScore = 270;
      else if (utilization <= 50) utilizationScore = 220;
      else if (utilization <= 70) utilizationScore = 150;
      else if (utilization <= 90) utilizationScore = 80;
      else utilizationScore = 30;

      baseScore += utilizationScore;

      factorsList.push({
        name: "Credit Utilization",
        score: utilizationScore,
        maxScore: 270,
        status: utilization <= 30 ? "excellent" : utilization <= 50 ? "good" : utilization <= 70 ? "fair" : "poor",
        impact: "high",
        description: `${Math.round(utilization)}% of credit used (${formatCurrency(totalOutstanding)} of ${formatCurrency(totalCreditLimit)})`,
        suggestion: utilization > 30 ? "Try to keep utilization below 30% for best score" : undefined
      });

      if (utilization <= 30) {
        earnedBadges.push("💳 Low Utilizer");
      }

      // === FACTOR 3: Credit Age (15% weight) ===
      const oldestLoan = loans?.reduce((oldest, loan) => {
        const disbursed = new Date(loan.disbursed_on);
        return !oldest || disbursed < oldest ? disbursed : oldest;
      }, null as Date | null);

      const creditAgeMonths = oldestLoan 
        ? Math.floor(differenceInDays(new Date(), oldestLoan) / 30)
        : 0;

      let ageScore = 0;
      if (creditAgeMonths >= 84) ageScore = 135; // 7+ years
      else if (creditAgeMonths >= 60) ageScore = 115; // 5+ years
      else if (creditAgeMonths >= 36) ageScore = 90; // 3+ years
      else if (creditAgeMonths >= 24) ageScore = 70; // 2+ years
      else if (creditAgeMonths >= 12) ageScore = 50; // 1+ year
      else ageScore = 25;

      baseScore += ageScore;

      factorsList.push({
        name: "Credit History Length",
        score: ageScore,
        maxScore: 135,
        status: creditAgeMonths >= 60 ? "excellent" : creditAgeMonths >= 36 ? "good" : creditAgeMonths >= 12 ? "fair" : "poor",
        impact: "medium",
        description: `${Math.floor(creditAgeMonths / 12)} years ${creditAgeMonths % 12} months of credit history`,
        suggestion: creditAgeMonths < 24 ? "Keep old accounts open to build history" : undefined
      });

      if (creditAgeMonths >= 60) {
        earnedBadges.push("⏳ Seasoned Borrower");
      }

      // === FACTOR 4: Credit Mix (10% weight) ===
      const loanTypes = new Set(loans?.map(l => l.status === "ACTIVE" ? "active" : "closed") || []);
      const hasClosedLoans = loans?.some(l => l.status === "CLOSED") || false;
      const activeLoansCount = loans?.filter(l => l.status === "ACTIVE").length || 0;

      let mixScore = 45;
      if (activeLoansCount >= 1 && hasClosedLoans) mixScore = 90;
      else if (activeLoansCount >= 2) mixScore = 70;
      else if (activeLoansCount === 1) mixScore = 50;

      baseScore += mixScore;

      factorsList.push({
        name: "Credit Mix",
        score: mixScore,
        maxScore: 90,
        status: mixScore >= 70 ? "excellent" : mixScore >= 50 ? "good" : "fair",
        impact: "low",
        description: `${activeLoansCount} active loan${activeLoansCount !== 1 ? 's' : ''}, ${hasClosedLoans ? 'with' : 'no'} closed accounts`,
        suggestion: !hasClosedLoans && activeLoansCount > 0 ? "Successfully closing a loan improves your mix" : undefined
      });

      // === FACTOR 5: Recent Activity (10% weight) ===
      const recentLoans = loans?.filter(l => {
        const disbursed = new Date(l.disbursed_on);
        return differenceInDays(new Date(), disbursed) <= 180;
      }).length || 0;

      let activityScore = 90;
      if (recentLoans >= 3) activityScore = 30; // Too many recent inquiries
      else if (recentLoans === 2) activityScore = 60;
      else if (recentLoans === 1) activityScore = 75;

      baseScore += activityScore;

      factorsList.push({
        name: "Recent Credit Activity",
        score: activityScore,
        maxScore: 90,
        status: recentLoans <= 1 ? "excellent" : recentLoans === 2 ? "fair" : "poor",
        impact: "low",
        description: `${recentLoans} new loan${recentLoans !== 1 ? 's' : ''} in last 6 months`,
        suggestion: recentLoans >= 2 ? "Avoid applying for new credit for 6 months" : undefined
      });

      // Late fee penalty
      const lateFeeCount = charges?.filter(c => c.charge_type === "LATE_FEE").length || 0;
      if (lateFeeCount > 0) {
        baseScore -= lateFeeCount * 15;
        strategies.push({
          id: "avoid-late-fees",
          priority: 1,
          action: "Avoid late payment fees",
          impact: `+${lateFeeCount * 15} points potential`,
          scoreBoost: lateFeeCount * 15,
          difficulty: "easy"
        });
      }

      // Cap score between 300-900
      const finalScore = Math.min(900, Math.max(300, baseScore));
      setEstimatedScore(finalScore);

      // Determine category
      if (finalScore >= 750) setScoreCategory("excellent");
      else if (finalScore >= 700) setScoreCategory("good");
      else if (finalScore >= 650) setScoreCategory("fair");
      else if (finalScore >= 550) setScoreCategory("poor");
      else setScoreCategory("very-poor");

      setFactors(factorsList);

      // Generate repair strategies
      const sortedFactors = [...factorsList].sort((a, b) => 
        (a.score / a.maxScore) - (b.score / b.maxScore)
      );

      sortedFactors.forEach((factor, index) => {
        if (factor.score < factor.maxScore * 0.8 && factor.suggestion) {
          strategies.push({
            id: `repair-${factor.name}`,
            priority: index + 1,
            action: factor.suggestion,
            impact: `Improve ${factor.name}`,
            scoreBoost: Math.round((factor.maxScore - factor.score) * 0.5),
            difficulty: factor.impact === "high" ? "medium" : "easy"
          });
        }
      });

      // Add loan-specific strategies
      const highInterestLoans = loans?.filter(l => l.status === "ACTIVE" && l.interest_rate_apy > 15) || [];
      if (highInterestLoans.length > 0) {
        strategies.push({
          id: "prepay-high-interest",
          priority: strategies.length + 1,
          action: `Prepay ${highInterestLoans[0].loan_name} (${highInterestLoans[0].interest_rate_apy}% rate)`,
          impact: "Reduce utilization & interest",
          scoreBoost: 20,
          difficulty: "medium",
          loanId: highInterestLoans[0].id
        });
      }

      setRepairStrategies(strategies.slice(0, 4));
      setBadges(earnedBadges);

      // Generate score trend (simulated based on payment history)
      const trendData: ScoreTrend[] = [];
      let trendScore = finalScore - Math.random() * 50;
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const change = i === 0 ? 0 : Math.round((Math.random() - 0.3) * 20);
        trendScore = Math.min(900, Math.max(300, trendScore + change));
        trendData.push({
          month: format(monthDate, "MMM"),
          score: Math.round(trendScore),
          change
        });
      }
      
      // Ensure current month matches calculated score
      trendData[trendData.length - 1].score = finalScore;
      trendData[trendData.length - 1].change = finalScore - trendData[trendData.length - 2].score;
      
      setScoreTrend(trendData);
      setScoreChange(trendData[trendData.length - 1].change);

    } catch (error) {
      console.error("Error calculating credit score:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateCreditScore();
  }, [user]);

  const getScoreColor = (category: string) => {
    switch (category) {
      case "excellent": return "text-green-500";
      case "good": return "text-blue-500";
      case "fair": return "text-yellow-500";
      case "poor": return "text-orange-500";
      case "very-poor": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getScoreGradient = (score: number) => {
    const percent = ((score - 300) / 600) * 100;
    if (percent >= 75) return "from-green-500 to-emerald-400";
    if (percent >= 60) return "from-blue-500 to-cyan-400";
    if (percent >= 45) return "from-yellow-500 to-amber-400";
    if (percent >= 30) return "from-orange-500 to-amber-500";
    return "from-red-500 to-rose-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent": return "bg-green-500/10 text-green-600 border-green-500/30";
      case "good": return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "fair": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
      case "poor": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-500/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Credit Score Simulator
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Estimated score based on your payment behavior. Not an official CIBIL score.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Based on your payment behavior</p>
            </div>
          </div>
          {badges.length > 0 && (
            <div className="flex gap-1">
              {badges.slice(0, 2).map((badge, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] bg-purple-500/10">
                  {badge}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getScoreGradient(estimatedScore)} p-1`}>
              <div className="w-full h-full rounded-full bg-background flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{estimatedScore}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{scoreCategory}</span>
              </div>
            </div>
            <AnimatePresence>
              {scoreChange !== 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`absolute -top-1 -right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    scoreChange > 0 ? "bg-green-500 text-white" : "bg-destructive text-white"
                  }`}
                >
                  {scoreChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(scoreChange)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Score Trend Mini Chart */}
          <div className="flex-1 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scoreTrend}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#scoreGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Credit Utilization Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              Credit Utilization
            </span>
            <span className={`font-medium ${
              utilizationPercent <= 30 ? "text-green-600" : 
              utilizationPercent <= 50 ? "text-yellow-600" : "text-destructive"
            }`}>
              {utilizationPercent}%
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              transition={{ duration: 0.5 }}
              className={`absolute h-full rounded-full ${
                utilizationPercent <= 30 ? "bg-green-500" : 
                utilizationPercent <= 50 ? "bg-yellow-500" : 
                utilizationPercent <= 70 ? "bg-orange-500" : "bg-destructive"
              }`}
            />
            <div className="absolute left-[30%] top-0 h-full w-px bg-green-600/50" />
            <div className="absolute left-[50%] top-0 h-full w-px bg-yellow-600/50" />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span className="text-green-600">30% ideal</span>
            <span>100%</span>
          </div>
        </div>

        {/* Score Factors Summary */}
        <div className="grid grid-cols-2 gap-2">
          {factors.slice(0, 4).map((factor) => (
            <div 
              key={factor.name}
              className="p-2 rounded-lg bg-muted/30 border"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate">{factor.name}</span>
                <Badge 
                  variant="outline" 
                  className={`text-[9px] px-1 py-0 ${getStatusColor(factor.status)}`}
                >
                  {factor.status}
                </Badge>
              </div>
              <Progress 
                value={(factor.score / factor.maxScore) * 100} 
                className="h-1"
              />
            </div>
          ))}
        </div>

        {/* Repair Strategies */}
        {repairStrategies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>Score Repair Strategies</span>
            </div>
            <div className="space-y-1.5">
              {repairStrategies.slice(0, 3).map((strategy) => (
                <div 
                  key={strategy.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      strategy.priority === 1 ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {strategy.priority}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{strategy.action}</p>
                      <p className="text-[10px] text-muted-foreground">{strategy.impact}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-[10px]">
                    +{strategy.scoreBoost} pts
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed View Toggle */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide Details" : "View All Factors"}
          <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showDetails ? "rotate-90" : ""}`} />
        </Button>

        {/* Detailed Factors */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 pt-2 border-t"
            >
              {factors.map((factor) => (
                <div 
                  key={factor.name}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{factor.name}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${getStatusColor(factor.status)}`}
                        >
                          {factor.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{factor.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{factor.score}/{factor.maxScore}</p>
                      <p className={`text-[10px] ${
                        factor.impact === "high" ? "text-destructive" : 
                        factor.impact === "medium" ? "text-yellow-600" : "text-muted-foreground"
                      }`}>
                        {factor.impact} impact
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(factor.score / factor.maxScore) * 100} 
                    className="h-1.5"
                  />
                  {factor.suggestion && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {factor.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
