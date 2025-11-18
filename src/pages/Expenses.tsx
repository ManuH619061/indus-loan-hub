import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, TrendingUp, TrendingDown, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ResponsiveChartLegacy } from "@/components/ui/responsive-chart";
import { ResponsiveTableSimple } from "@/components/ui/responsive-table";

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
}

export default function Expenses() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (session) {
      fetchTransactions();
    }
  }, [session, dateRange, categoryFilter, bankFilter]);

  const fetchTransactions = async () => {
    if (!session) return;

    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('transaction_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('transaction_date', format(dateRange.end, 'yyyy-MM-dd'))
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const banks = [...new Set(transactions.map(t => t.bank_type))];
  const categories = [...new Set(transactions.map(t => t.category))];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses & Transactions</h1>
          <p className="text-muted-foreground mt-2">
            View and analyze your imported transactions
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">{formatINR(totalIncome)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatINR(totalExpenses)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">EMI Payments</p>
              <p className="text-2xl font-bold text-orange-600">{formatINR(totalEMI)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-bold mb-4 text-sm sm:text-base">Spending by Category</h3>
          <ResponsiveChartLegacy height={300} minHeight={250}>
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
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatINR(Number(value))} />
            </PieChart>
          </ResponsiveChartLegacy>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-bold mb-4 text-sm sm:text-base">Income vs Expenses</h3>
          <ResponsiveChartLegacy height={300} minHeight={250}>
            <BarChart
              data={[
                { name: 'Income', amount: totalIncome },
                { name: 'Expenses', amount: totalExpenses },
                { name: 'EMI', amount: totalEMI },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveChartLegacy>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="p-0">
        <ResponsiveTableSimple minWidth={800}>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.transaction_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="max-w-xs truncate">{transaction.narration}</TableCell>
                  <TableCell>
                    <Badge variant={transaction.category === 'Income' ? 'default' : 'secondary'}>
                      {transaction.category}
                    </Badge>
                    {transaction.subcategory && (
                      <span className="text-xs text-muted-foreground ml-2">{transaction.subcategory}</span>
                    )}
                  </TableCell>
                  <TableCell>{transaction.bank_type}</TableCell>
                  <TableCell className="text-right text-red-600">
                    {transaction.debit ? formatINR(transaction.debit) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {transaction.credit ? formatINR(transaction.credit) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.balance ? formatINR(transaction.balance) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </ResponsiveTableSimple>
      </Card>
    </div>
  );
}