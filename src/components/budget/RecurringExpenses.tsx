import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { Plus, Edit2, Trash2, Loader2, RefreshCw, Calendar, Play, Pause, Banknote, Wallet, CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";

interface ExpenseGroup {
  id: string;
  name: string;
  icon: string;
}

interface ExpenseSubgroup {
  id: string;
  group_id: string;
  name: string;
  icon: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
}

interface RecurringExpense {
  id: string;
  name: string;
  description: string;
  amount: number;
  group_id: string | null;
  subgroup_id: string | null;
  paid_from: string;
  bank_account_id: string | null;
  frequency: string;
  day_of_month: number | null;
  day_of_week: number | null;
  month_of_year: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_date: string | null;
  notes: string | null;
  tags: string[] | null;
}

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface RecurringExpensesProps {
  groups: ExpenseGroup[];
  subgroups: ExpenseSubgroup[];
  bankAccounts: BankAccount[];
  onExpenseGenerated?: () => void;
}

export default function RecurringExpenses({ 
  groups, 
  subgroups, 
  bankAccounts,
  onExpenseGenerated 
}: RecurringExpensesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<RecurringExpense | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    group_id: "",
    subgroup_id: "",
    paid_from: "Cash",
    bank_account_id: "",
    frequency: "monthly",
    day_of_month: "1",
    day_of_week: "1",
    month_of_year: "1",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    notes: "",
    tags: "",
  });

  useEffect(() => {
    if (user) {
      fetchRecurringExpenses();
    }
  }, [user]);

  const fetchRecurringExpenses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setRecurringExpenses(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch recurring expenses");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (expense?: RecurringExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        name: expense.name,
        description: expense.description,
        amount: expense.amount.toString(),
        group_id: expense.group_id || "",
        subgroup_id: expense.subgroup_id || "",
        paid_from: expense.paid_from,
        bank_account_id: expense.bank_account_id || "",
        frequency: expense.frequency,
        day_of_month: expense.day_of_month?.toString() || "1",
        day_of_week: expense.day_of_week?.toString() || "1",
        month_of_year: expense.month_of_year?.toString() || "1",
        start_date: expense.start_date,
        end_date: expense.end_date || "",
        notes: expense.notes || "",
        tags: expense.tags?.join(", ") || "",
      });
    } else {
      setEditingExpense(null);
      setFormData({
        name: "",
        description: "",
        amount: "",
        group_id: groups[0]?.id || "",
        subgroup_id: "",
        paid_from: "Cash",
        bank_account_id: "",
        frequency: "monthly",
        day_of_month: "1",
        day_of_week: "1",
        month_of_year: "1",
        start_date: new Date().toISOString().split('T')[0],
        end_date: "",
        notes: "",
        tags: "",
      });
    }
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!formData.name.trim() || !formData.description.trim() || !formData.amount) {
      toast.error("Please fill in name, description, and amount");
      return;
    }

    setSaving(true);
    try {
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(Boolean);

      const data = {
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        group_id: formData.group_id || null,
        subgroup_id: formData.subgroup_id || null,
        paid_from: formData.paid_from,
        bank_account_id: formData.bank_account_id || null,
        frequency: formData.frequency,
        day_of_month: formData.frequency === "monthly" || formData.frequency === "yearly" 
          ? parseInt(formData.day_of_month) : null,
        day_of_week: formData.frequency === "weekly" ? parseInt(formData.day_of_week) : null,
        month_of_year: formData.frequency === "yearly" ? parseInt(formData.month_of_year) : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        notes: formData.notes || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("recurring_expenses")
          .update(data)
          .eq("id", editingExpense.id);
        if (error) throw error;
        toast.success("Recurring expense updated");
      } else {
        const { error } = await supabase
          .from("recurring_expenses")
          .insert(data);
        if (error) throw error;
        toast.success("Recurring expense created");
      }

      setOpenDialog(false);
      fetchRecurringExpenses();
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;
    try {
      const { error } = await supabase
        .from("recurring_expenses")
        .delete()
        .eq("id", deleteExpense.id);
      if (error) throw error;
      toast.success("Recurring expense deleted");
      setDeleteExpense(null);
      fetchRecurringExpenses();
    } catch (error: any) {
      toast.error("Failed to delete");
    }
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      const { error } = await supabase
        .from("recurring_expenses")
        .update({ is_active: !expense.is_active })
        .eq("id", expense.id);
      if (error) throw error;
      toast.success(expense.is_active ? "Paused" : "Activated");
      fetchRecurringExpenses();
    } catch (error: any) {
      toast.error("Failed to update");
    }
  };

  const handleGenerateNow = async (expense: RecurringExpense) => {
    if (!user) return;
    setGenerating(expense.id);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Create the expense entry
      const { error: insertError } = await supabase.from("monthly_expenses").insert({
        user_id: user.id,
        expense_date: today,
        description: expense.description,
        group_id: expense.group_id,
        subgroup_id: expense.subgroup_id,
        amount: expense.amount,
        paid_from: expense.paid_from,
        bank_account_id: expense.bank_account_id,
        notes: `Auto-generated from: ${expense.name}`,
        tags: expense.tags,
      });

      if (insertError) throw insertError;

      // Update last_generated_date
      await supabase
        .from("recurring_expenses")
        .update({ last_generated_date: today })
        .eq("id", expense.id);

      // If paid from bank, create bank statement entry
      if (expense.bank_account_id) {
        await supabase.from("bank_statement_entries").insert({
          user_id: user.id,
          bank_account_id: expense.bank_account_id,
          transaction_date: today,
          narration: expense.description,
          debit: expense.amount,
          category: groups.find(g => g.id === expense.group_id)?.name || "Expense",
          subcategory: subgroups.find(s => s.id === expense.subgroup_id)?.name,
          notes: `Auto-generated from: ${expense.name}`,
        });
      }

      toast.success(`Expense "${expense.name}" generated for today`);
      fetchRecurringExpenses();
      onExpenseGenerated?.();
    } catch (error: any) {
      toast.error("Failed to generate expense: " + (error.message || "Unknown error"));
      console.error(error);
    } finally {
      setGenerating(null);
    }
  };

  const getFrequencyLabel = (expense: RecurringExpense) => {
    if (expense.frequency === "monthly") {
      return `Monthly on day ${expense.day_of_month}`;
    } else if (expense.frequency === "weekly") {
      return `Weekly on ${DAYS_OF_WEEK.find(d => d.value === expense.day_of_week)?.label || ""}`;
    } else if (expense.frequency === "yearly") {
      return `Yearly on ${MONTHS.find(m => m.value === expense.month_of_year)?.label || ""} ${expense.day_of_month}`;
    }
    return expense.frequency;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Recurring Expenses
              </CardTitle>
              <CardDescription>
                Auto-generate expenses for rent, subscriptions, etc.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recurring
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recurringExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recurring expenses yet</p>
              <p className="text-sm">Add recurring expenses for rent, subscriptions, etc.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recurringExpenses.map((expense) => {
                const group = groups.find(g => g.id === expense.group_id);
                return (
                  <div
                    key={expense.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      expense.is_active 
                        ? "bg-card hover:bg-muted/50" 
                        : "bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                        {group?.icon || "📅"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{expense.name}</span>
                          <Badge variant={expense.is_active ? "default" : "secondary"}>
                            {expense.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {expense.description}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {getFrequencyLabel(expense)}
                          </span>
                          {expense.last_generated_date && (
                            <span>Last: {new Date(expense.last_generated_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatINR(expense.amount)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          {expense.paid_from === "Cash" && <Banknote className="h-3 w-3" />}
                          {expense.paid_from === "UPI" && <Wallet className="h-3 w-3" />}
                          {expense.paid_from === "Card" && <CreditCard className="h-3 w-3" />}
                          {expense.paid_from === "Bank" && <Receipt className="h-3 w-3" />}
                          {expense.paid_from}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleGenerateNow(expense)}
                          disabled={generating === expense.id}
                          title="Generate expense now"
                        >
                          {generating === expense.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(expense)}
                          title={expense.is_active ? "Pause" : "Activate"}
                        >
                          {expense.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(expense)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteExpense(expense)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Recurring Expense" : "Add Recurring Expense"}
            </DialogTitle>
            <DialogDescription>
              Set up an expense that repeats automatically
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly Rent, Netflix"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., House rent payment"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="10000"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.frequency === "weekly" && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={formData.day_of_week}
                  onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.frequency === "monthly" || formData.frequency === "yearly") && (
              <div className="grid grid-cols-2 gap-4">
                {formData.frequency === "yearly" && (
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select
                      value={formData.month_of_year}
                      onValueChange={(value) => setFormData({ ...formData, month_of_year: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => (
                          <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Select
                    value={formData.day_of_month}
                    onValueChange={(value) => setFormData({ ...formData, day_of_month: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.group_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, group_id: value === "none" ? "" : value, subgroup_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.icon} {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Paid From</Label>
                <Select
                  value={formData.paid_from}
                  onValueChange={(value) => setFormData({ ...formData, paid_from: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="rent, fixed, monthly"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteExpense} onOpenChange={() => setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteExpense?.name}"? This will not delete any expenses already generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
