import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sparkles, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, formatPercent } from "@/lib/currency";
import FadeInStagger from "@/components/FadeInStagger";

interface LoanAdvice {
  category: string;
  severity: "info" | "warning" | "error" | "success";
  title: string;
  description: string;
  action?: string;
  savings?: number;
  loanName?: string;
}

export default function LoanEMIAIAdvice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<LoanAdvice[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user.id)
        .single();

      setMonthlyIncome(profile?.monthly_income || 0);

      // Fetch loans with amortization
      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          *,
          lender:lenders(name),
          amortization_rows(*)
        `)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      if (loansData) {
        const processedLoans = loansData.map((loan: any) => {
          const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
          const outstanding_principal = unpaidRows.reduce(
            (sum: number, row: any) => sum + row.principal_component,
            0
          );
          const outstanding_interest = unpaidRows.reduce(
            (sum: number, row: any) => sum + row.interest_component,
            0
          );
          return {
            ...loan,
            outstanding_principal,
            outstanding_interest,
            total_outstanding: outstanding_principal + outstanding_interest,
            months_left: unpaidRows.length,
          };
        });

        setLoans(processedLoans);
        generateAdvice(processedLoans, profile?.monthly_income || 0);
      }
    } catch (error) {
      toast.error("Failed to fetch loan data");
    } finally {
      setLoading(false);
    }
  };

  const generateAdvice = (loansData: any[], income: number) => {
    const adviceList: LoanAdvice[] = [];

    if (loansData.length === 0) {
      adviceList.push({
        category: "No Loans",
        severity: "success",
        title: "Debt-free status",
        description: "You currently have no active loans. This is great for your financial health!",
      });
      setAdvice(adviceList);
      return;
    }

    // Total EMI calculation
    const totalEMI = loansData.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
    const totalOutstanding = loansData.reduce((sum, loan) => sum + loan.total_outstanding, 0);

    // Check EMI-to-income ratio
    if (income > 0) {
      const emiRatio = (totalEMI / income) * 100;
      if (emiRatio > 50) {
        adviceList.push({
          category: "EMI Burden",
          severity: "error",
          title: "Very high EMI-to-income ratio",
          description: `Your EMIs (${formatINR(totalEMI)}) consume ${emiRatio.toFixed(1)}% of your income. This is critical and limits your financial flexibility.`,
          action: "Debt Consolidation",
        });
      } else if (emiRatio > 40) {
        adviceList.push({
          category: "EMI Burden",
          severity: "warning",
          title: "High EMI-to-income ratio",
          description: `Your EMIs take up ${emiRatio.toFixed(1)}% of your income. Consider refinancing or prepaying high-interest loans.`,
          action: "Review Repayment Strategy",
        });
      } else if (emiRatio < 30) {
        adviceList.push({
          category: "EMI Management",
          severity: "success",
          title: "Healthy EMI-to-income ratio",
          description: `Your EMI burden is ${emiRatio.toFixed(1)}%, which is within safe limits. Consider extra payments to reduce debt faster.`,
        });
      }
    }

    // Find high-interest loans
    const highInterestLoans = loansData.filter((loan) => loan.interest_rate_apy > 18);
    if (highInterestLoans.length > 0) {
      highInterestLoans.forEach((loan) => {
        const interestCost = loan.outstanding_interest;
        adviceList.push({
          category: "High Interest",
          severity: "warning",
          title: `${loan.loan_name} has high interest`,
          description: `This loan charges ${formatPercent(loan.interest_rate_apy)} interest. Prepaying this can save ${formatINR(interestCost * 0.3)} in interest.`,
          action: "Prepay Loan",
          savings: interestCost * 0.3,
          loanName: loan.loan_name,
        });
      });
    }

    // Suggest debt avalanche vs snowball
    const sortedByInterest = [...loansData].sort(
      (a, b) => b.interest_rate_apy - a.interest_rate_apy
    );
    const highestInterestLoan = sortedByInterest[0];
    if (highestInterestLoan && loansData.length > 1) {
      adviceList.push({
        category: "Repayment Strategy",
        severity: "info",
        title: "Debt Avalanche Method recommended",
        description: `Focus extra payments on "${highestInterestLoan.loan_name}" (${formatPercent(highestInterestLoan.interest_rate_apy)} interest) to minimize total interest paid.`,
        action: "Apply Debt Avalanche",
        loanName: highestInterestLoan.loan_name,
      });
    }

    // Check for loans nearing payoff
    const nearingPayoff = loansData.filter((loan) => loan.months_left <= 6);
    nearingPayoff.forEach((loan) => {
      adviceList.push({
        category: "Nearing Completion",
        severity: "success",
        title: `${loan.loan_name} almost paid off`,
        description: `Only ${loan.months_left} months left! Outstanding: ${formatINR(loan.total_outstanding)}. Consider prepaying to close it early.`,
        action: "Prepay to Close",
        loanName: loan.loan_name,
      });
    });

    // Refinancing opportunity for old loans
    const oldLoans = loansData.filter((loan) => {
      const disbursedDate = new Date(loan.disbursed_on);
      const monthsOld = Math.floor(
        (Date.now() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      return monthsOld > 24 && loan.interest_rate_apy > 12;
    });

    oldLoans.forEach((loan) => {
      adviceList.push({
        category: "Refinancing",
        severity: "info",
        title: `Consider refinancing ${loan.loan_name}`,
        description: `This loan is over 2 years old with ${formatPercent(loan.interest_rate_apy)} interest. Market rates may have improved—explore refinancing options.`,
        action: "Check Refinance Offers",
        loanName: loan.loan_name,
      });
    });

    // Prepayment suggestion based on income
    if (income > 0 && totalEMI < income * 0.4) {
      const extraCapacity = income * 0.5 - totalEMI;
      if (extraCapacity > 5000) {
        adviceList.push({
          category: "Prepayment",
          severity: "info",
          title: "You have room for extra payments",
          description: `Based on your income, you can afford ${formatINR(extraCapacity)} extra per month. Allocating this to loan prepayment can save significant interest.`,
          action: "Setup Extra EMI",
          savings: extraCapacity * 12,
        });
      }
    }

    // Multiple loans consolidation
    if (loansData.length >= 3) {
      adviceList.push({
        category: "Consolidation",
        severity: "info",
        title: "Consider loan consolidation",
        description: `You have ${loansData.length} active loans. Consolidating them into one loan can simplify management and potentially reduce interest.`,
        action: "Explore Consolidation",
      });
    }

    setAdvice(adviceList);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      default:
        return <DollarSign className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Urgent</Badge>;
      case "warning":
        return <Badge variant="secondary">Important</Badge>;
      case "success":
        return <Badge variant="default">Good</Badge>;
      default:
        return <Badge variant="outline">Suggestion</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalEMI = loans.reduce((sum, loan) => sum + (loan.emi_amount || 0), 0);
  const totalOutstanding = loans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
  const emiRatio = monthlyIncome > 0 ? (totalEMI / monthlyIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            Loan & EMI AI Advice
          </h1>
          <p className="text-muted-foreground mt-2">
            Strategic insights to optimize loan repayment and reduce debt faster
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <Sparkles className="h-4 w-4 mr-2" />
          Refresh Advice
        </Button>
      </div>

      <FadeInStagger>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loans.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total EMI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalEMI)}</div>
              <p className="text-sm text-muted-foreground mt-1">/month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalOutstanding)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>EMI/Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatPercent(emiRatio, 1)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {emiRatio > 50 ? "Critical" : emiRatio > 40 ? "High" : "Healthy"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {advice.map((item, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(item.severity)}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        {getSeverityBadge(item.severity)}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{item.category}</Badge>
                        {item.loanName && <Badge>{item.loanName}</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{item.description}</p>
                {item.savings && (
                  <div className="flex items-center gap-2 text-success">
                    <TrendingDown className="h-4 w-4" />
                    <span className="font-semibold">
                      Potential savings: {formatINR(item.savings)}
                    </span>
                  </div>
                )}
                {item.action && (
                  <Button variant="outline" size="sm">
                    {item.action}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {advice.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No loan data available to generate advice.</p>
              <p className="text-sm mt-2">Add loans to get personalized repayment strategies.</p>
            </CardContent>
          </Card>
        )}
      </FadeInStagger>
    </div>
  );
}
