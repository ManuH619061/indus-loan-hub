import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/currency";
import { TrendingDown, Calculator, AlertCircle } from "lucide-react";

interface LoanItem {
  id: string;
  name: string;
  lender: string;
  outstanding: number;
  emi: number;
  interestRate: number;
  remainingMonths: number;
  dueDate?: string;
}

interface LoanSelectionPanelProps {
  loans: LoanItem[];
}

export function LoanSelectionPanel({ loans }: LoanSelectionPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleLoan = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const calculations = useMemo(() => {
    const selected = loans.filter(l => selectedIds.has(l.id));
    const totalPayoff = selected.reduce((sum, l) => sum + l.outstanding, 0);
    const emiReduction = selected.reduce((sum, l) => sum + l.emi, 0);
    const currentTotalEMI = loans.reduce((sum, l) => sum + l.emi, 0);
    const newTotalEMI = currentTotalEMI - emiReduction;
    
    // Estimate interest savings (simplified: remaining months * monthly interest)
    const interestSaved = selected.reduce((sum, l) => {
      const monthlyInterest = l.outstanding * (l.interestRate / 100 / 12);
      return sum + (monthlyInterest * l.remainingMonths * 0.5); // Approximate
    }, 0);

    return { totalPayoff, emiReduction, currentTotalEMI, newTotalEMI, interestSaved, selectedCount: selected.length };
  }, [loans, selectedIds]);

  const getPriorityBadge = (loan: LoanItem) => {
    if (loan.interestRate >= 15) {
      return <Badge variant="destructive" className="text-xs">High Interest</Badge>;
    }
    if (loan.remainingMonths <= 3) {
      return <Badge className="bg-amber-500 text-white text-xs">Due Soon</Badge>;
    }
    if (loan.remainingMonths <= 6) {
      return <Badge variant="secondary" className="text-xs">Closing Soon</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Safe</Badge>;
  };

  if (loans.length === 0) return null;

  return (
    <div className="my-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Calculator className="h-4 w-4 text-primary" />
        <span>Interactive Loan Payoff Planner</span>
      </div>

      {/* Summary Cards */}
      {calculations.selectedCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-primary/5 border-primary/20">
            <div className="text-xs text-muted-foreground">Selected Payoff</div>
            <div className="text-lg font-bold text-primary">{formatINR(calculations.totalPayoff)}</div>
          </Card>
          <Card className="p-3 bg-emerald-500/10 border-emerald-500/20">
            <div className="text-xs text-muted-foreground">EMI Reduction</div>
            <div className="text-lg font-bold text-emerald-600">{formatINR(calculations.emiReduction)}/mo</div>
          </Card>
          <Card className="p-3 bg-muted">
            <div className="text-xs text-muted-foreground">New Monthly EMI</div>
            <div className="text-lg font-bold">{formatINR(calculations.newTotalEMI)}</div>
          </Card>
          <Card className="p-3 bg-amber-500/10 border-amber-500/20">
            <div className="text-xs text-muted-foreground">Interest Saved (Est.)</div>
            <div className="text-lg font-bold text-amber-600">~{formatINR(calculations.interestSaved)}</div>
          </Card>
        </div>
      )}

      {/* Loan Selection Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-foreground">Select</th>
                <th className="px-3 py-2.5 text-left font-semibold text-foreground">Loan / Lender</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">Outstanding</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">EMI</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">Rate</th>
                <th className="px-3 py-2.5 text-center font-semibold text-foreground">Months Left</th>
                <th className="px-3 py-2.5 text-center font-semibold text-foreground">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loans.map((loan, idx) => (
                <tr 
                  key={loan.id} 
                  className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-muted/50 transition-colors cursor-pointer`}
                  onClick={() => toggleLoan(loan.id)}
                >
                  <td className="px-3 py-2.5">
                    <Checkbox 
                      checked={selectedIds.has(loan.id)}
                      onCheckedChange={() => toggleLoan(loan.id)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{loan.name}</div>
                    <div className="text-xs text-muted-foreground">{loan.lender}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatINR(loan.outstanding)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(loan.emi)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{loan.interestRate.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-center">{loan.remainingMonths}</td>
                  <td className="px-3 py-2.5 text-center">{getPriorityBadge(loan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Explanation */}
      {calculations.selectedCount > 0 && (
        <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-3">
            <TrendingDown className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <strong>If you pay off {calculations.selectedCount} selected loan{calculations.selectedCount > 1 ? 's' : ''}:</strong>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Total one-time payment needed: <strong className="text-foreground">{formatINR(calculations.totalPayoff)}</strong></li>
                <li>• Your monthly EMI reduces from {formatINR(calculations.currentTotalEMI)} to <strong className="text-emerald-600">{formatINR(calculations.newTotalEMI)}</strong></li>
                <li>• Estimated interest savings: <strong className="text-amber-600">~{formatINR(calculations.interestSaved)}</strong></li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        <span>This is for planning only. No changes will be made to your actual loans.</span>
      </div>
    </div>
  );
}
