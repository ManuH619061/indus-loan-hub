import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/currency";
import { Wallet, CheckCircle2, Clock } from "lucide-react";

interface LoanOverviewCardProps {
  loans: any[];
}

export default function LoanOverviewCard({ loans }: LoanOverviewCardProps) {
  // Calculate total outstanding balance across all active loans
  const totalOutstanding = loans
    .filter(loan => loan.status === 'ACTIVE')
    .reduce((sum, loan) => sum + (loan.outstanding || 0), 0);

  // Calculate paid and remaining EMIs
  const stats = loans.reduce((acc, loan) => {
    const amortRows = loan.amortization_rows || [];
    const paid = amortRows.filter((row: any) => row.is_paid).length;
    const total = amortRows.length;
    
    return {
      paidEMIs: acc.paidEMIs + paid,
      totalEMIs: acc.totalEMIs + total
    };
  }, { paidEMIs: 0, totalEMIs: 0 });

  const remainingEMIs = stats.totalEMIs - stats.paidEMIs;
  const progressPercentage = stats.totalEMIs > 0 
    ? (stats.paidEMIs / stats.totalEMIs) * 100 
    : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Loan Portfolio Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold">{formatINR(totalOutstanding)}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Paid EMIs
            </p>
            <p className="text-2xl font-bold text-success">{stats.paidEMIs}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-warning" />
              Remaining EMIs
            </p>
            <p className="text-2xl font-bold text-warning">{remainingEMIs}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progressPercentage.toFixed(1)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stats.paidEMIs} of {stats.totalEMIs} EMIs paid</span>
            <span>{remainingEMIs} remaining</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
