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
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Export comprehensive budget reports</p>
      </div>

      <FadeInStagger>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportMonthlyBudget}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Monthly Budget</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Income, expenses & savings
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportCashFlowForecast}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <CardTitle className="text-sm">Cash Flow</CardTitle>
              </div>
              <CardDescription className="text-xs">
                12-month projection
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportExpenseReport}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-warning" />
                <CardTitle className="text-sm">Expenses</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Category analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportLoanBudgetReport}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm">Loan Impact</CardTitle>
              </div>
              <CardDescription className="text-xs">
                EMI burden analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="monthly">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs">Quarterly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </FadeInStagger>
    </div>
  );
}
