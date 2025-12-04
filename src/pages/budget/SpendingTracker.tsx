import { useNavigate } from "react-router-dom";
import { Wallet, Plus, Upload, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FadeInStagger from "@/components/FadeInStagger";

export default function SpendingTracker() {
  const navigate = useNavigate();

  return (
    <FadeInStagger className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Spending
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage all your expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/banking/accounts')}>
            <Upload className="h-4 w-4 mr-2" />
            Import from Bank
          </Button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/budget/monthly-expenses')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Monthly Expenses</h3>
                <p className="text-sm text-muted-foreground">View and add expenses by month</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/expenses')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <Upload className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Transaction History</h3>
                <p className="text-sm text-muted-foreground">All bank transactions & expenses</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => navigate('/budget/monthly-expenses')} className="w-full md:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        Add Expense
      </Button>
    </FadeInStagger>
  );
}
