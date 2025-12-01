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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Edit2, Trash2, Search, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import FadeInStagger from "@/components/FadeInStagger";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Eating Out", "Travel", "Entertainment",
  "Healthcare", "Education", "Bills", "Rent", "Insurance", "EMI", "Other"
];

interface Expense {
  id: string;
  transaction_date: string;
  narration: string;
  debit: number;
  category: string;
  subcategory?: string;
  notes?: string;
  bank_type: string;
  bank_account_id?: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
  account_type: string;
}

export default function MonthlyExpenses() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    category: "Other",
    amount: "",
    paidFrom: "cash",
    tags: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    filterExpenses();
  }, [expenses, categoryFilter, searchTerm]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch bank accounts
      const { data: accountsData } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      setBankAccounts(accountsData || []);

      // Fetch expenses from transactions table
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(
        parseInt(selectedMonth.split('-')[0]),
        parseInt(selectedMonth.split('-')[1]),
        0
      ).toISOString().split('T')[0];

      const { data: expensesData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .gt("debit", 0)
        .order("transaction_date", { ascending: false });

      setExpenses(expensesData || []);
    } catch (error) {
      toast.error("Failed to fetch expenses");
    } finally {
      setLoading(false);
    }
  };

  const filterExpenses = () => {
    let filtered = [...expenses];

    if (categoryFilter !== "all") {
      filtered = filtered.filter(e => e.category === categoryFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredExpenses(filtered);
  };

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        date: expense.transaction_date,
        description: expense.narration,
        category: expense.category,
        amount: expense.debit.toString(),
        paidFrom: expense.bank_account_id || "cash",
        tags: expense.subcategory || "",
        notes: expense.notes || "",
      });
    } else {
      setEditingExpense(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: "",
        category: "Other",
        amount: "",
        paidFrom: "cash",
        tags: "",
        notes: "",
      });
    }
    setOpenDialog(true);
  };

  const handleSaveExpense = async () => {
    if (!user || !formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      const bankAccountId = formData.paidFrom !== "cash" ? formData.paidFrom : null;

      if (editingExpense) {
        // Update existing expense
        const { error } = await supabase
          .from("transactions")
          .update({
            transaction_date: formData.date,
            narration: formData.description,
            category: formData.category,
            subcategory: formData.tags || null,
            debit: amount,
            notes: formData.notes,
            bank_type: bankAccountId ? "Bank" : "Cash",
          })
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Expense updated successfully");
      } else {
        // Create new expense
        const { error: txnError } = await supabase.from("transactions").insert({
          user_id: user.id,
          transaction_date: formData.date,
          narration: formData.description,
          debit: amount,
          credit: 0,
          category: formData.category,
          subcategory: formData.tags || null,
          notes: formData.notes,
          bank_type: bankAccountId ? "Bank" : "Cash",
        });

        if (txnError) throw txnError;

        // If paid from bank account, also create bank statement entry
        if (bankAccountId) {
          const { error: bankError } = await supabase.from("bank_statement_entries").insert({
            user_id: user.id,
            bank_account_id: bankAccountId,
            transaction_date: formData.date,
            narration: formData.description,
            debit: amount,
            credit: 0,
            category: formData.category,
            subcategory: formData.tags || null,
            notes: formData.notes,
          });

          if (bankError) throw bankError;
        }

        toast.success("Expense added successfully");
      }

      setOpenDialog(false);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to save expense");
      console.error(error);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", expense.id);

      if (error) throw error;

      // Also delete from bank_statement_entries if it exists
      if (expense.bank_account_id) {
        await supabase
          .from("bank_statement_entries")
          .delete()
          .eq("bank_account_id", expense.bank_account_id)
          .eq("narration", expense.narration)
          .eq("transaction_date", expense.transaction_date);
      }

      toast.success("Expense deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  const getCategoryData = () => {
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.debit;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const getTrendData = () => {
    const dailyTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const date = e.transaction_date;
      dailyTotals[date] = (dailyTotals[date] || 0) + e.debit;
    });

    return Object.entries(dailyTotals)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const categoryData = getCategoryData();
  const trendData = getTrendData();
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.debit, 0);
  const topCategories = categoryData.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Monthly Expenses</h1>
          <p className="text-muted-foreground">Track and categorize your spending</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
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
              <div className="text-3xl font-bold">{filteredExpenses.length}</div>
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
                <ResponsiveContainer width="100%" height={300}>
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
                </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
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
                <CardTitle>All Expenses</CardTitle>
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Paid From</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="font-medium">{expense.narration}</div>
                        {expense.notes && (
                          <div className="text-sm text-muted-foreground">{expense.notes}</div>
                        )}
                        {expense.subcategory && (
                          <Badge variant="outline" className="mt-1">{expense.subcategory}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell>{expense.bank_type}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatINR(expense.debit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(expense)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No expenses found. Add your first expense to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </FadeInStagger>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
            <DialogDescription>
              {editingExpense ? "Update expense details" : "Enter expense details to track your spending"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Grocery shopping at Store"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
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
                <Label htmlFor="paidFrom">Paid From *</Label>
                <Select value={formData.paidFrom} onValueChange={(value) => setFormData({ ...formData, paidFrom: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    {bankAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bank_name} - {account.account_number_masked}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input
                id="tags"
                placeholder="e.g., Business, Personal"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveExpense}>
              {editingExpense ? "Update" : "Add"} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
