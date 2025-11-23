import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { 
  compareStrategies, 
  type LoanForOptimization, 
  type PayoffStrategy 
} from "@/lib/debt-optimizer";
import { 
  TrendingDown, 
  Zap, 
  Target, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  ArrowRight,
  Loader2,
  Sliders,
  Play,
  RefreshCw,
  Save,
  Bookmark,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function DebtPayoffCalculator() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanForOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [extraPayment, setExtraPayment] = useState(5000);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [scenarioPayment, setScenarioPayment] = useState(5000);
  const [compareScenarios, setCompareScenarios] = useState(false);
  const [scenario2Payment, setScenario2Payment] = useState(10000);
  
  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [savingScenario, setSavingScenario] = useState(false);

  useEffect(() => {
    fetchLoans();
    fetchSavedScenarios();
  }, []);

  // Auto-calculate in What-If mode
  useEffect(() => {
    if (loans.length > 0 && whatIfMode) {
      setScenarioPayment(extraPayment);
    }
  }, [whatIfMode, loans, extraPayment]);

  const fetchSavedScenarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('goal_type', 'debt_payoff_scenario')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedScenarios(data || []);
    } catch (error) {
      console.error('Error fetching saved scenarios:', error);
    }
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this scenario",
        variant: "destructive"
      });
      return;
    }

    setSavingScenario(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const scenarioData = {
        name: scenarioName,
        scenarioPayment,
        compareScenarios,
        scenario2Payment: compareScenarios ? scenario2Payment : null,
        savedAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          goal_type: 'debt_payoff_scenario',
          monthly_extra_payment: scenarioPayment,
          notes: JSON.stringify(scenarioData)
        });

      if (error) throw error;

      toast({
        title: "Scenario saved",
        description: `"${scenarioName}" has been saved successfully`
      });

      setScenarioName("");
      setSaveDialogOpen(false);
      fetchSavedScenarios();
    } catch (error) {
      console.error('Error saving scenario:', error);
      toast({
        title: "Error",
        description: "Failed to save scenario",
        variant: "destructive"
      });
    } finally {
      setSavingScenario(false);
    }
  };

  const handleLoadScenario = (scenario: any) => {
    try {
      const data = JSON.parse(scenario.notes);
      setScenarioPayment(data.scenarioPayment);
      setCompareScenarios(data.compareScenarios || false);
      if (data.scenario2Payment) {
        setScenario2Payment(data.scenario2Payment);
      }
      setWhatIfMode(true);
      
      toast({
        title: "Scenario loaded",
        description: `"${data.name}" has been loaded`
      });
    } catch (error) {
      console.error('Error loading scenario:', error);
      toast({
        title: "Error",
        description: "Failed to load scenario",
        variant: "destructive"
      });
    }
  };

  const handleDeleteScenario = async (scenarioId: string, scenarioName: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', scenarioId);

      if (error) throw error;

      toast({
        title: "Scenario deleted",
        description: `"${scenarioName}" has been removed`
      });

      fetchSavedScenarios();
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast({
        title: "Error",
        description: "Failed to delete scenario",
        variant: "destructive"
      });
    }
  };

  const fetchLoans = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch active loans with their amortization data
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*, amortization_rows(closing_principal, is_paid, period_no)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('interest_rate_apy', { ascending: false });

      if (loansError) throw loansError;

      // Calculate outstanding balance for each loan
      const loansWithOutstanding = loansData.map(loan => {
        const unpaidRows = (loan.amortization_rows || [])
          .filter((row: any) => !row.is_paid)
          .sort((a: any, b: any) => a.period_no - b.period_no);
        
        const outstanding = unpaidRows.length > 0 
          ? unpaidRows[0].closing_principal || loan.principal_amount
          : 0;

        return {
          id: loan.id,
          loan_name: loan.loan_name,
          outstanding,
          interest_rate_apy: loan.interest_rate_apy,
          emi_amount: loan.emi_amount || 0,
          rate_type: loan.rate_type as 'REDUCING' | 'FLAT',
          tenure_months: loan.tenure_months,
        };
      }).filter(loan => loan.outstanding > 0);

      setLoans(loansWithOutstanding);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      toast({
        title: "Error loading loans",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoized results for real-time calculation
  const results = useMemo(() => {
    if (loans.length === 0) return null;
    if (whatIfMode) {
      return compareStrategies(loans, scenarioPayment);
    }
    return null;
  }, [loans, scenarioPayment, whatIfMode]);

  const scenario2Results = useMemo(() => {
    if (loans.length === 0 || !compareScenarios) return null;
    return compareStrategies(loans, scenario2Payment);
  }, [loans, scenario2Payment, compareScenarios]);

  const handleActivateWhatIf = () => {
    if (loans.length === 0) {
      toast({
        title: "No active loans",
        description: "Add some active loans to use the debt payoff calculator",
        variant: "destructive",
      });
      return;
    }
    setWhatIfMode(true);
    setScenarioPayment(extraPayment);
  };

  const handleResetScenarios = () => {
    setScenarioPayment(5000);
    setScenario2Payment(10000);
    setCompareScenarios(false);
  };

  const renderStrategyCard = (strategy: PayoffStrategy, icon: any, color: string) => {
    const Icon = icon;
    const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
    const interestSavedVsMinimum = results 
      ? results.minPaymentOnly.totalInterestPaid - strategy.totalInterestPaid
      : 0;

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${color}`} />
              <CardTitle className="text-lg">{strategy.name}</CardTitle>
            </div>
            {results?.insights && (
              <>
                {results.insights.bestForSavings === strategy.name.split(' ')[1] && (
                  <Badge variant="default" className="bg-success">Best Savings</Badge>
                )}
                {results.insights.bestForSpeed === strategy.name.split(' ')[1] && (
                  <Badge variant="default" className="bg-primary">Fastest</Badge>
                )}
              </>
            )}
          </div>
          <CardDescription>{strategy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Debt-Free Date
              </p>
              <p className="font-semibold text-success">{strategy.debtFreeDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Time to Payoff
              </p>
              <p className="font-semibold">{strategy.totalMonths} months</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Total Interest
              </p>
              <p className="font-semibold text-destructive">{formatINR(strategy.totalInterestPaid)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Total Paid
              </p>
              <p className="font-semibold">{formatINR(strategy.totalAmountPaid)}</p>
            </div>
          </div>
          
          {interestSavedVsMinimum > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-success">
                💰 Save {formatINR(interestSavedVsMinimum)} vs minimum payments
              </p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Payoff Progress</p>
            <Progress value={0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">Start paying to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPayoffScheduleTable = (strategy: PayoffStrategy) => {
    // Show first 12 months
    const displayMonths = strategy.monthlySchedule.slice(0, 12);

    return (
      <div className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Payment</TableHead>
                <TableHead className="text-right">Interest Paid</TableHead>
                <TableHead className="text-right">Remaining Debt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMonths.map((month) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">{month.month}</TableCell>
                  <TableCell>{new Date(month.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(month.totalPayment)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatINR(month.totalInterest)}</TableCell>
                  <TableCell className="text-right">{formatINR(month.remainingDebt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {strategy.monthlySchedule.length > 12 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing first 12 months of {strategy.totalMonths} total months
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
  const totalMinEMI = loans.reduce((sum, l) => sum + l.emi_amount, 0);
  const avgInterestRate = loans.length > 0 
    ? loans.reduce((sum, l) => sum + l.interest_rate_apy, 0) / loans.length 
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Debt Payoff Calculator</h1>
        <p className="text-muted-foreground">
          Compare snowball vs avalanche strategies to find the fastest path to debt freedom
        </p>
      </div>

      {loans.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No active loans found</AlertTitle>
          <AlertDescription>
            Add some active loans to start optimizing your debt payoff strategy.
          </AlertDescription>
        </Alert>
          ) : (
            <>
              {savedScenarios.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-5 w-5 text-primary" />
                      <CardTitle>Saved Scenarios</CardTitle>
                    </div>
                    <CardDescription>
                      Load previously saved what-if scenarios to compare strategies
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {savedScenarios.map((scenario) => {
                        const data = JSON.parse(scenario.notes);
                        return (
                          <Card key={scenario.id} className="relative">
                            <CardContent className="pt-6">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold">{data.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Saved {new Date(data.savedAt).toLocaleDateString('en-IN')}
                                  </p>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Extra Payment:</span>
                                    <span className="font-medium">{formatINR(data.scenarioPayment)}</span>
                                  </div>
                                  {data.compareScenarios && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Scenario 2:</span>
                                      <span className="font-medium">{formatINR(data.scenario2Payment)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 gap-1"
                                    onClick={() => handleLoadScenario(scenario)}
                                  >
                                    <Play className="h-3 w-3" />
                                    Load
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteScenario(scenario.id, data.name)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding Debt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(totalDebt)}</p>
                <p className="text-xs text-muted-foreground mt-1">{loans.length} active loans</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly EMI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatINR(totalMinEMI)}</p>
                <p className="text-xs text-muted-foreground mt-1">Minimum payment</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Interest Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{avgInterestRate.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
              </CardContent>
            </Card>
          </div>

          {!whatIfMode ? (
            <Card>
              <CardHeader>
                <CardTitle>Configure Extra Payment</CardTitle>
                <CardDescription>
                  How much extra can you pay each month towards debt?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="extraPayment">Extra Monthly Payment</Label>
                    <Input
                      id="extraPayment"
                      type="number"
                      value={extraPayment}
                      onChange={(e) => setExtraPayment(Number(e.target.value))}
                      min={0}
                      step={1000}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleActivateWhatIf} className="gap-2">
                    <Play className="h-4 w-4" />
                    Start What-If Scenarios
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <p>Total monthly payment: {formatINR(totalMinEMI + extraPayment)}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary" />
                    <CardTitle>What-If Scenarios</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="default" 
                          size="sm"
                          className="gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Save Scenario
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save What-If Scenario</DialogTitle>
                          <DialogDescription>
                            Give this scenario a name to track and compare different payoff strategies over time
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="scenario-name">Scenario Name</Label>
                            <Input
                              id="scenario-name"
                              placeholder="e.g., Aggressive Payoff Plan"
                              value={scenarioName}
                              onChange={(e) => setScenarioName(e.target.value)}
                            />
                          </div>
                          <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Extra Payment:</span>
                              <span className="font-medium">{formatINR(scenarioPayment)}</span>
                            </div>
                            {compareScenarios && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Scenario 2 Payment:</span>
                                <span className="font-medium">{formatINR(scenario2Payment)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => setSaveDialogOpen(false)}
                            disabled={savingScenario}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSaveScenario}
                            disabled={savingScenario || !scenarioName.trim()}
                          >
                            {savingScenario ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Scenario
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetScenarios}
                      className="gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reset
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setWhatIfMode(false)}
                    >
                      Exit
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Adjust the slider to see real-time changes in your debt payoff strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Scenario 1: Extra Monthly Payment</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">{formatINR(scenarioPayment)}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                  </div>
                  <Slider
                    value={[scenarioPayment]}
                    onValueChange={(value) => setScenarioPayment(value[0])}
                    min={0}
                    max={50000}
                    step={500}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>₹0</span>
                    <span>₹25,000</span>
                    <span>₹50,000</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <p>Total monthly payment: {formatINR(totalMinEMI + scenarioPayment)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch
                    id="compare-mode"
                    checked={compareScenarios}
                    onCheckedChange={setCompareScenarios}
                  />
                  <Label htmlFor="compare-mode" className="cursor-pointer">
                    Compare with second scenario
                  </Label>
                </div>

                {compareScenarios && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Scenario 2: Alternative Payment</Label>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-success">{formatINR(scenario2Payment)}</span>
                        <span className="text-sm text-muted-foreground">/month</span>
                      </div>
                    </div>
                    <Slider
                      value={[scenario2Payment]}
                      onValueChange={(value) => setScenario2Payment(value[0])}
                      min={0}
                      max={50000}
                      step={500}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>₹0</span>
                      <span>₹25,000</span>
                      <span>₹50,000</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <p>Total monthly payment: {formatINR(totalMinEMI + scenario2Payment)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {results && (
            <>
              {compareScenarios && scenario2Results && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRight className="h-5 w-5" />
                      Scenario Comparison
                    </CardTitle>
                    <CardDescription>
                      Compare the impact of different extra payment amounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 p-4 rounded-lg border-2 border-primary bg-background">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">Scenario 1</h3>
                          <Badge variant="outline" className="text-primary border-primary">
                            {formatINR(scenarioPayment)}/mo
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Debt-Free (Avalanche):</span>
                            <span className="font-semibold">{results.avalanche.totalMonths} months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Interest:</span>
                            <span className="font-semibold text-destructive">{formatINR(results.avalanche.totalInterestPaid)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Savings vs Min:</span>
                            <span className="font-semibold text-success">
                              {formatINR(results.minPaymentOnly.totalInterestPaid - results.avalanche.totalInterestPaid)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 p-4 rounded-lg border-2 border-success bg-background">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">Scenario 2</h3>
                          <Badge variant="outline" className="text-success border-success">
                            {formatINR(scenario2Payment)}/mo
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Debt-Free (Avalanche):</span>
                            <span className="font-semibold">{scenario2Results.avalanche.totalMonths} months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Interest:</span>
                            <span className="font-semibold text-destructive">{formatINR(scenario2Results.avalanche.totalInterestPaid)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Savings vs Min:</span>
                            <span className="font-semibold text-success">
                              {formatINR(scenario2Results.minPaymentOnly.totalInterestPaid - scenario2Results.avalanche.totalInterestPaid)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Difference</AlertTitle>
                      <AlertDescription className="space-y-1 mt-2">
                        <p>
                          • Scenario 2 saves an additional{' '}
                          <strong className="text-success">
                            {formatINR(results.avalanche.totalInterestPaid - scenario2Results.avalanche.totalInterestPaid)}
                          </strong>{' '}
                          in interest
                        </p>
                        <p>
                          • Scenario 2 makes you debt-free{' '}
                          <strong className="text-primary">
                            {results.avalanche.totalMonths - scenario2Results.avalanche.totalMonths} months
                          </strong>{' '}
                          faster
                        </p>
                        <p>
                          • Extra monthly investment: {formatINR(scenario2Payment - scenarioPayment)}
                        </p>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {renderStrategyCard(results.avalanche, TrendingDown, "text-success")}
                {renderStrategyCard(results.snowball, Target, "text-primary")}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" />
                    Strategy Comparison
                  </CardTitle>
                  <CardDescription>
                    Side-by-side comparison of debt payoff strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Key Insights</AlertTitle>
                    <AlertDescription className="space-y-2 mt-2">
                      <p>
                        • <strong>{results.insights.bestForSavings === 'Avalanche' ? 'Avalanche' : 'Snowball'}</strong> saves you{' '}
                        <strong className="text-success">{formatINR(results.insights.savingsDifference)}</strong> more in interest
                      </p>
                      <p>
                        • <strong>{results.insights.bestForSpeed === 'Avalanche' ? 'Avalanche' : 'Snowball'}</strong> makes you debt-free{' '}
                        <strong className="text-primary">{results.insights.timeDifference} months</strong> faster
                      </p>
                      <p>
                        • With <strong>{formatINR(scenarioPayment)}/month</strong> extra payment, you'll save{' '}
                        <strong className="text-success">
                          {formatINR(results.minPaymentOnly.totalInterestPaid - results.avalanche.totalInterestPaid)}
                        </strong>{' '}
                        vs minimum payments
                      </p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Visual Charts Section */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Interest Comparison Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Total Interest Comparison</CardTitle>
                    <CardDescription>Compare interest paid across strategies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: 'Minimum Only',
                            interest: results.minPaymentOnly.totalInterestPaid,
                            months: results.minPaymentOnly.totalMonths,
                          },
                          {
                            name: 'Avalanche',
                            interest: results.avalanche.totalInterestPaid,
                            months: results.avalanche.totalMonths,
                          },
                          {
                            name: 'Snowball',
                            interest: results.snowball.totalInterestPaid,
                            months: results.snowball.totalMonths,
                          },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis 
                          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                          className="text-xs"
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const savingsVsMin = results.minPaymentOnly.totalInterestPaid - (data.interest as number);
                              return (
                                <div className="rounded-lg border bg-background p-4 shadow-xl min-w-[250px]">
                                  <p className="font-bold text-lg mb-2">{data.name}</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-sm text-muted-foreground">Total Interest:</span>
                                      <span className="text-sm font-semibold text-destructive">
                                        {formatINR(data.interest)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-sm text-muted-foreground">Duration:</span>
                                      <span className="text-sm font-semibold">
                                        {data.months} months ({(data.months / 12).toFixed(1)} years)
                                      </span>
                                    </div>
                                    {savingsVsMin > 0 && (
                                      <div className="flex justify-between gap-4 pt-2 border-t mt-2">
                                        <span className="text-sm text-success">Savings vs Minimum:</span>
                                        <span className="text-sm font-bold text-success">
                                          {formatINR(savingsVsMin)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="interest" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Payoff Timeline Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payoff Timeline</CardTitle>
                    <CardDescription>Months to become debt-free</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: 'Minimum Only',
                            months: results.minPaymentOnly.totalMonths,
                            years: (results.minPaymentOnly.totalMonths / 12).toFixed(1),
                          },
                          {
                            name: 'Avalanche',
                            months: results.avalanche.totalMonths,
                            years: (results.avalanche.totalMonths / 12).toFixed(1),
                          },
                          {
                            name: 'Snowball',
                            months: results.snowball.totalMonths,
                            years: (results.snowball.totalMonths / 12).toFixed(1),
                          },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis 
                          label={{ value: 'Months', angle: -90, position: 'insideLeft' }}
                          className="text-xs"
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const monthsSaved = results.minPaymentOnly.totalMonths - (data.months as number);
                              return (
                                <div className="rounded-lg border bg-background p-4 shadow-xl min-w-[250px]">
                                  <p className="font-bold text-lg mb-2">{data.name}</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-sm text-muted-foreground">Payoff Time:</span>
                                      <span className="text-sm font-semibold text-primary">
                                        {data.months} months
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-sm text-muted-foreground">In Years:</span>
                                      <span className="text-sm font-semibold">
                                        {data.years} years
                                      </span>
                                    </div>
                                    {monthsSaved > 0 && (
                                      <div className="flex justify-between gap-4 pt-2 border-t mt-2">
                                        <span className="text-sm text-success">Time Saved:</span>
                                        <span className="text-sm font-bold text-success">
                                          {monthsSaved} months
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="months" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Debt Paydown Timeline Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Debt Paydown Timeline</CardTitle>
                  <CardDescription>
                    Track how your total debt decreases over time with each strategy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart
                      data={(() => {
                        const maxMonths = Math.max(
                          results.avalanche.totalMonths,
                          results.snowball.totalMonths,
                          Math.min(results.minPaymentOnly.totalMonths, 120) // Cap minimum at 120 months for display
                        );
                        
                        return Array.from({ length: maxMonths }, (_, i) => {
                          const month = i + 1;
                          const avalancheData = results.avalanche.monthlySchedule[i];
                          const snowballData = results.snowball.monthlySchedule[i];
                          const minData = results.minPaymentOnly.monthlySchedule[i];
                          
                          return {
                            month,
                            avalanche: avalancheData?.remainingDebt || 0,
                            snowball: snowballData?.remainingDebt || 0,
                            minimum: minData?.remainingDebt || 0,
                          };
                        });
                      })()}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorAvalanche" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorSnowball" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorMinimum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                        label={{ value: 'Remaining Debt', angle: -90, position: 'insideLeft' }}
                        className="text-xs"
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const monthNum = payload[0].payload.month;
                            const avalancheData = results.avalanche.monthlySchedule[monthNum - 1];
                            const snowballData = results.snowball.monthlySchedule[monthNum - 1];
                            const minData = results.minPaymentOnly.monthlySchedule[monthNum - 1];
                            
                            return (
                              <div className="rounded-lg border bg-background p-4 shadow-xl min-w-[300px]">
                                <div className="border-b pb-2 mb-2">
                                  <p className="font-bold text-lg">Month {monthNum}</p>
                                  {avalancheData && (
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(avalancheData.date).toLocaleDateString('en-IN', { 
                                        month: 'short', 
                                        year: 'numeric' 
                                      })}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  {payload.map((entry: any, index: number) => {
                                    const isAvalanche = entry.dataKey === 'avalanche';
                                    const isSnowball = entry.dataKey === 'snowball';
                                    const monthData = isAvalanche ? avalancheData : isSnowball ? snowballData : minData;
                                    
                                    return entry.value > 0 ? (
                                      <div key={index} className="space-y-1">
                                        <p className="text-sm font-semibold" style={{ color: entry.color }}>
                                          {entry.name}
                                        </p>
                                        <div className="pl-2 space-y-0.5 text-xs">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Remaining:</span>
                                            <span className="font-medium">{formatINR(entry.value)}</span>
                                          </div>
                                          {monthData && (
                                            <>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Payment:</span>
                                                <span className="font-medium">{formatINR(monthData.totalPayment)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Interest:</span>
                                                <span className="text-destructive">{formatINR(monthData.totalInterest)}</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="minimum"
                        name="Minimum Payment"
                        stroke="hsl(var(--muted-foreground))"
                        fill="url(#colorMinimum)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="snowball"
                        name="Snowball"
                        stroke="hsl(var(--primary))"
                        fill="url(#colorSnowball)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="avalanche"
                        name="Avalanche"
                        stroke="hsl(var(--success))"
                        fill="url(#colorAvalanche)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Individual Loan Balance Progression */}
              <Card>
                <CardHeader>
                  <CardTitle>Individual Loan Progression (Avalanche)</CardTitle>
                  <CardDescription>
                    See how each loan balance decreases over time with the avalanche strategy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={(() => {
                        const colors = [
                          'hsl(var(--chart-1))',
                          'hsl(var(--chart-2))',
                          'hsl(var(--chart-3))',
                          'hsl(var(--chart-4))',
                          'hsl(var(--chart-5))',
                        ];
                        
                        return results.avalanche.monthlySchedule.map((monthData, idx) => {
                          const dataPoint: any = { month: monthData.month };
                          monthData.loans.forEach((loan, loanIdx) => {
                            dataPoint[loan.loanName] = loan.remainingBalance;
                          });
                          return dataPoint;
                        });
                      })()}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                        label={{ value: 'Balance', angle: -90, position: 'insideLeft' }}
                        className="text-xs"
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const monthNum = payload[0].payload.month;
                            const monthData = results.avalanche.monthlySchedule[monthNum - 1];
                            
                            return (
                              <div className="rounded-lg border bg-background p-4 shadow-xl max-w-[350px]">
                                <div className="border-b pb-2 mb-3">
                                  <p className="font-bold text-lg">Month {monthNum}</p>
                                  {monthData && (
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(monthData.date).toLocaleDateString('en-IN', { 
                                        month: 'long', 
                                        year: 'numeric' 
                                      })}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2 max-h-64 overflow-auto">
                                  {payload.map((entry: any, index: number) => {
                                    if (entry.value <= 0) return null;
                                    
                                    const loanData = monthData?.loans.find(l => l.loanName === entry.name);
                                    
                                    return (
                                      <div key={index} className="border-l-2 pl-2" style={{ borderColor: entry.color }}>
                                        <p className="text-sm font-semibold mb-1" style={{ color: entry.color }}>
                                          {entry.name}
                                        </p>
                                        <div className="space-y-0.5 text-xs">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Balance:</span>
                                            <span className="font-medium">{formatINR(entry.value)}</span>
                                          </div>
                                          {loanData && (
                                            <>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Payment:</span>
                                                <span className="font-medium">{formatINR(loanData.payment)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Interest:</span>
                                                <span className="text-destructive">{formatINR(loanData.interestPaid)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Principal:</span>
                                                <span className="text-success">{formatINR(loanData.principalPaid)}</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {monthData && (
                                  <div className="border-t pt-2 mt-3">
                                    <div className="flex justify-between text-sm font-semibold">
                                      <span>Total Payment:</span>
                                      <span>{formatINR(monthData.totalPayment)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {loans.map((loan, idx) => (
                        <Line
                          key={loan.id}
                          type="monotone"
                          dataKey={loan.loan_name}
                          name={loan.loan_name}
                          stroke={`hsl(var(--chart-${(idx % 5) + 1}))`}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Loan Portfolio</CardTitle>
                  <CardDescription>Current active loans sorted by priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loan Name</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Interest Rate</TableHead>
                          <TableHead className="text-right">Monthly EMI</TableHead>
                          <TableHead>Snowball Priority</TableHead>
                          <TableHead>Avalanche Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loans.map((loan, idx) => {
                          const snowballPriority = [...loans].sort((a, b) => a.outstanding - b.outstanding).findIndex(l => l.id === loan.id) + 1;
                          const avalanchePriority = [...loans].sort((a, b) => b.interest_rate_apy - a.interest_rate_apy).findIndex(l => l.id === loan.id) + 1;
                          
                          return (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">{loan.loan_name}</TableCell>
                              <TableCell className="text-right">{formatINR(loan.outstanding)}</TableCell>
                              <TableCell className="text-right">{loan.interest_rate_apy}%</TableCell>
                              <TableCell className="text-right">{formatINR(loan.emi_amount)}</TableCell>
                              <TableCell>
                                <Badge variant={snowballPriority === 1 ? "default" : "outline"}>
                                  #{snowballPriority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={avalanchePriority === 1 ? "default" : "outline"}>
                                  #{avalanchePriority}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="avalanche" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="avalanche">Avalanche Schedule</TabsTrigger>
                  <TabsTrigger value="snowball">Snowball Schedule</TabsTrigger>
                  <TabsTrigger value="minimum">Minimum Only</TabsTrigger>
                </TabsList>

                <TabsContent value="avalanche" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Avalanche Payment Schedule</CardTitle>
                      <CardDescription>
                        Monthly breakdown of payments using the avalanche method
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.avalanche)}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="snowball" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Snowball Payment Schedule</CardTitle>
                      <CardDescription>
                        Monthly breakdown of payments using the snowball method
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.snowball)}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="minimum" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Minimum Payment Schedule</CardTitle>
                      <CardDescription>
                        What happens if you only pay minimum EMIs (no extra payments)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderPayoffScheduleTable(results.minPaymentOnly)}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
}
