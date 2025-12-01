import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Edit2, Trash2, Search, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import FadeInStagger from "@/components/FadeInStagger";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

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
  group_id: string;
  subgroup_id: string;
  amount: number;
  paid_from: string;
  bank_account_id?: string;
  from_location?: string;
  to_location?: string;
  travel_mode?: string;
  tags?: string[];
  notes?: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
}

export default function MonthlyExpenses() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);

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
      const { data: groupsData } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");
      setGroups(groupsData || []);

      // Fetch expense subgroups
      const { data: subgroupsData } = await supabase
        .from("expense_subgroups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");
      setSubgroups(subgroupsData || []);

      // Fetch bank accounts
      const { data: accountsData } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      setBankAccounts(accountsData || []);

      // Fetch expenses
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(
        parseInt(selectedMonth.split('-')[0]),
        parseInt(selectedMonth.split('-')[1]),
        0
      ).toISOString().split('T')[0];

      const { data: expensesData } = await supabase
        .from("monthly_expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });

      setExpenses(expensesData || []);
    } catch (error) {
      toast.error("Failed to fetch data");
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
        group_id: expense.group_id,
        subgroup_id: expense.subgroup_id,
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
    setOpenExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    if (!user || !formData.amount || !formData.description || !formData.group_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(Boolean);

      const expenseData = {
        user_id: user.id,
        expense_date: formData.date,
        description: formData.description,
        group_id: formData.group_id,
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

        if (error) throw error;
        toast.success("Expense updated successfully");
      } else {
        const { error } = await supabase
          .from("monthly_expenses")
          .insert(expenseData);

        if (error) throw error;

        // If paid from bank account, create bank statement entry
        if (formData.bank_account_id) {
          await supabase.from("bank_statement_entries").insert({
            user_id: user.id,
            bank_account_id: formData.bank_account_id,
            transaction_date: formData.date,
            narration: formData.description,
            debit: amount,
            category: groups.find(g => g.id === formData.group_id)?.name || "Expense",
            subcategory: subgroups.find(s => s.id === formData.subgroup_id)?.name,
            notes: formData.notes || null,
          });
        }

        toast.success("Expense added successfully");
      }

      setOpenExpenseDialog(false);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to save expense");
      console.error(error);
    }
  };

  const handleDeleteExpense = async (expense: MonthlyExpense) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase
        .from("monthly_expenses")
        .delete()
        .eq("id", expense.id);

      if (error) throw error;

      // Also delete from bank_statement_entries if it exists
      if (expense.bank_account_id) {
        await supabase
          .from("bank_statement_entries")
          .delete()
          .eq("bank_account_id", expense.bank_account_id)
          .eq("narration", expense.description)
          .eq("transaction_date", expense.expense_date);
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
      const groupName = groups.find(g => g.id === e.group_id)?.name || "Unknown";
      categoryTotals[groupName] = (categoryTotals[groupName] || 0) + e.amount;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryData = getCategoryData();
  const selectedSubgroup = subgroups.find(s => s.id === formData.subgroup_id);

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
          <p className="text-muted-foreground">Advanced expense tracking with categories and groups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenCategoryDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button onClick={() => handleOpenExpenseDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
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
              <div className="text-3xl font-bold">{filteredExpenses.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Expense entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <>
                  <div className="text-2xl font-bold">{categoryData[0].name}</div>
                  <p className="text-sm text-muted-foreground mt-1">{formatINR(categoryData[0].value)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Category-wise Spending</CardTitle>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Expenses</CardTitle>
                <CardDescription>View and manage your expenses</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-[180px]">
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
                  {filteredExpenses.map((expense) => {
                    const group = groups.find(g => g.id === expense.group_id);
                    const subgroup = subgroups.find(s => s.id === expense.subgroup_id);
                    
                    return (
                      <TableRow key={expense.id}>
                        <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{subgroup?.icon || group?.icon || "📄"}</span>
                            <div>
                              <div className="font-medium">{expense.description}</div>
                              {expense.notes && (
                                <div className="text-sm text-muted-foreground">{expense.notes}</div>
                              )}
                              {expense.tags && expense.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {expense.tags.map((tag, i) => (
                                    <Badge key={i} variant="outline">{tag}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group?.name}</div>
                            {subgroup && (
                              <div className="text-sm text-muted-foreground">{subgroup.name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{expense.paid_from}</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenExpenseDialog(expense)}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeInStagger>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={openExpenseDialog} onOpenChange={setOpenExpenseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount*</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div className="col-span-2">
              <Label>Description*</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Groceries, Taxi fare"
              />
            </div>
            <div>
              <Label>Group*</Label>
              <Select
                value={formData.group_id}
                onValueChange={(value) => setFormData({ ...formData, group_id: value, subgroup_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.icon} {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subgroup</Label>
              <Select
                value={formData.subgroup_id}
                onValueChange={(value) => setFormData({ ...formData, subgroup_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subgroup" />
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
            <div>
              <Label>Paid From</Label>
              <Select
                value={formData.paid_from}
                onValueChange={(value) => setFormData({ ...formData, paid_from: value, bank_account_id: value === "Cash" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">💵 Cash</SelectItem>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - {account.account_number_masked}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="food, essential"
              />
            </div>
            
            {selectedSubgroup?.requires_location && (
              <>
                <div>
                  <Label>From Location</Label>
                  <Input
                    value={formData.from_location}
                    onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                    placeholder="Home"
                  />
                </div>
                <div>
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
              <div>
                <Label>Travel Mode/App</Label>
                <Input
                  value={formData.travel_mode}
                  onChange={(e) => setFormData({ ...formData, travel_mode: e.target.value })}
                  placeholder="Uber, Ola, Auto, etc."
                />
              </div>
            )}

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenExpenseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveExpense}>
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
