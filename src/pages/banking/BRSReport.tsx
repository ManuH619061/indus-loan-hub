import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface BRSData {
  openingBookBalance: number;
  receiptsNotInBank: number;
  paymentsNotInBank: number;
  bankEntriesNotInBooks: number;
  bankWithdrawalsNotInBooks: number;
  closingBookBalance: number;
  closingBankBalance: number;
  difference: number;
}

export default function BRSReport() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [brsData, setBrsData] = useState<BRSData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      generateBRS();
    }
  }, [selectedAccount]);

  const fetchBankAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setBankAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const generateBRS = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get account details
      const { data: account, error: accountError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", selectedAccount)
        .single();

      if (accountError) throw accountError;

      // Get unmatched bank entries (receipts not in books)
      const { data: unmatchedBankCredits, error: creditsError } = await supabase
        .from("bank_statement_entries")
        .select("credit")
        .eq("bank_account_id", selectedAccount)
        .eq("status", "UNMATCHED")
        .not("credit", "is", null);

      if (creditsError) throw creditsError;

      const receiptsNotInBank = unmatchedBankCredits.reduce((sum, entry) => sum + (entry.credit || 0), 0);

      // Get unmatched bank entries (payments not in books)
      const { data: unmatchedBankDebits, error: debitsError } = await supabase
        .from("bank_statement_entries")
        .select("debit")
        .eq("bank_account_id", selectedAccount)
        .eq("status", "UNMATCHED")
        .not("debit", "is", null);

      if (debitsError) throw debitsError;

      const paymentsNotInBank = unmatchedBankDebits.reduce((sum, entry) => sum + (entry.debit || 0), 0);

      // Calculate BRS
      const openingBookBalance = account.book_balance;
      const closingBankBalance = account.statement_balance || account.book_balance;
      const bankEntriesNotInBooks = 0; // Entries present in bank but not in books
      const bankWithdrawalsNotInBooks = 0; // Withdrawals in bank but not in books

      const closingBookBalance =
        openingBookBalance + receiptsNotInBank - paymentsNotInBank + bankEntriesNotInBooks - bankWithdrawalsNotInBooks;

      const difference = closingBookBalance - closingBankBalance;

      setBrsData({
        openingBookBalance,
        receiptsNotInBank,
        paymentsNotInBank,
        bankEntriesNotInBooks,
        bankWithdrawalsNotInBooks,
        closingBookBalance,
        closingBankBalance,
        difference,
      });
    } catch (error) {
      console.error("Error generating BRS:", error);
      toast({ title: "Error generating BRS report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    toast({ title: "PDF export coming soon" });
  };

  const handleExportExcel = () => {
    toast({ title: "Excel export coming soon" });
  };

  const selectedAccountData = bankAccounts.find((acc) => acc.id === selectedAccount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Reconciliation Statement</h1>
          <p className="text-muted-foreground mt-1">Generate professional BRS reports</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number_masked}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExportPDF} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={handleExportExcel} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Generating report...</div>
      ) : brsData && selectedAccountData ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Bank Reconciliation Statement - {selectedAccountData.bank_name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Account: {selectedAccountData.account_number_masked}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-semibold">Opening Balance (As per Books)</span>
                <span className="font-semibold">₹{brsData.openingBookBalance.toLocaleString()}</span>
              </div>

              <Separator />

              <div className="space-y-2 pl-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Add:</h3>
                <div className="flex items-center justify-between">
                  <span>Receipts not reflected in bank</span>
                  <span className="text-green-600">+ ₹{brsData.receiptsNotInBank.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bank entries not in books</span>
                  <span className="text-green-600">+ ₹{brsData.bankEntriesNotInBooks.toLocaleString()}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 pl-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Less:</h3>
                <div className="flex items-center justify-between">
                  <span>Payments not reflected in bank</span>
                  <span className="text-red-600">- ₹{brsData.paymentsNotInBank.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bank withdrawals not in books</span>
                  <span className="text-red-600">- ₹{brsData.bankWithdrawalsNotInBooks.toLocaleString()}</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-semibold">Closing Balance (As per Books)</span>
                <span className="font-semibold">₹{brsData.closingBookBalance.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">Closing Balance (As per Bank Statement)</span>
                <span className="font-semibold">₹{brsData.closingBankBalance.toLocaleString()}</span>
              </div>

              <div
                className={`flex items-center justify-between p-3 rounded-lg ${
                  Math.abs(brsData.difference) < 0.01 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
                }`}
              >
                <span className="font-semibold">Difference</span>
                <span className="font-semibold">
                  {brsData.difference >= 0 ? "+" : "-"} ₹{Math.abs(brsData.difference).toLocaleString()}
                </span>
              </div>

              {Math.abs(brsData.difference) < 0.01 ? (
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                  <p className="text-green-700 dark:text-green-400 font-medium">
                    ✓ Books are reconciled with bank statement
                  </p>
                </div>
              ) : (
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                  <p className="text-yellow-700 dark:text-yellow-400 font-medium">
                    ⚠ There is a difference of ₹{Math.abs(brsData.difference).toLocaleString()} to be reconciled
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
