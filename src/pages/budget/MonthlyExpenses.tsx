import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Edit2, Trash2, Search, Settings, Loader2, Calendar, TrendingUp, Receipt, Wallet, CreditCard, Banknote, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import FadeInStagger from "@/components/FadeInStagger";
import RecurringExpenses from "@/components/budget/RecurringExpenses";
import CategoryManagerSheet from "@/components/budget/CategoryManagerSheet";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))'];

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Wallet },
  { value: "Card", label: "Card", icon: CreditCard },
  { value: "Bank", label: "Bank Transfer", icon: Receipt },
];

interface ExpenseGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ExpenseSubgroup {
  id: string;
  group_id: string;
  name: string;
  icon: string;
  requires_location: boolean;
  requires_travel_mode: boolean;
}

interface MonthlyExpense {
  id: string;
  expense_date: string;
  description: string;
  group_id: string | null;
  subgroup_id: string | null;
  amount: number;
  paid_from: string;
  bank_account_id?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  travel_mode?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
}

export default function MonthlyExpenses() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCategoryManager, setOpenCategoryManager] = useState(false);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [subgroups, setSubgroups] = useState<ExpenseSubgroup[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<MonthlyExpense[]>([]);
  
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [subgroupFilter, setSubgroupFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [openExpenseDialog, setOpenExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<MonthlyExpense | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    group_id: "",
    subgroup_id: "",
    amount: "",
    paid_from: "Cash",
    bank_account_id: "",
    from_location: "",
    to_location: "",
    travel_mode: "",
    tags: "",
    notes: "",
  });

  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    filterExpenses();
  }, [expenses, groupFilter, subgroupFilter, searchTerm]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch expense groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");
      
      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Fetch expense subgroups
      const { data: subgroupsData, error: subgroupsError } = await supabase
        .from("expense_subgroups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");
      
      if (subgroupsError) throw subgroupsError;
      setSubgroups(subgroupsData || []);

      // Fetch bank accounts
      const { data: accountsData } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      setBankAccounts(accountsData || []);

      // Fetch expenses for selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${selectedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data: expensesData, error: expensesError } = await supabase
        .from("monthly_expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch data: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const filterExpenses = () => {
    let filtered = [...expenses];

    if (groupFilter !== "all") {
      filtered = filtered.filter(e => e.group_id === groupFilter);
    }

    if (subgroupFilter !== "all") {
      filtered = filtered.filter(e => e.subgroup_id === subgroupFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredExpenses(filtered);
  };

  const handleOpenExpenseDialog = (expense?: MonthlyExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        date: expense.expense_date,
        description: expense.description,
        group_id: expense.group_id || "",
        subgroup_id: expense.subgroup_id || "",
        amount: expense.amount.toString(),
        paid_from: expense.paid_from,
        bank_account_id: expense.bank_account_id || "",
        from_location: expense.from_location || "",
        to_location: expense.to_location || "",
        travel_mode: expense.travel_mode || "",
        tags: expense.tags?.join(", ") || "",
        notes: expense.notes || "",
      });
    } else {
      setEditingExpense(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: "",
        group_id: groups[0]?.id || "",
        subgroup_id: "",
        amount: "",
        paid_from: "Cash",
        bank_account_id: "",
        from_location: "",
        to_location: "",
        travel_mode: "",
        tags: "",
        notes: "",
      });
    }
    setAiSuggestion(null);
    setOpenExpenseDialog(true);
  };

  const handleAICategorize = async () => {
    if (!formData.description || !formData.amount) {
      toast.error("Please enter description and amount first");
      return;
    }

    if (groups.length === 0) {
      toast.error("Please create expense categories first");
      return;
    }

    setAiCategorizing(true);
    setAiSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke("categorize-expense", {
        body: {
          description: formData.description,
          amount: parseFloat(formData.amount),
          groups,
          subgroups,
        },
      });

      if (error) throw error;

      if (data.success && data.categorization) {
        setAiSuggestion(data.categorization);
        setFormData({
          ...formData,
          group_id: data.categorization.group_id,
          subgroup_id: data.categorization.subgroup_id || "",
        });
        toast.success(`AI suggests: ${data.categorization.reasoning}`);
      } else {
        toast.error(data.error || "Failed to categorize");
      }
    } catch (error: any) {
      console.error("AI categorization error:", error);
      if (error.message?.includes("429")) {
        toast.error("Rate limit exceeded. Please try again later.");
      } else if (error.message?.includes("402")) {
        toast.error("AI credits exhausted. Please add credits to continue.");
      } else {
        toast.error("Failed to get AI suggestion");
      }
    } finally {
      setAiCategorizing(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!user) {
      toast.error("Please log in to add expenses");
      return;
    }

    // Validation
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (!formData.date) {
      toast.error("Please select a date");
      return;
    }

    setSaving(true);

    try {
      const amount = parseFloat(formData.amount);
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(Boolean);

      const expenseData = {
        user_id: user.id,
        expense_date: formData.date,
        description: formData.description.trim(),
        group_id: formData.group_id || null,
        subgroup_id: formData.subgroup_id || null,
        amount,
        paid_from: formData.paid_from,
        bank_account_id: formData.bank_account_id || null,
        from_location: formData.from_location || null,
        to_location: formData.to_location || null,
        travel_mode: formData.travel_mode || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        notes: formData.notes || null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("monthly_expenses")
          .update(expenseData)
          .eq("id", editingExpense.id);

        if (error) {
          console.error("Update error:", error);
          throw new Error(error.message || "Failed to update expense");
        }
        toast.success("Expense updated successfully");
      } else {
        const { error } = await supabase
          .from("monthly_expenses")
          .insert(expenseData);

        if (error) {
          console.error("Insert error:", error);
          throw new Error(error.message || "Failed to add expense");
        }

        // If paid from bank account, create bank statement entry
        if (formData.bank_account_id) {
          const { error: bankError } = await supabase.from("bank_statement_entries").insert({
            user_id: user.id,
            bank_account_id: formData.bank_account_id,
            transaction_date: formData.date,
            narration: formData.description,
            debit: amount,
            category: groups.find(g => g.id === formData.group_id)?.name || "Expense",
            subcategory: subgroups.find(s => s.id === formData.subgroup_id)?.name,
            notes: formData.notes || null,
          });
          
          if (bankError) {
            console.warn("Bank entry warning:", bankError);
          }
        }

        toast.success("Expense added successfully");
      }

      setOpenExpenseDialog(false);
      fetchData();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;

    try {
      const { error } = await supabase
        .from("monthly_expenses")
        .delete()
        .eq("id", deleteExpense.id);

      if (error) throw error;

      // Also delete from bank_statement_entries if it exists
      if (deleteExpense.bank_account_id) {
        await supabase
          .from("bank_statement_entries")
          .delete()
          .eq("bank_account_id", deleteExpense.bank_account_id)
          .eq("narration", deleteExpense.description)
          .eq("transaction_date", deleteExpense.expense_date);
      }

      toast.success("Expense deleted successfully");
      setDeleteExpense(null);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete expense: " + (error.message || "Unknown error"));
    }
  };

  const getCategoryData = () => {
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const groupName = groups.find(g => g.id === e.group_id)?.name || "Uncategorized";
      categoryTotals[groupName] = (categoryTotals[groupName] || 0) + e.amount;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryData = getCategoryData();
  const selectedSubgroup = subgroups.find(s => s.id === formData.subgroup_id);

  // Month navigation
  const getMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Monthly Expenses</h1>
          <p className="text-muted-foreground">Track and categorize your spending</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
          <Button variant="outline" onClick={() => setOpenCategoryManager(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Categories
          </Button>
          <Button onClick={() => handleOpenExpenseDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      <FadeInStagger>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold text-primary">{formatINR(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">{getMonthLabel(selectedMonth)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold">{filteredExpenses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Expense entries</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Top Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <>
                  <div className="text-lg md:text-xl font-bold truncate">{categoryData[0].name}</div>
                  <p className="text-sm text-muted-foreground mt-1">{formatINR(categoryData[0].value)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recurring Expenses */}
        <RecurringExpenses
          groups={groups}
          subgroups={subgroups}
          bankAccounts={bankAccounts}
          onExpenseGenerated={fetchData}
        />

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                📊
              </div>
              Category-wise Spending
            </CardTitle>
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
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatINR(value)} 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Receipt className="h-12 w-12 mb-4 opacity-50" />
                <p>No expense data for this month</p>
                <Button variant="link" onClick={() => handleOpenExpenseDialog()}>
                  Add your first expense
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>All Expenses</CardTitle>
                <CardDescription>View and manage your expenses for {getMonthLabel(selectedMonth)}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.icon} {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[180px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No expenses found</p>
                <p className="text-sm">
                  {expenses.length === 0 
                    ? "Start tracking by adding your first expense" 
                    : "Try adjusting your filters"}
                </p>
                {expenses.length === 0 && (
                  <Button className="mt-4" onClick={() => handleOpenExpenseDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold">Group</TableHead>
                      <TableHead className="font-semibold">Sub-category</TableHead>
                      <TableHead className="font-semibold">Paid From</TableHead>
                      <TableHead className="text-right font-semibold">Amount</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => {
                      const group = groups.find(g => g.id === expense.group_id);
                      const subgroup = subgroups.find(s => s.id === expense.subgroup_id);
                      const bankAccount = bankAccounts.find(b => b.id === expense.bank_account_id);
                      
                      return (
                        <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(expense.expense_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                                {subgroup?.icon || group?.icon || "📄"}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[200px]">{expense.description}</div>
                                {expense.notes && (
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{expense.notes}</div>
                                )}
                                {expense.tags && expense.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {expense.tags.slice(0, 2).map((tag, i) => (
                                      <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
                                    ))}
                                    {expense.tags.length > 2 && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0">+{expense.tags.length - 2}</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {group ? (
                              <Badge variant="secondary" className="font-normal">
                                {group.icon} {group.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {subgroup ? (
                              <span className="text-sm">{subgroup.icon} {subgroup.name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {expense.paid_from === "Cash" && <Banknote className="h-4 w-4 text-green-500" />}
                              {expense.paid_from === "UPI" && <Wallet className="h-4 w-4 text-blue-500" />}
                              {expense.paid_from === "Card" && <CreditCard className="h-4 w-4 text-purple-500" />}
                              {expense.paid_from === "Bank" && <Receipt className="h-4 w-4 text-orange-500" />}
                              <span className="text-sm">
                                {expense.paid_from}
                                {bankAccount && (
                                  <span className="text-muted-foreground text-xs block">
                                    {bankAccount.bank_name}
                                  </span>
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-destructive">{formatINR(expense.amount)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10"
                                onClick={() => handleOpenExpenseDialog(expense)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                                onClick={() => setDeleteExpense(expense)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeInStagger>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={openExpenseDialog} onOpenChange={setOpenExpenseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingExpense ? (
                <>
                  <Edit2 className="h-5 w-5" />
                  Edit Expense
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Add New Expense
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingExpense ? "Update the expense details below" : "Enter the expense details below"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label>Description *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    setAiSuggestion(null);
                  }}
                  placeholder="e.g., Groceries, Taxi fare, Restaurant bill"
                  className="flex-1"
                />
                {groups.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAICategorize}
                    disabled={aiCategorizing || !formData.description || !formData.amount}
                    className="shrink-0"
                  >
                    {aiCategorizing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI...
                      </>
                    ) : (
                      "🤖 AI Suggest"
                    )}
                  </Button>
                )}
              </div>
              {aiSuggestion && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <span>✓</span> AI: {aiSuggestion.reasoning} (Confidence: {aiSuggestion.confidence}%)
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Group</Label>
              {groups.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    <Button variant="link" className="p-0 h-auto" onClick={() => setOpenCategoryManager(true)}>
                      Create categories first
                    </Button>
                  </span>
                </div>
              ) : (
                <Select
                  value={formData.group_id}
                  onValueChange={(value) => setFormData({ ...formData, group_id: value, subgroup_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.icon} {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Subgroup</Label>
              <Select
                value={formData.subgroup_id}
                onValueChange={(value) => setFormData({ ...formData, subgroup_id: value })}
                disabled={!formData.group_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subgroup (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {subgroups
                    .filter(s => s.group_id === formData.group_id)
                    .map(subgroup => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.icon} {subgroup.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Paid From *</Label>
              <Select
                value={formData.paid_from}
                onValueChange={(value) => setFormData({ ...formData, paid_from: value, bank_account_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Bank Account (Optional)</Label>
              <Select
                value={formData.bank_account_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, bank_account_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - {account.account_number_masked}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="food, essential, monthly"
              />
            </div>
            
            {selectedSubgroup?.requires_location && (
              <>
                <div className="space-y-2">
                  <Label>From Location</Label>
                  <Input
                    value={formData.from_location}
                    onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                    placeholder="Home"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Location</Label>
                  <Input
                    value={formData.to_location}
                    onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                    placeholder="Office"
                  />
                </div>
              </>
            )}

            {selectedSubgroup?.requires_travel_mode && (
              <div className="space-y-2">
                <Label>Travel Mode/App</Label>
                <Input
                  value={formData.travel_mode}
                  onChange={(e) => setFormData({ ...formData, travel_mode: e.target.value })}
                  placeholder="Uber, Ola, Auto, etc."
                />
              </div>
            )}

            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes (optional)"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenExpenseDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveExpense} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingExpense ? (
                "Update Expense"
              ) : (
                "Add Expense"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteExpense} onOpenChange={() => setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense?
              <div className="mt-2 p-3 rounded-lg bg-muted">
                <p className="font-medium">{deleteExpense?.description}</p>
                <p className="text-sm text-muted-foreground">
                  {deleteExpense?.expense_date && new Date(deleteExpense.expense_date).toLocaleDateString()} • {deleteExpense && formatINR(deleteExpense.amount)}
                </p>
              </div>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Manager Sheet */}
      <CategoryManagerSheet 
        open={openCategoryManager} 
        onOpenChange={setOpenCategoryManager}
        onCategoriesUpdated={fetchData}
      />
    </div>
  );
}
