import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingDown, 
  Calculator, 
  Clock, 
  Wallet,
  ChevronRight,
  Zap,
  Target
} from "lucide-react";
import { formatINR } from "@/lib/currency";
import { 
  calculateAvalanche, 
  calculateSnowball,
  type LoanForOptimization 
} from "@/lib/debt-optimizer";
import { calculateOutstandingFromAmortization, type LoanWithAmortization } from "@/lib/portfolio-stats";
import { cn } from "@/lib/utils";

interface PrepaymentImpactCardProps {
  loans: LoanWithAmortization[];
}

export function PrepaymentImpactCard({ loans }: PrepaymentImpactCardProps) {
  const navigate = useNavigate();
  const [extraPayment, setExtraPayment] = useState(5000);

  // Convert loans to optimization format
  const loansForOptimization = useMemo((): LoanForOptimization[] => {
    return loans
      .filter(l => l.status === 'ACTIVE')
      .map(loan => {
        const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
        // Get EMI from first unpaid amortization row
        const unpaidRows = (loan.amortization_rows || []).filter(r => !r.is_paid);
        const emiAmount = unpaidRows.length > 0 ? unpaidRows[0].scheduled_emi : 0;
        
        return {
          id: loan.id,
          loan_name: loan.loan_name,
          outstanding: outstanding.total,
          interest_rate_apy: loan.interest_rate_apy,
          emi_amount: emiAmount,
          rate_type: 'REDUCING' as const, // Default to reducing, most common
          tenure_months: loan.tenure_months,
        };
      })
      .filter(l => l.outstanding > 0 && l.emi_amount > 0);
  }, [loans]);

  // Calculate scenarios
  const analysis = useMemo(() => {
    if (loansForOptimization.length === 0) return null;

    // No extra payment scenario (baseline)
    const baseline = calculateAvalanche(loansForOptimization, 0);
    
    // With extra payment scenarios
    const withExtra = calculateAvalanche(loansForOptimization, extraPayment);
    const snowball = calculateSnowball(loansForOptimization, extraPayment);

    // Calculate total remaining interest without prepayment
    let totalRemainingInterest = 0;
    loansForOptimization.forEach(loan => {
      const monthlyRate = loan.interest_rate_apy / 100 / 12;
      const remainingMonths = Math.ceil(loan.outstanding / loan.emi_amount);
      for (let i = 0; i < remainingMonths; i++) {
        const balance = loan.outstanding - (loan.emi_amount - (loan.outstanding * monthlyRate)) * i;
        if (balance > 0) {
          totalRemainingInterest += balance * monthlyRate;
        }
      }
    });

    const monthsSaved = baseline.totalMonths - withExtra.totalMonths;
    const interestSaved = baseline.totalInterestPaid - withExtra.totalInterestPaid;
    const avalancheVsSnowball = snowball.totalInterestPaid - withExtra.totalInterestPaid;

    // Find the highest impact loan (highest interest rate with significant balance)
    const highImpactLoan = loansForOptimization.reduce((best, loan) => {
      const impactScore = loan.interest_rate_apy * loan.outstanding;
      const bestScore = best.interest_rate_apy * best.outstanding;
      return impactScore > bestScore ? loan : best;
    }, loansForOptimization[0]);

    return {
      baseline,
      withExtra,
      snowball,
      monthsSaved,
      interestSaved,
      avalancheVsSnowball,
      highImpactLoan,
      totalOutstanding: loansForOptimization.reduce((s, l) => s + l.outstanding, 0),
      totalEMI: loansForOptimization.reduce((s, l) => s + l.emi_amount, 0),
    };
  }, [loansForOptimization, extraPayment]);

  if (!analysis || loansForOptimization.length === 0) {
    return (
      <Card className="p-6 border-border/50 bg-card">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            Prepayment Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active loans to analyze</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-border/50 bg-card">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                <Calculator className="h-4 w-4 text-primary" />
              </div>
              Prepayment Impact Analysis
            </CardTitle>
            <CardDescription>See how extra payments reduce interest and time</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/budget/debt-payoff')}
            className="text-xs"
          >
            Full Calculator
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-5">
        {/* Extra Payment Slider */}
        <div className="p-4 rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Extra Monthly Payment</span>
            <Badge variant="secondary" className="font-mono text-base px-3 py-1">
              {formatINR(extraPayment)}
            </Badge>
          </div>
          <Slider
            value={[extraPayment]}
            onValueChange={(v) => setExtraPayment(v[0])}
            min={1000}
            max={Math.max(50000, analysis.totalEMI)}
            step={1000}
            className="my-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>₹1,000</span>
            <span>{formatINR(Math.max(50000, analysis.totalEMI))}</span>
          </div>
        </div>

        {/* Impact Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-success/10 dark:bg-success/20 border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Interest Saved</span>
            </div>
            <p className="text-lg font-bold text-success">{formatINR(analysis.interestSaved)}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Time Saved</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {analysis.monthsSaved} {analysis.monthsSaved === 1 ? 'month' : 'months'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Debt-Free In</span>
            </div>
            <p className="text-lg font-bold">{analysis.withExtra.totalMonths} months</p>
            <p className="text-xs text-muted-foreground">vs {analysis.baseline.totalMonths}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Interest</span>
            </div>
            <p className="text-lg font-bold">{formatINR(analysis.withExtra.totalInterestPaid)}</p>
            <p className="text-xs text-muted-foreground">vs {formatINR(analysis.baseline.totalInterestPaid)}</p>
          </div>
        </div>

        {/* Payoff Progress Comparison */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Payoff Timeline Comparison</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Without Extra Payment</span>
              <span className="font-mono">{analysis.baseline.totalMonths} months</span>
            </div>
            <Progress value={100} className="h-2 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                With {formatINR(extraPayment)}/month
                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-success">
                  -{Math.round((analysis.monthsSaved / analysis.baseline.totalMonths) * 100)}%
                </Badge>
              </span>
              <span className="font-mono font-semibold text-success">{analysis.withExtra.totalMonths} months</span>
            </div>
            <Progress 
              value={(analysis.withExtra.totalMonths / analysis.baseline.totalMonths) * 100} 
              className="h-2"
            />
          </div>
        </div>

        {/* High Impact Loan Recommendation */}
        {analysis.highImpactLoan && (
          <div className="p-4 rounded-lg bg-warning/10 dark:bg-warning/20 border border-warning/20">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Highest Impact Prepayment Target</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Focus extra payments on this loan for maximum interest savings
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{analysis.highImpactLoan.loan_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.highImpactLoan.interest_rate_apy}% APR • {formatINR(analysis.highImpactLoan.outstanding)} outstanding
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/loans/${analysis.highImpactLoan.id}`)}
                  >
                    View
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Comparison */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div 
            className={cn(
              "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
              "bg-muted/20 border-border/30"
            )}
            onClick={() => navigate('/budget/debt-payoff?strategy=avalanche')}
          >
            <p className="text-sm font-semibold mb-1">Avalanche Strategy</p>
            <p className="text-xs text-muted-foreground mb-2">Highest interest first</p>
            <p className="text-lg font-bold">{formatINR(analysis.withExtra.totalInterestPaid)}</p>
            <p className="text-xs text-success">in total interest</p>
          </div>
          <div 
            className={cn(
              "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
              "bg-muted/20 border-border/30"
            )}
            onClick={() => navigate('/budget/debt-payoff?strategy=snowball')}
          >
            <p className="text-sm font-semibold mb-1">Snowball Strategy</p>
            <p className="text-xs text-muted-foreground mb-2">Smallest balance first</p>
            <p className="text-lg font-bold">{formatINR(analysis.snowball.totalInterestPaid)}</p>
            <p className="text-xs text-muted-foreground">in total interest</p>
          </div>
        </div>

        {analysis.avalancheVsSnowball < 0 && (
          <p className="text-xs text-center text-success">
            Avalanche saves {formatINR(Math.abs(analysis.avalancheVsSnowball))} more than Snowball
          </p>
        )}
      </CardContent>
    </Card>
  );
}