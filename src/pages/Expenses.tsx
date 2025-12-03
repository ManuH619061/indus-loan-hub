import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Filter, TrendingUp, TrendingDown, Search, Edit2, Trash2, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/contexts/PreferencesContext";
import { formatCurrency } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  transaction_date: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  category: string;
  subcategory: string | null;
  bank_type: string;
  is_transfer: boolean;
  is_emi: boolean;
  notes: string | null;
}

const PERIOD_OPTIONS = [
  { value: "current_month", label: "Current Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export default function Expenses() {
  const { session } = useAuth();
  const { preferences } = usePreferences();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("id");
  const periodParam = searchParams.get("period");
  
  // Helper function to format with user's currency preference
  const fmt = useCallback((amount: number) => {
    return formatCurrency(amount, preferences.currency_symbol, preferences.number_format);
  }, [preferences.currency_symbol, preferences.number_format]);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState(periodParam || "current_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    narration: "",
    category: "",
    subcategory: "",
    debit: "",
    credit: "",
    notes: "",
  });

  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case "current_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "last_3_months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last_6_months":
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      case "this_year":
        return { start: new Date(now.getFullYear(), 0, 1), end: endOfMonth(now) };
      case "all_time":
        return { start: new Date(2000, 0, 1), end: endOfMonth(now) };
      case "custom":
        return {
          start: customStart ? new Date(customStart) : startOfMonth(now),
          end: customEnd ? new Date(customEnd) : endOfMonth(now),
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  // Update period from URL params
  useEffect(() => {
    if (periodParam && PERIOD_OPTIONS.some(p => p.value === periodParam)) {
      setPeriodFilter(periodParam);
    }
  }, [periodParam]);

  useEffect(() => {
    if (session) {
      fetchTransactions();
    }
  }, [session, periodFilter, customStart, customEnd, categoryFilter, bankFilter]);

  // Scroll to highlighted transaction
  useEffect(() => {
    if (highlightId && transactions.length > 0) {
      const element = document.getElementById(`txn-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("bg-primary/20");
        setTimeout(() => element.classList.remove("bg-primary/20"), 3000);
      }
    }
  }, [highlightId, transactions]);

  const fetchTransactions = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const { start, end } = getDateRange();
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('transaction_date', format(start, 'yyyy-MM-dd'))
        .lte('transaction_date', format(end, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (bankFilter !== 'all') {
        query = query.eq('bank_type', bankFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransaction = (txn: Transaction) => {
    setEditingTransaction(txn);
    setFormData({
      narration: txn.narration,
      category: txn.category,
      subcategory: txn.subcategory || "",
      debit: txn.debit?.toString() || "",
      credit: txn.credit?.toString() || "",
      notes: txn.notes || "",
    });
    setOpenEditDialog(true);
  };

  const handleSaveTransaction = async () => {
    if (!editingTransaction || !session) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          narration: formData.narration,
          category: formData.category,
          subcategory: formData.subcategory || null,
          debit: formData.debit ? parseFloat(formData.debit) : null,
          credit: formData.credit ? parseFloat(formData.credit) : null,
          notes: formData.notes || null,
        })
        .eq("id", editingTransaction.id);

      if (error) throw error;

      toast.success("Transaction updated successfully");
      setOpenEditDialog(false);
      setEditingTransaction(null);
      fetchTransactions();
    } catch (error: any) {
      toast.error("Failed to update transaction: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransaction || !session) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", deleteTransaction.id);

      if (error) throw error;

      toast.success("Transaction deleted successfully");
      setDeleteTransaction(null);
      fetchTransactions();
    } catch (error: any) {
      toast.error("Failed to delete transaction: " + error.message);
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !session) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} transaction(s) deleted`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      fetchTransactions();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const filteredTransactions = transactions.filter(t =>
    t.narration.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summaries
  const totalIncome = transactions
    .filter(t => t.category === 'Income')
    .reduce((sum, t) => sum + (t.credit || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.category === 'Expense' && !t.is_transfer)
    .reduce((sum, t) => sum + (t.debit || 0), 0);

  const totalEMI = transactions
    .filter(t => t.is_emi)
    .reduce((sum, t) => sum + (t.debit || 0), 0);

  // Category-wise breakdown
  const categoryData = Object.entries(
    transactions
      .filter(t => t.category === 'Expense' && !t.is_transfer)
      .reduce((acc, t) => {
        const cat = t.subcategory || 'Other';
        acc[cat] = (acc[cat] || 0) + (t.debit || 0);
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))'];

  const banks = [...new Set(transactions.map(t => t.bank_type))];
  const categories = [...new Set(transactions.map(t => t.category))];

  const getPeriodLabel = () => {
    const { start, end } = getDateRange();
    return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`;
  };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Expenses & Transactions</h1>
          <p className="text-muted-foreground text-sm md:text-base mt-1">
            View and manage your transactions • {getPeriodLabel()}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Period Filter */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={periodFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter(option.value)}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        
        {periodFilter === "custom" && (
          <div className="flex gap-4 mt-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-sm">From:</Label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">To:</Label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">{fmt(totalIncome)}</p>
            </div>
            <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-xl md:text-2xl font-bold text-red-600">{fmt(totalExpenses)}</p>
            </div>
            <TrendingDown className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">EMI Payments</p>
              <p className="text-xl md:text-2xl font-bold text-orange-600">{fmt(totalEMI)}</p>
            </div>
            <TrendingDown className="w-6 h-6 md:w-8 md:h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card className="p-4 md:p-6">
            <h3 className="font-bold mb-4 text-sm md:text-base">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmt(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 md:p-6">
            <h3 className="font-bold mb-4 text-sm md:text-base">Income vs Expenses</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  { name: 'Income', amount: totalIncome },
                  { name: 'Expenses', amount: totalExpenses },
                  { name: 'EMI', amount: totalEMI },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => fmt(Number(value))} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Banks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Banks</SelectItem>
              {banks.map(bank => (
                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchTransactions}>
            <Filter className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">
              Transactions ({filteredTransactions.length})
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedIds.size} Selected
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-muted-foreground"
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Bank</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="w-[80px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <span className="text-muted-foreground">Loading transactions...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow 
                      key={transaction.id} 
                      id={`txn-${transaction.id}`}
                      className={cn(
                        "transition-colors",
                        highlightId === transaction.id && "bg-primary/10",
                        selectedIds.has(transaction.id) && "bg-muted/50"
                      )}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => toggleSelectOne(transaction.id)}
                          className="h-4 w-4 rounded border-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {format(new Date(transaction.transaction_date), 'dd MMM')}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] md:max-w-xs">
                          <p className="truncate text-sm">{transaction.narration}</p>
                          <div className="flex items-center gap-1 md:hidden mt-1">
                            <Badge variant="outline" className="text-[10px] px-1">
                              {transaction.category}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={transaction.category === 'Income' ? 'default' : 'secondary'} className="text-xs">
                          {transaction.category}
                        </Badge>
                        {transaction.subcategory && (
                          <span className="text-xs text-muted-foreground ml-1 hidden lg:inline">{transaction.subcategory}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{transaction.bank_type}</TableCell>
                      <TableCell className="text-right text-red-600 text-sm">
                        {transaction.debit ? fmt(transaction.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600 text-sm">
                        {transaction.credit ? fmt(transaction.credit) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditTransaction(transaction)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTransaction(transaction)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details below
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                placeholder="Transaction description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Subcategory</Label>
                <Input
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Debit Amount</Label>
                <Input
                  type="number"
                  value={formData.debit}
                  onChange={(e) => setFormData({ ...formData, debit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <Label>Credit Amount</Label>
                <Input
                  type="number"
                  value={formData.credit}
                  onChange={(e) => setFormData({ ...formData, credit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTransaction} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{deleteTransaction?.narration}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {deleteTransaction?.debit ? `Debit: ${fmt(deleteTransaction.debit)}` : `Credit: ${fmt(deleteTransaction?.credit || 0)}`}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
