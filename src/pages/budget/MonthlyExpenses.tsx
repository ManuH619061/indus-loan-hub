import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Upload, Download, Calendar, Sparkles, AlertCircle, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { ResponsiveChartLegacy } from "@/components/ui/responsive-chart";
import { ResponsiveTableSimple } from "@/components/ui/responsive-table";
import FadeInStagger from "@/components/FadeInStagger";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const CATEGORIES = ["Food", "Transport", "Shopping", "Eating Out", "Travel", "Entertainment", "Healthcare", "Education", "Bills", "Other"];

interface Transaction {
  id: string;
  transaction_date: string;
  narration: string;
  debit: number;
  credit: number;
  category: string;
  subcategory?: string;
  notes?: string;
  bank_type: string;
}

export default function MonthlyExpenses() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    category: "Other",
    notes: "",
    mode: "UPI",
  });

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, [user, selectedMonth]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, categoryFilter, searchTerm]);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredTransactions(filtered);
  };

  const handleAddTransaction = async () => {
    if (!user || !newTransaction.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_date: newTransaction.date,
        narration: `Manual Entry - ${newTransaction.category}`,
        debit: parseFloat(newTransaction.amount),
        credit: 0,
        category: newTransaction.category,
        notes: newTransaction.notes,
        bank_type: "Manual",
      });

      if (error) throw error;
      
      toast.success("Transaction added successfully");
      setOpenAddDialog(false);
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        amount: "",
        category: "Other",
        notes: "",
        mode: "UPI",
      });
      fetchTransactions();
    } catch (error: any) {
      toast.error("Failed to add transaction");
    }
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionToDelete.id);

      if (error) throw error;

      toast.success("Transaction deleted successfully");
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      fetchTransactions();
    } catch (error: any) {
      toast.error("Failed to delete transaction");
    }
  };

  const getCategoryData = () => {
    const categoryTotals: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const amount = t.debit || 0;
      if (amount > 0) {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amount;
      }
    });
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const getTrendData = () => {
    const dailyTotals: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const date = t.transaction_date;
      const amount = t.debit || 0;
      dailyTotals[date] = (dailyTotals[date] || 0) + amount;
    });
    
    return Object.entries(dailyTotals)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const categoryData = getCategoryData();
  const trendData = getTrendData();
  const totalExpenses = filteredTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const topCategories = categoryData.slice(0, 5);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Monthly Expenses</h1>
          <p className="text-muted-foreground">Track and categorize your spending</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
                <DialogDescription>Manually add a transaction to track expenses</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={newTransaction.category} onValueChange={(value) => setNewTransaction({ ...newTransaction, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes..."
                    value={newTransaction.notes}
                    onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddTransaction}>Add Transaction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Expenses
          </Button>
        </div>
      </div>

      <FadeInStagger>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatINR(totalExpenses)}</div>
              <p className="text-sm text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredTransactions.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Expense entries</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Top Category</CardTitle>
            </CardHeader>
            <CardContent>
              {topCategories.length > 0 ? (
                <>
                  <div className="text-2xl font-bold">{topCategories[0].name}</div>
                  <p className="text-sm text-muted-foreground mt-1">{formatINR(topCategories[0].value)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Category-wise Spending</CardTitle>
              <CardDescription>Distribution of expenses by category</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ResponsiveChartLegacy height={300} minHeight={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatINR(value)} />
                  </PieChart>
                </ResponsiveChartLegacy>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No expense data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Categories</CardTitle>
              <CardDescription>Highest spending categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCategories.map((category, index) => (
                  <div key={category.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">{formatINR(category.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(category.value / totalExpenses) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Spending Trend</CardTitle>
            <CardDescription>Track your spending over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveChartLegacy height={300} minHeight={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveChartLegacy>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>View and manage your expenses</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[200px]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveTableSimple minWidth={700}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.transaction_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.narration}</div>
                      {transaction.notes && (
                        <div className="text-sm text-muted-foreground">{transaction.notes}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell>{transaction.bank_type}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium text-destructive">
                          {formatINR(transaction.debit || 0)}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setTransactionToDelete(transaction);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ResponsiveTableSimple>
          </CardContent>
        </Card>
      </FadeInStagger>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction of {transactionToDelete && formatINR(transactionToDelete.debit)}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
