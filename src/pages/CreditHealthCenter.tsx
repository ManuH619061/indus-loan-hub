import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Target,
  Calendar,
  CreditCard,
  Wallet,
  Clock,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface CreditFactor {
  name: string;
  score: number;
  weight: number;
  status: "good" | "average" | "poor";
  description: string;
  icon: typeof CreditCard;
}

export default function CreditHealthCenter() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("simulator");
  const [loanData, setLoanData] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  
  // Improvement toggles
  const [improvements, setImprovements] = useState({
    payOverdue: false,
    closeHighInterest: false,
    noNewLoans: false,
    reduceSpending: false,
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loansRes, profileRes] = await Promise.all([
        supabase
          .from("loans")
          .select("*, amortization_rows(*)")
          .eq("user_id", user.id)
          .eq("status", "ACTIVE"),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),
      ]);

      if (loansRes.data) setLoanData(loansRes.data);
      if (profileRes.data) setProfile(profileRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const creditFactors = useMemo<CreditFactor[]>(() => {
    const today = new Date();
    
    // Calculate payment history score
    let onTimePayments = 0;
    let latePayments = 0;
    loanData.forEach((loan) => {
      loan.amortization_rows?.forEach((row: any) => {
        if (row.is_paid) {
          const dueDate = new Date(row.due_on);
          if (dueDate >= today) {
            onTimePayments++;
          } else {
            latePayments++;
          }
        }
      });
    });
    const paymentHistoryScore = onTimePayments + latePayments > 0
      ? Math.round((onTimePayments / (onTimePayments + latePayments)) * 100)
      : 100;

    // Calculate EMI burden
    const monthlyIncome = profile?.monthly_income || 100000;
    const totalMonthlyEMI = loanData.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
    const emiBurdenPercent = (totalMonthlyEMI / monthlyIncome) * 100;
    const emiBurdenScore = Math.max(0, 100 - emiBurdenPercent * 2);

    // Credit mix
    const loanTypes = new Set(loanData.map((l) => l.loan_type));
    const creditMixScore = Math.min(100, loanTypes.size * 25 + 25);

    // Account age
    const oldestLoan = loanData.reduce((oldest, loan) => {
      const disbursed = new Date(loan.disbursed_on);
      return !oldest || disbursed < oldest ? disbursed : oldest;
    }, null as Date | null);
    const accountAgeMonths = oldestLoan
      ? Math.floor((today.getTime() - oldestLoan.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;
    const accountAgeScore = Math.min(100, accountAgeMonths * 2);

    // Recent activity
    const recentLoans = loanData.filter((l) => {
      const disbursed = new Date(l.disbursed_on);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return disbursed > threeMonthsAgo;
    });
    const activityScore = recentLoans.length === 0 ? 100 : Math.max(40, 100 - recentLoans.length * 20);

    return [
      {
        name: "Payment History",
        score: paymentHistoryScore,
        weight: 35,
        status: paymentHistoryScore >= 90 ? "good" : paymentHistoryScore >= 70 ? "average" : "poor",
        description: "Track record of on-time payments",
        icon: Clock,
      },
      {
        name: "EMI Burden",
        score: Math.round(emiBurdenScore),
        weight: 30,
        status: emiBurdenScore >= 70 ? "good" : emiBurdenScore >= 40 ? "average" : "poor",
        description: `${emiBurdenPercent.toFixed(0)}% of income goes to EMIs`,
        icon: Wallet,
      },
      {
        name: "Credit Mix",
        score: creditMixScore,
        weight: 15,
        status: creditMixScore >= 75 ? "good" : creditMixScore >= 50 ? "average" : "poor",
        description: `${loanTypes.size} different loan types`,
        icon: CreditCard,
      },
      {
        name: "Account Age",
        score: accountAgeScore,
        weight: 10,
        status: accountAgeScore >= 70 ? "good" : accountAgeScore >= 40 ? "average" : "poor",
        description: `${accountAgeMonths} months credit history`,
        icon: Calendar,
      },
      {
        name: "Recent Activity",
        score: activityScore,
        weight: 10,
        status: activityScore >= 80 ? "good" : activityScore >= 50 ? "average" : "poor",
        description: `${recentLoans.length} new loans in 3 months`,
        icon: Zap,
      },
    ];
  }, [loanData, profile]);

  const estimatedScore = useMemo(() => {
    const baseScore = creditFactors.reduce(
      (sum, factor) => sum + (factor.score * factor.weight) / 100,
      0
    );
    
    // Apply improvements
    let bonus = 0;
    if (improvements.payOverdue) bonus += 30;
    if (improvements.closeHighInterest) bonus += 20;
    if (improvements.noNewLoans) bonus += 15;
    if (improvements.reduceSpending) bonus += 10;
    
    return Math.min(850, Math.round(300 + (baseScore * 5.5) + bonus));
  }, [creditFactors, improvements]);

  const scoreCategory = useMemo(() => {
    if (estimatedScore >= 750) return { label: "Excellent", color: "text-green-500", bg: "bg-green-500" };
    if (estimatedScore >= 700) return { label: "Good", color: "text-blue-500", bg: "bg-blue-500" };
    if (estimatedScore >= 650) return { label: "Fair", color: "text-amber-500", bg: "bg-amber-500" };
    if (estimatedScore >= 550) return { label: "Poor", color: "text-orange-500", bg: "bg-orange-500" };
    return { label: "Very Poor", color: "text-red-500", bg: "bg-red-500" };
  }, [estimatedScore]);

  const projectionData = useMemo(() => {
    const currentScore = estimatedScore;
    const improvementPerMonth = improvements.payOverdue ? 15 : improvements.closeHighInterest ? 10 : improvements.noNewLoans ? 8 : 5;
    
    return [
      { month: "Today", score: currentScore },
      { month: "30 days", score: Math.min(850, currentScore + improvementPerMonth) },
      { month: "60 days", score: Math.min(850, currentScore + improvementPerMonth * 1.8) },
      { month: "90 days", score: Math.min(850, currentScore + improvementPerMonth * 2.5) },
    ];
  }, [estimatedScore, improvements]);

  const strengths = useMemo(() => creditFactors.filter((f) => f.status === "good"), [creditFactors]);
  const weaknesses = useMemo(() => creditFactors.filter((f) => f.status === "poor" || f.status === "average"), [creditFactors]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl text-white">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Credit Health Center</h1>
            <p className="text-muted-foreground text-sm">
              Understand and improve your credit profile
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-10 p-1 w-max min-w-full md:w-auto">
              <TabsTrigger value="simulator" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Score Simulator
              </TabsTrigger>
              <TabsTrigger value="report" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Health Report
              </TabsTrigger>
              <TabsTrigger value="improvement" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Improvement Plan
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="md:hidden" />
          </ScrollArea>

          {/* Score Simulator Tab */}
          <TabsContent value="simulator" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score Meter */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Estimated Credit Score
                  </CardTitle>
                  <CardDescription>Based on your loan portfolio analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center py-6">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative"
                    >
                      <div className={cn(
                        "text-6xl md:text-7xl font-bold",
                        scoreCategory.color
                      )}>
                        {estimatedScore}
                      </div>
                      <Badge className={cn("absolute -top-2 -right-4", scoreCategory.bg)}>
                        {scoreCategory.label}
                      </Badge>
                    </motion.div>
                    <div className="mt-6 w-full max-w-xs">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>300</span>
                        <span>550</span>
                        <span>700</span>
                        <span>850</span>
                      </div>
                      <div className="h-3 bg-gradient-to-r from-red-500 via-amber-500 to-green-500 rounded-full relative">
                        <motion.div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-foreground rounded-full shadow-lg"
                          initial={{ left: "0%" }}
                          animate={{ left: `${((estimatedScore - 300) / 550) * 100}%` }}
                          transition={{ type: "spring", stiffness: 100 }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Factors */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Factors</CardTitle>
                  <CardDescription>Components affecting your score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {creditFactors.map((factor) => {
                    const Icon = factor.icon;
                    return (
                      <div key={factor.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{factor.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {factor.weight}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{factor.score}</span>
                            {factor.status === "good" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {factor.status === "average" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                            {factor.status === "poor" && <XCircle className="h-4 w-4 text-red-500" />}
                          </div>
                        </div>
                        <Progress
                          value={factor.score}
                          className={cn(
                            "h-2",
                            factor.status === "good" && "[&>div]:bg-green-500",
                            factor.status === "average" && "[&>div]:bg-amber-500",
                            factor.status === "poor" && "[&>div]:bg-red-500"
                          )}
                        />
                        <p className="text-xs text-muted-foreground">{factor.description}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Health Report Tab */}
          <TabsContent value="report" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Strengths */}
              <Card className="border-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {strengths.length > 0 ? (
                    strengths.map((factor) => (
                      <div key={factor.name} className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{factor.name}</p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Focus on improving your credit factors
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Weaknesses */}
              <Card className="border-amber-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <TrendingDown className="h-5 w-5" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {weaknesses.length > 0 ? (
                    weaknesses.map((factor) => (
                      <div key={factor.name} className="flex items-start gap-3 p-3 bg-amber-500/5 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{factor.name}</p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Great job! All factors are in good standing
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Eligibility Advice */}
            <Card>
              <CardHeader>
                <CardTitle>Eligibility Insights</CardTitle>
                <CardDescription>Based on your current credit profile</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">Refinancing Potential</p>
                  <Badge className={estimatedScore >= 700 ? "bg-green-500" : "bg-amber-500"}>
                    {estimatedScore >= 700 ? "High" : estimatedScore >= 600 ? "Medium" : "Low"}
                  </Badge>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">Consolidation Eligibility</p>
                  <Badge className={loanData.length > 2 && estimatedScore >= 650 ? "bg-green-500" : "bg-muted"}>
                    {loanData.length > 2 && estimatedScore >= 650 ? "Eligible" : "Not Recommended"}
                  </Badge>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">New Credit Approval</p>
                  <Badge className={estimatedScore >= 700 ? "bg-green-500" : estimatedScore >= 600 ? "bg-amber-500" : "bg-red-500"}>
                    {estimatedScore >= 700 ? "Likely" : estimatedScore >= 600 ? "Possible" : "Unlikely"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Improvement Plan Tab */}
          <TabsContent value="improvement" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Interactive Toggles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Improvement Actions
                  </CardTitle>
                  <CardDescription>Toggle actions to see score impact</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "payOverdue", label: "Pay All Overdue EMIs", impact: "+30 pts", description: "Clear all pending payments" },
                    { key: "closeHighInterest", label: "Close Highest Interest Loan", impact: "+20 pts", description: "Reduce debt burden" },
                    { key: "noNewLoans", label: "No New Loans for 60 Days", impact: "+15 pts", description: "Stabilize credit inquiries" },
                    { key: "reduceSpending", label: "Reduce Non-Essential Spending", impact: "+10 pts", description: "Improve savings capacity" },
                  ].map((action) => (
                    <div
                      key={action.key}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-colors",
                        improvements[action.key as keyof typeof improvements]
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{action.label}</p>
                          <Badge variant="secondary" className="text-xs">{action.impact}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                      <Switch
                        checked={improvements[action.key as keyof typeof improvements]}
                        onCheckedChange={(checked) =>
                          setImprovements((prev) => ({ ...prev, [action.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Score Projection Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Score Projection</CardTitle>
                  <CardDescription>Estimated improvement over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectionData}>
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          domain={[300, 850]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#scoreGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-primary/5 rounded-lg flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <p className="text-sm">
                      Following these actions could improve your score by{" "}
                      <span className="font-bold text-primary">
                        +{projectionData[projectionData.length - 1].score - projectionData[0].score} points
                      </span>{" "}
                      in 90 days.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}