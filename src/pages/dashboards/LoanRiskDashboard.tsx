import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Download,
  TrendingUp,
  Shield,
  AlertCircle,
  ChevronRight,
  Flame,
  Target,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from "framer-motion";
import {
  fetchLoansWithAmortization,
  calculateThisMonthEMI,
  calculateOutstandingFromAmortization,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";

interface LoanRisk {
  id: string;
  name: string;
  outstanding: number;
  interestRate: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  emiToIncomeRatio: number;
  monthlyEMI: number;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const RISK_BG: Record<RiskLevel, string> = {
  low: 'bg-green-500/10 text-green-600 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function LoanRiskDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loanRisks, setLoanRisks] = useState<LoanRisk[]>([]);
  const [stats, setStats] = useState({
    overallRisk: 'low' as RiskLevel,
    overallScore: 0,
    emiToIncomeRatio: 0,
    highInterestCount: 0,
    highInterestAmount: 0,
    monthlyIncome: 0,
    totalEMI: 0,
    debtStressIndex: 0,
  });
  const [riskDistribution, setRiskDistribution] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const loansData = await fetchLoansWithAmortization(user.id);

      // Fetch income
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user.id)
        .single();

      const monthlyIncome = profile?.monthly_income || 0;
      const emiData = calculateThisMonthEMI(loansData);
      const totalEMI = emiData.total;

      // Calculate risk for each loan
      const risks: LoanRisk[] = loansData
        .filter(l => l.status === 'ACTIVE')
        .map(loan => {
          const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
          const monthlyEMI = (loan as any).emi_amount || 0;
          const emiToIncome = monthlyIncome > 0 ? (monthlyEMI / monthlyIncome) * 100 : 0;
          
          // Calculate risk score (0-100)
          let riskScore = 0;
          
          // Interest rate component (0-30)
          if (loan.interest_rate_apy >= 40) riskScore += 30;
          else if (loan.interest_rate_apy >= 30) riskScore += 25;
          else if (loan.interest_rate_apy >= 20) riskScore += 15;
          else riskScore += 5;

          // EMI to income component (0-40)
          if (emiToIncome >= 30) riskScore += 40;
          else if (emiToIncome >= 20) riskScore += 25;
          else if (emiToIncome >= 10) riskScore += 15;
          else riskScore += 5;

          // Outstanding amount component (0-30)
          if (outstanding.total >= 1000000) riskScore += 30;
          else if (outstanding.total >= 500000) riskScore += 20;
          else if (outstanding.total >= 100000) riskScore += 10;
          else riskScore += 5;

          const riskLevel: RiskLevel = 
            riskScore >= 80 ? 'critical' :
            riskScore >= 60 ? 'high' :
            riskScore >= 40 ? 'medium' : 'low';

          return {
            id: loan.id,
            name: loan.loan_name,
            outstanding: outstanding.total,
            interestRate: loan.interest_rate_apy,
            riskScore,
            riskLevel,
            emiToIncomeRatio: emiToIncome,
            monthlyEMI,
          };
        })
        .sort((a, b) => b.riskScore - a.riskScore);

      setLoanRisks(risks);

      // Calculate overall stats
      const avgRiskScore = risks.length > 0 
        ? risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length 
        : 0;

      const overallRisk: RiskLevel = 
        avgRiskScore >= 80 ? 'critical' :
        avgRiskScore >= 60 ? 'high' :
        avgRiskScore >= 40 ? 'medium' : 'low';

      const emiToIncomeRatio = monthlyIncome > 0 ? (totalEMI / monthlyIncome) * 100 : 0;
      
      const highInterestLoans = loansData.filter(l => l.interest_rate_apy >= 30);
      const highInterestAmount = highInterestLoans.reduce((sum, l) => {
        const out = calculateOutstandingFromAmortization(l.amortization_rows || []);
        return sum + out.total;
      }, 0);

      // Debt stress index (0-100)
      let debtStressIndex = 0;
      if (emiToIncomeRatio >= 50) debtStressIndex += 50;
      else if (emiToIncomeRatio >= 30) debtStressIndex += 30;
      else debtStressIndex += emiToIncomeRatio;
      debtStressIndex += highInterestLoans.length * 10;
      debtStressIndex = Math.min(100, debtStressIndex);

      setStats({
        overallRisk,
        overallScore: avgRiskScore,
        emiToIncomeRatio,
        highInterestCount: highInterestLoans.length,
        highInterestAmount,
        monthlyIncome,
        totalEMI,
        debtStressIndex,
      });

      // Risk distribution
      const distribution = [
        { name: 'Low', value: risks.filter(r => r.riskLevel === 'low').length, color: RISK_COLORS.low },
        { name: 'Medium', value: risks.filter(r => r.riskLevel === 'medium').length, color: RISK_COLORS.medium },
        { name: 'High', value: risks.filter(r => r.riskLevel === 'high').length, color: RISK_COLORS.high },
        { name: 'Critical', value: risks.filter(r => r.riskLevel === 'critical').length, color: RISK_COLORS.critical },
      ].filter(d => d.value > 0);
      setRiskDistribution(distribution);
    } catch (error) {
      console.error("Error fetching risk data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Loan Risk Analysis</h1>
          <p className="text-muted-foreground text-sm">Assess and prioritize your debt obligations</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Overall Risk Card */}
      <Card className={cn("border-l-4", `border-l-[${RISK_COLORS[stats.overallRisk]}]`)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", RISK_BG[stats.overallRisk])}>
                <Shield className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Risk Level</p>
                <p className="text-2xl font-bold capitalize">{stats.overallRisk}</p>
                <p className="text-xs text-muted-foreground">Score: {stats.overallScore.toFixed(0)}/100</p>
              </div>
            </div>
            <Badge variant="secondary" className={RISK_BG[stats.overallRisk]}>
              {stats.overallRisk.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EMI to Income</p>
                <p className="text-lg font-bold">{stats.emiToIncomeRatio.toFixed(0)}%</p>
              </div>
            </div>
            <Progress 
              value={Math.min(100, stats.emiToIncomeRatio)} 
              className={cn("h-1 mt-2", stats.emiToIncomeRatio > 50 && "[&>div]:bg-destructive")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Debt Stress Index</p>
                <p className="text-lg font-bold">{stats.debtStressIndex.toFixed(0)}</p>
              </div>
            </div>
            <Progress 
              value={stats.debtStressIndex} 
              className={cn("h-1 mt-2", stats.debtStressIndex > 70 && "[&>div]:bg-destructive")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">High Interest Loans</p>
                <p className="text-lg font-bold">{stats.highInterestCount}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatINR(stats.highInterestAmount)} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly EMI Load</p>
                <p className="text-lg font-bold">{formatINR(stats.totalEMI)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              of {formatINR(stats.monthlyIncome)} income
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution and Priority List */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk Distribution Pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            <CardDescription>Loans by risk category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              {riskDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">No active loans</p>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {riskDistribution.map(d => (
                <div key={d.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Highest Interest Loans */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Priority Payoff List</CardTitle>
            <CardDescription>Highest risk loans first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loanRisks.slice(0, 5).map((loan, idx) => (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/loans/${loan.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white", 
                      loan.riskLevel === 'critical' ? 'bg-red-500' :
                      loan.riskLevel === 'high' ? 'bg-orange-500' :
                      loan.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                    )}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{loan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {loan.interestRate}% APY • {formatINR(loan.outstanding)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={RISK_BG[loan.riskLevel]}>
                    {loan.riskLevel}
                  </Badge>
                </motion.div>
              ))}
              {loanRisks.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No active loans</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interest Rate Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Interest Rate Comparison</CardTitle>
          <CardDescription>Compare interest rates across your loans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loanRisks.slice(0, 8)} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} width={100} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="interestRate" name="Interest Rate" radius={4}>
                  {loanRisks.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.riskLevel]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
