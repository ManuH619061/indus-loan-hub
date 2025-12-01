import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  FileText, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  CreditCard,
  Wallet,
  Receipt,
  Printer,
  FileDown
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/currency";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
  book_balance: number;
  statement_balance: number | null;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'EMI' | 'Loan Payment';
  linkedEntity: string | null; // Loan name or Budget category
  debit: number;
  credit: number;
  runningBalance: number;
  source: 'bank' | 'payment' | 'expense';
}

interface BRSSummary {
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  closingBalance: number;
  transactionCount: number;
}

export default function BRSReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [dateMode, setDateMode] = useState<'current' | 'custom'>('current');
  const [startDate, setStartDate] = useState<string>(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<BRSSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBankAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (selectedAccount) {
      generateBRSReport();
    }
  }, [selectedAccount, startDate, endDate]);

  useEffect(() => {
    // Update dates when switching modes
    if (dateMode === 'current') {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    }
  }, [dateMode]);

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number_masked, book_balance, statement_balance")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order('bank_name');

      if (error) throw error;
      setBankAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({ title: "Error loading bank accounts", variant: "destructive" });
    }
  };

  const generateBRSReport = async () => {
    try {
      setLoading(true);
      
      // Get account details for opening balance
      const { data: account } = await supabase
        .from("bank_accounts")
        .select("book_balance, statement_balance")
        .eq("id", selectedAccount)
        .single();

      if (!account) return;

      // Fetch bank statement entries for this account
      const { data: bankTxns } = await supabase
        .from("bank_statement_entries")
        .select("id, transaction_date, narration, debit, credit, category")
        .eq("user_id", user!.id)
        .eq("bank_account_id", selectedAccount)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: true });

      // Fetch loan payments for this period
      const { data: payments } = await supabase
        .from("payments")
        .select(`
          id, 
          paid_on, 
          amount, 
          payment_type,
          reference,
          loans:loan_id (
            id,
            loan_name
          )
        `)
        .gte("paid_on", startDate)
        .lte("paid_on", endDate)
        .order("paid_on", { ascending: true });

      // Combine all transactions into a unified format
      const allTransactions: TransactionRow[] = [];
      
      // Add bank transactions
      (bankTxns || []).forEach(txn => {
        allTransactions.push({
          id: txn.id,
          date: txn.transaction_date,
          description: txn.narration || 'Bank Transaction',
          type: txn.credit ? 'Income' : 'Expense',
          linkedEntity: txn.category || null,
          debit: txn.debit || 0,
          credit: txn.credit || 0,
          runningBalance: 0, // Will calculate later
          source: 'bank'
        });
      });

      // Add loan payments
      (payments || []).forEach(payment => {
        const loanData = payment.loans as any;
        allTransactions.push({
          id: payment.id,
          date: payment.paid_on,
          description: `Loan Payment - ${payment.reference || 'EMI'}`,
          type: payment.payment_type === 'EMI' ? 'EMI' : 'Loan Payment',
          linkedEntity: loanData?.loan_name || null,
          debit: payment.amount,
          credit: 0,
          runningBalance: 0, // Will calculate later
          source: 'payment'
        });
      });

      // Sort all transactions by date
      allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let runningBalance = account.book_balance;
      allTransactions.forEach(txn => {
        runningBalance = runningBalance + txn.credit - txn.debit;
        txn.runningBalance = runningBalance;
      });

      // Calculate summary
      const totalInflows = allTransactions.reduce((sum, txn) => sum + txn.credit, 0);
      const totalOutflows = allTransactions.reduce((sum, txn) => sum + txn.debit, 0);
      const closingBalance = account.book_balance + totalInflows - totalOutflows;

      setSummary({
        openingBalance: account.book_balance,
        totalInflows,
        totalOutflows,
        closingBalance,
        transactionCount: allTransactions.length
      });

      setTransactions(allTransactions);
    } catch (error) {
      console.error("Error generating BRS report:", error);
      toast({ title: "Error generating report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary || transactions.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const selectedAccName = bankAccounts.find(a => a.id === selectedAccount)?.bank_name || "All Accounts";
    
    // Prepare data for export
    const exportData = [
      ["Bank Reconciliation Statement"],
      [`Account: ${selectedAccName}`],
      [`Period: ${startDate} to ${endDate}`],
      [""],
      ["Summary"],
      ["Opening Balance", formatINR(summary.openingBalance)],
      ["Total Inflows", formatINR(summary.totalInflows)],
      ["Total Outflows", formatINR(summary.totalOutflows)],
      ["Closing Balance", formatINR(summary.closingBalance)],
      [""],
      ["Transactions"],
      ["Date", "Description", "Type", "Linked To", "Debit", "Credit", "Running Balance"],
      ...transactions.map(t => [
        format(new Date(t.date), 'MMM dd, yyyy'),
        t.description,
        t.type,
        t.linkedEntity || "-",
        t.debit ? formatINR(t.debit) : "-",
        t.credit ? formatINR(t.credit) : "-",
        formatINR(t.runningBalance)
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BRS Report");
    XLSX.writeFile(wb, `BRS_Report_${selectedAccName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: "Report exported successfully" });
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedAccountData = bankAccounts.find((acc) => acc.id === selectedAccount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">BRS Report</h1>
          <p className="text-muted-foreground mt-2">Bank Reconciliation Statement with detailed transaction breakdown</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} variant="outline" size="lg">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExport} variant="outline" size="lg">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Select account and date range for the report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Bank Account Selection */}
            <div className="space-y-2">
              <Label htmlFor="account">Bank Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {account.bank_name} - {account.account_number_masked}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="dateMode">Period</Label>
              <Select value={dateMode} onValueChange={(v) => setDateMode(v as 'current' | 'custom')}>
                <SelectTrigger id="dateMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={dateMode === 'current'}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={dateMode === 'current'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : summary && selectedAccountData ? (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedAccountData.bank_name} - {selectedAccountData.account_number_masked}
              </CardTitle>
              <CardDescription>
                Period: {format(new Date(startDate), 'MMM dd, yyyy')} to {format(new Date(endDate), 'MMM dd, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {/* Opening Balance */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Opening Balance</p>
                  <p className="text-2xl font-bold">{formatINR(summary.openingBalance)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Start of period</p>
                </div>

                {/* Total Inflows */}
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-600 dark:text-green-400">Total Inflows</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatINR(summary.totalInflows)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Credits received</p>
                </div>

                {/* Total Outflows */}
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-600 dark:text-red-400">Total Outflows</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatINR(summary.totalOutflows)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Debits paid</p>
                </div>

                {/* Closing Balance */}
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm text-primary mb-1">Closing Balance</p>
                  <p className="text-2xl font-bold text-primary">{formatINR(summary.closingBalance)}</p>
                  <p className="text-xs text-muted-foreground mt-1">End of period</p>
                </div>
              </div>

              {/* Balance Movement Summary */}
              <Separator className="my-6" />
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Balance Movement</h3>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm">Opening Balance</span>
                    <span className="font-semibold">{formatINR(summary.openingBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg">
                    <span className="text-sm flex items-center gap-2">
                      <span className="text-green-600">+</span> Total Inflows
                    </span>
                    <span className="font-semibold text-green-600">{formatINR(summary.totalInflows)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg">
                    <span className="text-sm flex items-center gap-2">
                      <span className="text-red-600">-</span> Total Outflows
                    </span>
                    <span className="font-semibold text-red-600">{formatINR(summary.totalOutflows)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <span className="font-semibold">Closing Balance</span>
                    <span className="font-bold text-primary">{formatINR(summary.closingBalance)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Transaction Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Details
              </CardTitle>
              <CardDescription>
                All transactions for the selected period ({summary.transactionCount} transactions)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead>Linked To</TableHead>
                      <TableHead className="text-right w-[120px]">Debit</TableHead>
                      <TableHead className="text-right w-[120px]">Credit</TableHead>
                      <TableHead className="text-right w-[140px]">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((txn) => (
                        <TableRow key={txn.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-sm">
                            {format(new Date(txn.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="font-medium text-sm truncate">{txn.description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                txn.type === 'Income' ? 'default' : 
                                txn.type === 'EMI' || txn.type === 'Loan Payment' ? 'destructive' : 
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {txn.type === 'EMI' && <Wallet className="h-3 w-3 mr-1" />}
                              {txn.type === 'Income' && <ArrowDownRight className="h-3 w-3 mr-1" />}
                              {txn.type === 'Expense' && <Receipt className="h-3 w-3 mr-1" />}
                              {txn.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {txn.linkedEntity || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {txn.debit > 0 ? (
                              <span className="text-red-600">{formatINR(txn.debit)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {txn.credit > 0 ? (
                              <span className="text-green-600">{formatINR(txn.credit)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatINR(txn.runningBalance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {bankAccounts.length === 0 
                ? "No bank accounts found. Add a bank account to generate reports." 
                : "Select a bank account to generate the BRS report"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
