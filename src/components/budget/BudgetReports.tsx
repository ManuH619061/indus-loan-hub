import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/currency";
import { Download, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface BudgetReportsProps {
  monthlyReport: {
    category: string;
    budgeted: number;
    actual: number;
    difference: number;
  }[];
  cashFlowForecast: {
    month: string;
    income: number;
    expenses: number;
    emis: number;
    netCashFlow: number;
  }[];
  debtReport: {
    loanName: string;
    plannedExtraEMI: number;
    actualExtraEMI: number;
    interestSaved: number;
  }[];
}

export default function BudgetReports({
  monthlyReport,
  cashFlowForecast,
  debtReport,
}: BudgetReportsProps) {
  const exportToPDF = (reportType: string) => {
    toast.info(`Exporting ${reportType} report to PDF...`);
    // Implement PDF export logic here
  };

  const exportToExcel = (reportType: string) => {
    toast.info(`Exporting ${reportType} report to Excel...`);
    // Implement Excel export logic here
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Budget Reports
            </CardTitle>
            <CardDescription>
              Analyze your budget performance and forecast
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monthly">Budget vs Actual</TabsTrigger>
            <TabsTrigger value="forecast">Cash Flow Forecast</TabsTrigger>
            <TabsTrigger value="debt">Debt Report</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-4">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToPDF("Monthly Budget")}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel("Monthly Budget")}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReport.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-right">{formatINR(row.budgeted)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.actual)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.difference >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatINR(row.difference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToPDF("Cash Flow Forecast")}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel("Cash Flow Forecast")}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">EMIs</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlowForecast.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right text-success">{formatINR(row.income)}</TableCell>
                    <TableCell className="text-right text-warning">{formatINR(row.expenses)}</TableCell>
                    <TableCell className="text-right text-primary">{formatINR(row.emis)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.netCashFlow >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatINR(row.netCashFlow)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="debt" className="space-y-4">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToPDF("Debt Report")}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel("Debt Report")}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Planned Extra EMI</TableHead>
                  <TableHead className="text-right">Actual Extra EMI</TableHead>
                  <TableHead className="text-right">Interest Saved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtReport.map((row) => (
                  <TableRow key={row.loanName}>
                    <TableCell className="font-medium">{row.loanName}</TableCell>
                    <TableCell className="text-right">{formatINR(row.plannedExtraEMI)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.actualExtraEMI)}</TableCell>
                    <TableCell className="text-right text-success font-semibold">
                      {formatINR(row.interestSaved)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}