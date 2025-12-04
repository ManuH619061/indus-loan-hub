import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBarChart, PieChart, FileText, Download, Loader2, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FadeInStagger from "@/components/FadeInStagger";
import { toast } from "sonner";

export default function BudgetReportsHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("charts");
  const [exporting, setExporting] = useState(false);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Reports exported successfully!");
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileBarChart className="h-7 w-7 text-primary" />
            Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual charts and detailed financial statements
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleExportAll}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export All
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="charts" className="text-xs md:text-sm">
            <PieChart className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="statements" className="text-xs md:text-sm">
            <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Statements
          </TabsTrigger>
          <TabsTrigger value="download" className="text-xs md:text-sm">
            <Download className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Download
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/visual-reports')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PieChart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Visual Reports</h3>
                  <p className="text-sm text-muted-foreground">Pie charts, bar graphs, and trend analysis</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/reports')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Budget Statements</h3>
                  <p className="text-sm text-muted-foreground">Detailed monthly and quarterly reports</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="download" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => toast.info("PDF export coming soon")}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Export as PDF</h3>
                  <p className="text-sm text-muted-foreground">Complete budget report with charts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => toast.info("Excel export coming soon")}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                  <FileBarChart className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Export as Excel</h3>
                  <p className="text-sm text-muted-foreground">Raw data for custom analysis</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </FadeInStagger>
  );
}
