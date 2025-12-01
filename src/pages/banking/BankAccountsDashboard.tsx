import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ChevronDown, 
  Building2, 
  CreditCard, 
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BankAccount {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  book_balance: number;
  statement_balance: number | null;
  last_reconciled_at: string | null;
  is_active: boolean;
  icon_url: string | null;
}

interface Transaction {
  debit: number | null;
  credit: number | null;
  transaction_date: string;
}

export default function BankAccountsDashboard() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30days");
  const [showBankingSummary, setShowBankingSummary] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [selectedAccount, dateRange]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Fetch transactions based on filters
      const dateFilter = getDateFilter();
      let query = supabase
        .from("bank_statement_entries")
        .select("debit, credit, transaction_date")
        .eq("user_id", user.id);

      if (selectedAccount !== "all") {
        query = query.eq("bank_account_id", selectedAccount);
      }

      if (dateFilter.start) {
        query = query.gte("transaction_date", dateFilter.start);
      }
      if (dateFilter.end) {
        query = query.lte("transaction_date", dateFilter.end);
      }

      const { data: transData, error: transError } = await query;
      if (transError) throw transError;
      setTransactions(transData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case "30days":
        start.setDate(now.getDate() - 30);
        break;
      case "currentMonth":
        start.setDate(1);
        break;
      case "90days":
        start.setDate(now.getDate() - 90);
        break;
      default:
        return { start: null, end: null };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    };
  };

  const calculateSummary = () => {
    const filteredAccounts = selectedAccount === "all" 
      ? accounts 
      : accounts.filter(a => a.id === selectedAccount);

    const cashInHand = filteredAccounts
      .filter(a => a.account_type === "CASH")
      .reduce((sum, a) => sum + a.book_balance, 0);

    const bankBalance = filteredAccounts
      .filter(a => a.account_type === "BANK")
      .reduce((sum, a) => sum + a.book_balance, 0);

    const creditCards = filteredAccounts
      .filter(a => a.account_type === "CREDIT_CARD")
      .reduce((sum, a) => sum + a.book_balance, 0);

    const totalInflows = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
    const totalOutflows = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const netChange = totalInflows - totalOutflows;

    return { cashInHand, bankBalance, creditCards, totalInflows, totalOutflows, netChange };
  };

  const summary = calculateSummary();

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "CREDIT_CARD":
        return CreditCard;
      case "CASH":
        return WalletIcon;
      default:
        return Building2;
    }
  };

  const getDifference = (account: BankAccount) => {
    if (!account.statement_balance) return null;
    return account.book_balance - account.statement_balance;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Banking Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor your accounts and transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                {account.bank_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="currentMonth">Current month</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cash in Hand</p>
                <p className="text-2xl font-bold mt-1">₹{summary.cashInHand.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <WalletIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bank Balance</p>
                <p className="text-2xl font-bold mt-1">₹{summary.bankBalance.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Credit Cards</p>
                <p className="text-2xl font-bold mt-1">₹{Math.abs(summary.creditCards).toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banking Summary */}
      <Collapsible open={showBankingSummary} onOpenChange={setShowBankingSummary}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Banking Summary</CardTitle>
              <ChevronDown className={`h-5 w-5 transition-transform ${showBankingSummary ? "" : "-rotate-90"}`} />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Inflows</p>
                    <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                      ₹{summary.totalInflows.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Outflows</p>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                      ₹{summary.totalOutflows.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    summary.netChange >= 0 
                      ? "bg-blue-100 dark:bg-blue-900/20" 
                      : "bg-orange-100 dark:bg-orange-900/20"
                  }`}>
                    <TrendingUp className={`h-5 w-5 ${
                      summary.netChange >= 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-orange-600 dark:text-orange-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Change</p>
                    <p className={`text-xl font-semibold ${
                      summary.netChange >= 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-orange-600 dark:text-orange-400"
                    }`}>
                      ₹{Math.abs(summary.netChange).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Active Accounts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Accounts</h2>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bank accounts added</h3>
              <p className="text-muted-foreground mb-4">Add your first bank account to start tracking</p>
              <Button onClick={() => navigate("/banking/add-account")}>
                Add Bank Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => {
              const Icon = getAccountIcon(account.account_type);
              const difference = getDifference(account);
              const hasDifference = difference !== null && difference !== 0;

              return (
                <Card 
                  key={account.id} 
                  className="hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/expenses`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                          <Icon className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-base">{account.bank_name}</p>
                            {hasDifference && (
                              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{account.account_number_masked}</p>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Amount in App</p>
                              <p className="text-sm font-semibold">₹{account.book_balance.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Amount in Bank</p>
                              <p className="text-sm font-semibold">
                                {account.statement_balance 
                                  ? `₹${account.statement_balance.toLocaleString()}` 
                                  : "—"}
                              </p>
                            </div>
                          </div>

                          {hasDifference && (
                            <div className="mt-2">
                              <Badge variant="destructive" className="text-xs">
                                Difference: ₹{Math.abs(difference!).toLocaleString()}
                              </Badge>
                            </div>
                          )}

                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/banking/import/${account.id}`);
                              }}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Import
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/banking/reconcile`);
                              }}
                            >
                              Reconcile
                            </Button>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
