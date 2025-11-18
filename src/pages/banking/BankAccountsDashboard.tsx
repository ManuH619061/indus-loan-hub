import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, GitCompare, Building2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface BankAccount {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  book_balance: number;
  statement_balance: number | null;
  last_reconciled_at: string | null;
  is_active: boolean;
}

export default function BankAccountsDashboard() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({ title: "Error loading accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getDifference = (account: BankAccount) => {
    if (!account.statement_balance) return null;
    return account.book_balance - account.statement_balance;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Banking & BRS</h1>
          <p className="text-muted-foreground mt-1">Manage your bank accounts and reconcile statements</p>
        </div>
        <Button onClick={() => navigate("/banking/add-account")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bank Account
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bank accounts added</h3>
            <p className="text-muted-foreground mb-4">Add your first bank account to start reconciliation</p>
            <Button onClick={() => navigate("/banking/add-account")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => {
            const difference = getDifference(account);
            return (
              <Card key={account.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {account.account_type === "CREDIT_CARD" ? (
                        <CreditCard className="h-8 w-8 text-primary" />
                      ) : (
                        <Building2 className="h-8 w-8 text-primary" />
                      )}
                      <div>
                        <CardTitle>{account.bank_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{account.account_number_masked}</p>
                      </div>
                    </div>
                    <Badge variant={account.account_type === "CREDIT_CARD" ? "secondary" : "default"}>
                      {account.account_type === "CREDIT_CARD" ? "Credit Card" : "Bank Account"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Book Balance</p>
                      <p className="text-lg font-semibold">₹{account.book_balance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Statement Balance</p>
                      <p className="text-lg font-semibold">
                        {account.statement_balance ? `₹${account.statement_balance.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Difference</p>
                      <p className={`text-lg font-semibold ${difference && difference !== 0 ? "text-destructive" : ""}`}>
                        {difference !== null ? `₹${Math.abs(difference).toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Reconciled</p>
                      <p className="text-sm">
                        {account.last_reconciled_at
                          ? new Date(account.last_reconciled_at).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigate(`/banking/import/${account.id}`)}>
                        <Upload className="h-3 w-3 mr-1" />
                        Import
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/banking/reconcile/${account.id}`)}>
                        <GitCompare className="h-3 w-3 mr-1" />
                        Reconcile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
