import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GitCompare, Check, X, Split, ArrowLeftRight, Tag, Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BankEntry {
  id: string;
  transaction_date: string;
  narration: string;
  reference: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  status: string;
  category: string | null;
}

interface AppTransaction {
  id: string;
  transaction_date: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  category: string;
}

export default function Reconciliation() {
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [appTransactions, setAppTransactions] = useState<AppTransaction[]>([]);
  const [selectedBank, setSelectedBank] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchData();
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch unmatched bank entries
      const { data: bankData, error: bankError } = await supabase
        .from("bank_statement_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("bank_account_id", selectedAccount)
        .eq("status", "UNMATCHED")
        .order("transaction_date", { ascending: false });

      if (bankError) throw bankError;
      setBankEntries(bankData || []);

      // Fetch unmatched app transactions
      const { data: appData, error: appError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .is("import_id", null)
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (appError) throw appError;
      setAppTransactions(appData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (selectedBank.length === 0 || selectedApp.length === 0) {
      toast({ title: "Select entries to match", variant: "destructive" });
      return;
    }

    if (selectedBank.length !== selectedApp.length) {
      toast({ title: "Select equal number of entries", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create matches
      for (let i = 0; i < selectedBank.length; i++) {
        const bankEntryId = selectedBank[i];
        const transactionId = selectedApp[i];

        // Update bank entry status
        await supabase
          .from("bank_statement_entries")
          .update({ status: "MATCHED", matched_transaction_id: transactionId })
          .eq("id", bankEntryId);

        // Create reconciliation match record
        await supabase.from("reconciliation_matches").insert({
          user_id: user.id,
          bank_account_id: selectedAccount,
          bank_entry_id: bankEntryId,
          transaction_id: transactionId,
          match_type: "MANUAL",
        });
      }

      toast({ title: "Entries matched successfully" });
      setSelectedBank([]);
      setSelectedApp([]);
      fetchData();
    } catch (error) {
      console.error("Error matching entries:", error);
      toast({ title: "Error matching entries", variant: "destructive" });
    }
  };

  const handleExclude = async (entryId: string) => {
    try {
      await supabase
        .from("bank_statement_entries")
        .update({ status: "EXCLUDED" })
        .eq("id", entryId);

      toast({ title: "Entry excluded" });
      fetchData();
    } catch (error) {
      console.error("Error excluding entry:", error);
      toast({ title: "Error excluding entry", variant: "destructive" });
    }
  };

  const handleAutoMatch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let matchCount = 0;

      for (const bankEntry of bankEntries) {
        const amount = bankEntry.debit || bankEntry.credit || 0;
        const isDebit = bankEntry.debit !== null;

        // Find matching transaction
        const match = appTransactions.find((txn) => {
          const txnAmount = txn.debit || txn.credit || 0;
          const txnIsDebit = txn.debit !== null;
          
          // Check amount and type match
          if (Math.abs(amount - txnAmount) > 0.01 || isDebit !== txnIsDebit) return false;
          
          // Check date within ±3 days
          const bankDate = new Date(bankEntry.transaction_date);
          const txnDate = new Date(txn.transaction_date);
          const daysDiff = Math.abs((bankDate.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return daysDiff <= 3;
        });

        if (match) {
          // Update bank entry
          await supabase
            .from("bank_statement_entries")
            .update({ status: "MATCHED", matched_transaction_id: match.id })
            .eq("id", bankEntry.id);

          // Create match record
          await supabase.from("reconciliation_matches").insert({
            user_id: user.id,
            bank_account_id: selectedAccount,
            bank_entry_id: bankEntry.id,
            transaction_id: match.id,
            match_type: "AUTO",
            match_confidence: 90,
          });

          matchCount++;
        }
      }

      toast({ title: `Auto-matched ${matchCount} entries` });
      fetchData();
    } catch (error) {
      console.error("Error auto-matching:", error);
      toast({ title: "Error during auto-match", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
          <p className="text-muted-foreground mt-1">Match bank statements with your transactions</p>
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
          <Button onClick={handleAutoMatch} variant="secondary">
            <GitCompare className="h-4 w-4 mr-2" />
            Auto Match
          </Button>
        </div>
      </div>

      <Tabs defaultValue="to-match" className="space-y-4">
        <TabsList>
          <TabsTrigger value="to-match">To be Matched ({bankEntries.length})</TabsTrigger>
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="excluded">Excluded</TabsTrigger>
        </TabsList>

        <TabsContent value="to-match" className="space-y-4">
          {selectedBank.length > 0 || selectedApp.length > 0 ? (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm">
                Selected: {selectedBank.length} bank entries, {selectedApp.length} transactions
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleMatch}>
                  <Check className="h-4 w-4 mr-2" />
                  Match Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setSelectedBank([]); setSelectedApp([]); }}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Bank Entries */}
            <Card>
              <CardHeader>
                <CardTitle>Bank Statement Entries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bankEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      checked={selectedBank.includes(entry.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBank([...selectedBank, entry.id]);
                        } else {
                          setSelectedBank(selectedBank.filter((id) => id !== entry.id));
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{entry.narration}</span>
                        <Badge variant={entry.debit ? "destructive" : "default"}>
                          {entry.debit ? `- ₹${entry.debit.toLocaleString()}` : `+ ₹${entry.credit?.toLocaleString()}`}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(entry.transaction_date).toLocaleDateString()}</span>
                        {entry.reference && <span>• {entry.reference}</span>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => handleExclude(entry.id)}>
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* App Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>App Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {appTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      checked={selectedApp.includes(txn.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedApp([...selectedApp, txn.id]);
                        } else {
                          setSelectedApp(selectedApp.filter((id) => id !== txn.id));
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{txn.narration}</span>
                        <Badge variant={txn.debit ? "destructive" : "default"}>
                          {txn.debit ? `- ₹${txn.debit.toLocaleString()}` : `+ ₹${txn.credit?.toLocaleString()}`}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(txn.transaction_date).toLocaleDateString()}</span>
                        <Badge variant="outline">{txn.category}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matched">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Matched entries will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excluded">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Excluded entries will appear here
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
