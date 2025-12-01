import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import FadeInStagger from "@/components/FadeInStagger";
import { formatINR, formatPercent } from "@/lib/currency";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface LoanWithDetails {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  emi_amount: number;
  status: string;
  disbursed_on: string;
  lender_id: string;
  lender?: {
    id: string;
    name: string;
    type: string;
    logo_url: string | null;
  };
  outstanding_principal: number;
  outstanding_interest: number;
  total_outstanding: number;
  months_left: number;
  total_interest_cost: number;
  payoff_date: string;
  emi_to_income: number;
  risk_level: "Low" | "Medium" | "High";
}

interface LenderSummary {
  lender_id: string;
  lender_name: string;
  lender_type: string;
  logo_url: string | null;
  total_loans: number;
  total_outstanding: number;
  avg_interest: number;
  total_emi: number;
  total_principal: number;
  risk_level: "Low" | "Medium" | "High";
}

export default function LoanComparison() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanWithDetails[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [view, setView] = useState<"loans" | "lenders">("loans");

  // Filters
  const [selectedLender, setSelectedLender] = useState<string>("all");
  const [minInterest, setMinInterest] = useState<string>("");
  const [maxInterest, setMaxInterest] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user profile for income
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income")
        .eq("id", user.id)
        .single();

      setMonthlyIncome(profile?.monthly_income || 0);

      // Fetch lenders
      const { data: lendersData } = await supabase
        .from("lenders")
        .select("*")
        .eq("user_id", user.id);

      setLenders(lendersData || []);

      // Fetch loans with amortization
      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          *,
          lender:lenders(id, name, type, logo_url),
          amortization_rows(*)
        `)
        .eq("user_id", user.id);

      if (loansData) {
        const processedLoans = loansData.map((loan: any) => {
          const unpaidRows = loan.amortization_rows?.filter((row: any) => !row.is_paid) || [];
          const allRows = loan.amortization_rows || [];

          const outstanding_principal = unpaidRows.reduce(
            (sum: number, row: any) => sum + row.principal_component,
            0
          );
          const outstanding_interest = unpaidRows.reduce(
            (sum: number, row: any) => sum + row.interest_component,
            0
          );
          const total_interest_cost = allRows.reduce(
            (sum: number, row: any) => sum + row.interest_component,
            0
          );

          const months_left = unpaidRows.length;
          const lastRow = unpaidRows[unpaidRows.length - 1];
          const payoff_date = lastRow?.due_on || loan.disbursed_on;

          const emi_to_income = monthlyIncome > 0 ? ((loan.emi_amount || 0) / monthlyIncome) * 100 : 0;

          let risk_level: "Low" | "Medium" | "High" = "Low";
          if (loan.interest_rate_apy > 20 || emi_to_income > 40) {
            risk_level = "High";
          } else if (loan.interest_rate_apy > 15 || emi_to_income > 30) {
            risk_level = "Medium";
          }

          return {
            ...loan,
            outstanding_principal,
            outstanding_interest,
            total_outstanding: outstanding_principal + outstanding_interest,
            months_left,
            total_interest_cost,
            payoff_date,
            emi_to_income,
            risk_level,
          };
        });

        setLoans(processedLoans);
      }
    } catch (error) {
      toast.error("Failed to fetch loan data");
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = useMemo(() => {
    let filtered = [...loans];

    if (selectedLender !== "all") {
      filtered = filtered.filter((loan) => loan.lender_id === selectedLender);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((loan) => loan.status === statusFilter);
    }

    if (minInterest) {
      filtered = filtered.filter((loan) => loan.interest_rate_apy >= parseFloat(minInterest));
    }

    if (maxInterest) {
      filtered = filtered.filter((loan) => loan.interest_rate_apy <= parseFloat(maxInterest));
    }

    return filtered.sort((a, b) => b.total_outstanding - a.total_outstanding);
  }, [loans, selectedLender, statusFilter, minInterest, maxInterest]);

  const lenderSummaries = useMemo(() => {
    const summaryMap: Record<string, LenderSummary> = {};

    filteredLoans.forEach((loan) => {
      const lenderId = loan.lender_id;
      if (!summaryMap[lenderId]) {
        summaryMap[lenderId] = {
          lender_id: lenderId,
          lender_name: loan.lender?.name || "Unknown",
          lender_type: loan.lender?.type || "OTHER",
          logo_url: loan.lender?.logo_url || null,
          total_loans: 0,
          total_outstanding: 0,
          avg_interest: 0,
          total_emi: 0,
          total_principal: 0,
          risk_level: "Low",
        };
      }

      const summary = summaryMap[lenderId];
      summary.total_loans += 1;
      summary.total_outstanding += loan.total_outstanding;
      summary.total_emi += loan.emi_amount || 0;
      summary.total_principal += loan.principal_amount;
    });

    // Calculate averages and risk
    Object.values(summaryMap).forEach((summary) => {
      const lenderLoans = filteredLoans.filter((l) => l.lender_id === summary.lender_id);
      summary.avg_interest =
        lenderLoans.reduce((sum, l) => sum + l.interest_rate_apy, 0) / lenderLoans.length;

      const emi_to_income = monthlyIncome > 0 ? (summary.total_emi / monthlyIncome) * 100 : 0;
      if (summary.avg_interest > 20 || emi_to_income > 40) {
        summary.risk_level = "High";
      } else if (summary.avg_interest > 15 || emi_to_income > 30) {
        summary.risk_level = "Medium";
      }
    });

    return Object.values(summaryMap).sort((a, b) => b.total_outstanding - a.total_outstanding);
  }, [filteredLoans, monthlyIncome]);

  const getRiskBadge = (risk: string) => {
    const variants = {
      Low: "default",
      Medium: "secondary",
      High: "destructive",
    };
    return (
      <Badge variant={variants[risk as keyof typeof variants] as any}>
        {risk === "High" && <AlertTriangle className="h-3 w-3 mr-1" />}
        {risk}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Loan & Lender Comparison</h1>
        <p className="text-muted-foreground mt-2">
          Advanced comparison of your loans and lenders with detailed metrics
        </p>
      </div>

      <FadeInStagger>
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="lender">Lender</Label>
                <Select value={selectedLender} onValueChange={setSelectedLender}>
                  <SelectTrigger id="lender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lenders</SelectItem>
                    {lenders.map((lender) => (
                      <SelectItem key={lender.id} value={lender.id}>
                        {lender.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minInterest">Min Interest (%)</Label>
                <Input
                  id="minInterest"
                  type="number"
                  placeholder="0"
                  value={minInterest}
                  onChange={(e) => setMinInterest(e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxInterest">Max Interest (%)</Label>
                <Input
                  id="maxInterest"
                  type="number"
                  placeholder="50"
                  value={maxInterest}
                  onChange={(e) => setMaxInterest(e.target.value)}
                  step="0.1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredLoans.length} of {loans.length} loans
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedLender("all");
                setStatusFilter("all");
                setMinInterest("");
                setMaxInterest("");
              }}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="loans">Loans View</TabsTrigger>
            <TabsTrigger value="lenders">Lenders View</TabsTrigger>
          </TabsList>

          <TabsContent value="loans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Individual Loan Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead>Lender</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">EMI</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Months Left</TableHead>
                        <TableHead className="text-right">Total Interest</TableHead>
                        <TableHead>Payoff Date</TableHead>
                        <TableHead className="text-right">EMI/Income</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">{loan.loan_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {loan.lender?.logo_url ? (
                                <img
                                  src={loan.lender.logo_url}
                                  alt={loan.lender.name}
                                  className="w-6 h-6 rounded object-contain"
                                />
                              ) : null}
                              {loan.lender?.name || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatINR(loan.principal_amount)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatINR(loan.total_outstanding)}
                          </TableCell>
                          <TableCell className="text-right">{formatINR(loan.emi_amount || 0)}</TableCell>
                          <TableCell className="text-right">{formatPercent(loan.interest_rate_apy)}</TableCell>
                          <TableCell className="text-right">{loan.months_left}</TableCell>
                          <TableCell className="text-right text-destructive">
                            {formatINR(loan.total_interest_cost)}
                          </TableCell>
                          <TableCell>
                            {new Date(loan.payoff_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(loan.emi_to_income, 1)}
                          </TableCell>
                          <TableCell>{getRiskBadge(loan.risk_level)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredLoans.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No loans found matching the filters
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lenders" className="space-y-4">
            <div className="grid gap-4">
              {lenderSummaries.map((summary) => (
                <Card key={summary.lender_id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {summary.logo_url ? (
                          <img
                            src={summary.logo_url}
                            alt={summary.lender_name}
                            className="w-12 h-12 rounded-lg object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold">
                            {summary.lender_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-xl">{summary.lender_name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {summary.lender_type}
                          </Badge>
                        </div>
                      </div>
                      {getRiskBadge(summary.risk_level)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Loans</div>
                        <div className="text-2xl font-bold">{summary.total_loans}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Outstanding</div>
                        <div className="text-2xl font-bold">{formatINR(summary.total_outstanding)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total EMI</div>
                        <div className="text-2xl font-bold">{formatINR(summary.total_emi)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Interest</div>
                        <div className="text-2xl font-bold">{formatPercent(summary.avg_interest)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Principal</div>
                        <div className="text-2xl font-bold">{formatINR(summary.total_principal)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">EMI/Income</div>
                        <div className="text-2xl font-bold">
                          {formatPercent(monthlyIncome > 0 ? (summary.total_emi / monthlyIncome) * 100 : 0, 1)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {lenderSummaries.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No lenders found matching the filters
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </FadeInStagger>
    </div>
  );
}
