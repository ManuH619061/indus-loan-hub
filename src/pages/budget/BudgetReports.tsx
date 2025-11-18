import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Download, FileText, BarChart3, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";

export default function BudgetReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportMonthlyBudget = () => {
    toast.info("Generating Monthly Budget PDF...");
    // Implement PDF export
  };

  const exportCashFlowForecast = () => {
    toast.info("Generating Cash-Flow Forecast Report...");
    // Implement report export
  };

  const exportExpenseReport = () => {
    toast.info("Generating Expense Category Report...");
    // Implement report export
  };

  const exportLoanBudgetReport = () => {
    toast.info("Generating Loan-Budget Interaction Report...");
    // Implement report export
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Budget Reports</h1>
        <p className="text-muted-foreground">Generate and export comprehensive budget reports</p>
      </div>

      <FadeInStagger>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Monthly Budget Report
              </CardTitle>
              <CardDescription>
                Detailed breakdown of income, expenses, and savings for the current month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Includes:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Income sources and totals</li>
                  <li>Fixed and variable expenses</li>
                  <li>EMI payments and loan details</li>
                  <li>Savings and investment allocation</li>
                  <li>Category-wise spending breakdown</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportMonthlyBudget} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportMonthlyBudget} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Cash-Flow Forecast Report
              </CardTitle>
              <CardDescription>
                12-24 month projection of income, expenses, and free cash flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Includes:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Monthly income projections</li>
                  <li>Expected expenses and EMI schedules</li>
                  <li>Free cash flow analysis</li>
                  <li>Debt burden percentages</li>
                  <li>Alert months (negative cash, high debt)</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportCashFlowForecast} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportCashFlowForecast} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Expense Category Report
              </CardTitle>
              <CardDescription>
                Analyze spending patterns across different categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Includes:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Category-wise spending totals</li>
                  <li>Budget vs actual comparison</li>
                  <li>Spending trends over time</li>
                  <li>Top spending categories</li>
                  <li>Overspending alerts and recommendations</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportExpenseReport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportExpenseReport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Loan-Budget Interaction Report
              </CardTitle>
              <CardDescription>
                Impact of loan repayments on overall budget and cash flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Includes:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Total EMI burden on income</li>
                  <li>Loan-wise repayment schedules</li>
                  <li>Interest vs principal breakdown</li>
                  <li>Impact of extra EMI payments</li>
                  <li>Debt-free projections</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportLoanBudgetReport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportLoanBudgetReport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Generation Options</CardTitle>
            <CardDescription>Customize your report parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="monthly">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
              <TabsContent value="monthly" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate reports for the current month with detailed breakdowns and comparisons to previous months.
                </p>
                <Button onClick={() => toast.info("Generating monthly reports...")}>
                  Generate All Monthly Reports
                </Button>
              </TabsContent>
              <TabsContent value="quarterly" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate quarterly reports showing 3-month trends and patterns.
                </p>
                <Button onClick={() => toast.info("Generating quarterly reports...")}>
                  Generate All Quarterly Reports
                </Button>
              </TabsContent>
              <TabsContent value="yearly" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate yearly reports with annual summaries and year-over-year comparisons.
                </p>
                <Button onClick={() => toast.info("Generating yearly reports...")}>
                  Generate All Yearly Reports
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}
