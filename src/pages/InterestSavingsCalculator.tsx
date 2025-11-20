import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, TrendingDown, Calendar, DollarSign, Sparkles } from 'lucide-react';
import { formatINR, formatINRDetailed } from '@/lib/currency';
import { generateComparisonScenarios, calculateLumpSumPrepayment, SavingsScenario } from '@/lib/savings-calculator';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Loan {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  rate_type: 'REDUCING' | 'FLAT';
  status: string;
  lender?: {
    name: string;
  };
}

export default function InterestSavingsCalculator() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [customExtraPayment, setCustomExtraPayment] = useState<number>(5000);
  const [lumpSumAmount, setLumpSumAmount] = useState<number>(50000);
  const [scenarios, setScenarios] = useState<SavingsScenario[]>([]);
  const [lumpSumScenario, setLumpSumScenario] = useState<SavingsScenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('loans')
        .select('*, lender:lenders(name)')
        .eq('user_id', user.user.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
      if (data && data.length > 0) {
        setSelectedLoanId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLoanId && loans.length > 0) {
      calculateScenarios();
    }
  }, [selectedLoanId, loans]);

  const calculateScenarios = () => {
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;

    const scenarios = generateComparisonScenarios(
      loan.principal_amount,
      loan.interest_rate_apy,
      loan.tenure_months,
      loan.rate_type
    );

    setScenarios(scenarios);
  };

  const calculateCustomScenario = () => {
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;

    const scenarios = generateComparisonScenarios(
      loan.principal_amount,
      loan.interest_rate_apy,
      loan.tenure_months,
      loan.rate_type
    );

    setScenarios(scenarios);
  };

  const calculateLumpSum = () => {
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;

    const scenario = calculateLumpSumPrepayment(
      loan.principal_amount,
      loan.interest_rate_apy,
      loan.tenure_months,
      lumpSumAmount,
      loan.rate_type
    );

    setLumpSumScenario(scenario);
  };

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-1/3"></div>
          <div className="h-64 bg-secondary rounded"></div>
        </div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No active loans found. Add a loan to see savings calculations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const baseline = scenarios[0];
  const chartData = scenarios.map(s => ({
    name: s.scenarioName,
    interest: s.totalInterestPaid,
    saved: s.interestSaved,
    tenure: s.newTenureMonths,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Interest Savings Calculator</h1>
          <p className="text-muted-foreground">See how extra payments can save you money and time</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Loan</CardTitle>
          <CardDescription>Choose a loan to analyze prepayment strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loans.map(loan => (
                <SelectItem key={loan.id} value={loan.id}>
                  {loan.loan_name} - {formatINR(loan.principal_amount)} @ {loan.interest_rate_apy}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedLoan && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Principal</div>
                  <div className="text-2xl font-bold">{formatINR(selectedLoan.principal_amount)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Interest Rate</div>
                  <div className="text-2xl font-bold">{selectedLoan.interest_rate_apy}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Tenure</div>
                  <div className="text-2xl font-bold">{selectedLoan.tenure_months} months</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Rate Type</div>
                  <div className="text-2xl font-bold">{selectedLoan.rate_type}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {scenarios.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Baseline Interest</CardTitle>
                <DollarSign className="ml-auto h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatINR(baseline.totalInterestPaid)}</div>
                <p className="text-xs text-muted-foreground">Without any extra payments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Max Potential Savings</CardTitle>
                <TrendingDown className="ml-auto h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatINR(Math.max(...scenarios.map(s => s.interestSaved)))}
                </div>
                <p className="text-xs text-muted-foreground">With ₹15,000 extra/month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Max Tenure Reduction</CardTitle>
                <Calendar className="ml-auto h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.max(...scenarios.map(s => s.tenureReduced))} months
                </div>
                <p className="text-xs text-muted-foreground">Close your loan faster</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Interest Comparison</CardTitle>
              <CardDescription>Total interest paid across different scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatINR(value)} />
                  <Legend />
                  <Bar dataKey="interest" name="Total Interest" fill="hsl(var(--destructive))" />
                  <Bar dataKey="saved" name="Interest Saved" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenure Reduction</CardTitle>
              <CardDescription>How extra payments reduce loan duration</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis label={{ value: 'Months', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="tenure" name="Tenure (months)" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of all scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Scenario</th>
                      <th className="text-right py-3 px-4">Total Interest</th>
                      <th className="text-right py-3 px-4">Interest Saved</th>
                      <th className="text-right py-3 px-4">New Tenure</th>
                      <th className="text-right py-3 px-4">Tenure Reduced</th>
                      <th className="text-right py-3 px-4">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-3 px-4 font-medium">{scenario.scenarioName}</td>
                        <td className="text-right py-3 px-4">{formatINR(scenario.totalInterestPaid)}</td>
                        <td className="text-right py-3 px-4 text-green-600">
                          {scenario.interestSaved > 0 ? `+${formatINR(scenario.interestSaved)}` : '-'}
                        </td>
                        <td className="text-right py-3 px-4">{scenario.newTenureMonths} months</td>
                        <td className="text-right py-3 px-4 text-blue-600">
                          {scenario.tenureReduced > 0 ? `-${scenario.tenureReduced} months` : '-'}
                        </td>
                        <td className="text-right py-3 px-4">{formatINR(scenario.totalAmountPaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lump Sum Prepayment</CardTitle>
              <CardDescription>Calculate savings from a one-time prepayment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="lumpsum">Prepayment Amount</Label>
                <Input
                  id="lumpsum"
                  type="number"
                  value={lumpSumAmount}
                  onChange={(e) => setLumpSumAmount(Number(e.target.value))}
                  min={0}
                  step={10000}
                />
              </div>
              <Button onClick={calculateLumpSum}>
                <Sparkles className="mr-2 h-4 w-4" />
                Calculate Impact
              </Button>

              {lumpSumScenario && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">Interest Saved</div>
                      <div className="text-2xl font-bold text-green-600">
                        {formatINR(lumpSumScenario.interestSaved)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">New Total Interest</div>
                      <div className="text-2xl font-bold">
                        {formatINR(lumpSumScenario.totalInterestPaid)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">Total Amount Paid</div>
                      <div className="text-2xl font-bold">
                        {formatINR(lumpSumScenario.totalAmountPaid)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
