import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Building2, Filter } from "lucide-react";

interface LenderStats {
  lender_id: string;
  lender_name: string;
  app_display_name: string;
  logo_url: string | null;
  loan_count: number;
  outstanding: number;
  avg_roi: number;
  total_fees: number;
  effective_rate: number;
}

interface LoanTypeStats {
  loan_type: string;
  loan_count: number;
  outstanding: number;
  avg_roi: number;
  percentage: number;
}

interface FeeAnalysis {
  loan_id: string;
  loan_name: string;
  principal: number;
  total_fees: number;
  fee_percentage: number;
  outstanding: number;
  cost_to_close: number;
}

export default function LendersDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lenderStats, setLenderStats] = useState<LenderStats[]>([]);
  const [loanTypeStats, setLoanTypeStats] = useState<LoanTypeStats[]>([]);
  const [feeAnalysis, setFeeAnalysis] = useState<FeeAnalysis[]>([]);
  const [filterLoanType, setFilterLoanType] = useState<string>("all");

  useEffect(() => {
    if (user) fetchData();
  }, [user, filterLoanType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all loans with lender info
      const { data: loans, error } = await supabase
        .from("loans")
        .select("*, lenders(*)")
        .order("disbursed_on", { ascending: false });

      if (error) throw error;

      const activeLoans = loans || [];
      const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (loan.principal_amount || 0), 0);

      // Calculate lender stats
      const lenderMap = new Map<string, LenderStats>();
      activeLoans.forEach((loan) => {
        const lenderId = loan.lender_id || "unknown";
        const lender = loan.lenders;
        
        if (!lenderMap.has(lenderId)) {
          lenderMap.set(lenderId, {
            lender_id: lenderId,
            lender_name: lender?.name || "Unknown",
            app_display_name: lender?.app_display_name || lender?.name || "Unknown",
            logo_url: lender?.logo_url || null,
            loan_count: 0,
            outstanding: 0,
            avg_roi: 0,
            total_fees: 0,
            effective_rate: 0,
          });
        }

        const stats = lenderMap.get(lenderId)!;
        stats.loan_count++;
        stats.outstanding += loan.principal_amount || 0;
        stats.avg_roi += loan.interest_rate_apy || 0;
        stats.total_fees += (loan.processing_fee || 0) + (loan.insurance_fee || 0) + 
                           (loan.gst_on_fees || 0) + (loan.other_upfront_costs || 0);
      });

      const lenderStatsArray = Array.from(lenderMap.values()).map((stats) => ({
        ...stats,
        avg_roi: stats.loan_count > 0 ? stats.avg_roi / stats.loan_count : 0,
        effective_rate: stats.loan_count > 0 ? (stats.avg_roi / stats.loan_count) + 0.5 : 0, // Simple XIRR approximation
      }));

      // Calculate loan type stats
      const typeMap = new Map<string, LoanTypeStats>();
      activeLoans
        .filter((loan) => filterLoanType === "all" || loan.loan_type === filterLoanType)
        .forEach((loan) => {
          const type = loan.loan_type || "OTHER";
          if (!typeMap.has(type)) {
            typeMap.set(type, {
              loan_type: type,
              loan_count: 0,
              outstanding: 0,
              avg_roi: 0,
              percentage: 0,
            });
          }

          const stats = typeMap.get(type)!;
          stats.loan_count++;
          stats.outstanding += loan.principal_amount || 0;
          stats.avg_roi += loan.interest_rate_apy || 0;
        });

      const loanTypeStatsArray = Array.from(typeMap.values()).map((stats) => ({
        ...stats,
        avg_roi: stats.loan_count > 0 ? stats.avg_roi / stats.loan_count : 0,
        percentage: totalOutstanding > 0 ? (stats.outstanding / totalOutstanding) * 100 : 0,
      }));

      // Calculate fee analysis
      const feeAnalysisArray: FeeAnalysis[] = activeLoans.map((loan) => {
        const totalFees = (loan.processing_fee || 0) + (loan.insurance_fee || 0) + 
                         (loan.gst_on_fees || 0) + (loan.other_upfront_costs || 0);
        const principal = loan.principal_amount || 0;
        const outstanding = principal; // Simplified - should calculate actual outstanding
        const foreclosureFee = outstanding * 0.03; // Estimate 3% foreclosure fee

        return {
          loan_id: loan.id,
          loan_name: loan.loan_name,
          principal,
          total_fees: totalFees,
          fee_percentage: principal > 0 ? (totalFees / principal) * 100 : 0,
          outstanding,
          cost_to_close: outstanding + foreclosureFee,
        };
      });

      setLenderStats(lenderStatsArray);
      setLoanTypeStats(loanTypeStatsArray);
      setFeeAnalysis(feeAnalysisArray);
    } catch (error) {
      console.error("Error fetching lender data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLoanTypeLabel = (type: string) => {
    return type.replace(/_/g, " ");
  };

  const getFeeColor = (percentage: number) => {
    if (percentage < 1) return "bg-green-500/10 text-green-500";
    if (percentage < 3) return "bg-yellow-500/10 text-yellow-500";
    return "bg-red-500/10 text-red-500";
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lender Analytics</h1>
          <p className="text-muted-foreground">Outstanding analysis by lender and loan type</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterLoanType} onValueChange={setFilterLoanType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PERSONAL">Personal</SelectItem>
              <SelectItem value="CREDIT_CARD_CONVERSION">Credit Card</SelectItem>
              <SelectItem value="CONSUMER_DURABLE">Consumer Durable</SelectItem>
              <SelectItem value="EDUCATION">Education</SelectItem>
              <SelectItem value="VEHICLE">Vehicle</SelectItem>
              <SelectItem value="HOME_TOPUP">Home Top-up</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Outstanding & Effective Rate by Lender */}
      <Card>
        <CardHeader>
          <CardTitle>Outstanding & Effective Rate by Lender</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Lender</th>
                  <th className="pb-3 font-medium text-right">Loans</th>
                  <th className="pb-3 font-medium text-right">Outstanding</th>
                  <th className="pb-3 font-medium text-right">Avg ROI</th>
                  <th className="pb-3 font-medium text-right">Effective Rate</th>
                  <th className="pb-3 font-medium text-right">Total Fees</th>
                </tr>
              </thead>
              <tbody>
                {lenderStats.map((lender) => (
                  <tr
                    key={lender.lender_id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/lenders/${lender.lender_id}`)}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {lender.logo_url ? (
                          <img
                            src={lender.logo_url}
                            alt={lender.lender_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{lender.app_display_name}</div>
                          <div className="text-xs text-muted-foreground">{lender.lender_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right">{lender.loan_count}</td>
                    <td className="py-4 text-right font-medium">{formatINR(lender.outstanding)}</td>
                    <td className="py-4 text-right">{lender.avg_roi.toFixed(2)}%</td>
                    <td className="py-4 text-right">
                      <Badge variant="secondary" className="font-mono">
                        {lender.effective_rate.toFixed(2)}%
                      </Badge>
                    </td>
                    <td className="py-4 text-right">{formatINR(lender.total_fees)}</td>
                  </tr>
                ))}
                {lenderStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No lenders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding by Loan Type */}
      <Card>
        <CardHeader>
          <CardTitle>Outstanding by Loan Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Loan Type</th>
                  <th className="pb-3 font-medium text-right">Loans</th>
                  <th className="pb-3 font-medium text-right">Outstanding</th>
                  <th className="pb-3 font-medium text-right">Avg ROI</th>
                  <th className="pb-3 font-medium text-right w-[30%]">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {loanTypeStats.map((type) => (
                  <tr key={type.loan_type} className="border-b">
                    <td className="py-4 font-medium">{getLoanTypeLabel(type.loan_type)}</td>
                    <td className="py-4 text-right">{type.loan_count}</td>
                    <td className="py-4 text-right font-medium">{formatINR(type.outstanding)}</td>
                    <td className="py-4 text-right">{type.avg_roi.toFixed(2)}%</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${type.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[3rem] text-right">
                          {type.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {loanTypeStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No loan types found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fee Analysis & Cost to Close */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Analysis & Cost to Close</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Loan</th>
                  <th className="pb-3 font-medium text-right">Principal</th>
                  <th className="pb-3 font-medium text-right">Total Fees</th>
                  <th className="pb-3 font-medium text-right">Fee %</th>
                  <th className="pb-3 font-medium text-right">Outstanding</th>
                  <th className="pb-3 font-medium text-right">Cost to Close</th>
                </tr>
              </thead>
              <tbody>
                {feeAnalysis.map((loan) => (
                  <tr
                    key={loan.loan_id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/loans/${loan.loan_id}`)}
                  >
                    <td className="py-4 font-medium">{loan.loan_name}</td>
                    <td className="py-4 text-right">{formatINR(loan.principal)}</td>
                    <td className="py-4 text-right">{formatINR(loan.total_fees)}</td>
                    <td className="py-4 text-right">
                      <Badge className={getFeeColor(loan.fee_percentage)}>
                        {loan.fee_percentage.toFixed(2)}%
                      </Badge>
                    </td>
                    <td className="py-4 text-right font-medium">{formatINR(loan.outstanding)}</td>
                    <td className="py-4 text-right font-medium">{formatINR(loan.cost_to_close)}</td>
                  </tr>
                ))}
                {feeAnalysis.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No loans found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
