import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FolderTree, History, Plus, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import FadeInStagger from "@/components/FadeInStagger";

export default function BudgetPlannerHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("budgets");

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Planner
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage budgets, categories, and view history
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="budgets" className="text-xs md:text-sm">
            <ClipboardList className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Budgets
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs md:text-sm">
            <FolderTree className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs md:text-sm">
            <History className="h-4 w-4 mr-1.5 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget-planner')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Monthly Budget Planner</h3>
                  <p className="text-sm text-muted-foreground">Set up your income, expenses, and savings goals</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Button onClick={() => navigate('/budget-planner')} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create New Budget
          </Button>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/category-manager')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <FolderTree className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Category Manager</h3>
                  <p className="text-sm text-muted-foreground">Organize expense groups and subcategories</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget-history')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <History className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Budget History</h3>
                  <p className="text-sm text-muted-foreground">View and compare past monthly budgets</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FadeInStagger>
  );
}
