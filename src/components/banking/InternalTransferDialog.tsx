import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  book_balance: number;
}

interface InternalTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete: () => void;
}

export default function InternalTransferDialog({
  open,
  onOpenChange,
  onTransferComplete,
}: InternalTransferDialogProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_type, account_number_masked, book_balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("bank_name");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const resetForm = () => {
    setFromAccount("");
    setToAccount("");
    setAmount("");
    setTransferDate(new Date().toISOString().split('T')[0]);
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccount || !toAccount || !amount) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (fromAccount === toAccount) {
      toast({ title: "From and To accounts must be different", variant: "destructive" });
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0) {
      toast({ title: "Amount must be greater than 0", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fromAcc = accounts.find(a => a.id === fromAccount);
      const toAcc = accounts.find(a => a.id === toAccount);

      const transferDesc = description || `Transfer from ${fromAcc?.bank_name} to ${toAcc?.bank_name}`;

      // Create two linked transactions
      // Transaction 1: Transfer Out (Debit from source account)
      const { error: error1 } = await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_date: transferDate,
        narration: `Transfer Out - ${transferDesc}`,
        debit: transferAmount,
        credit: 0,
        bank_type: fromAcc?.account_type || "BANK",
        account_name: fromAcc?.bank_name,
        category: "Transfer",
        subcategory: "Internal Transfer",
        is_transfer: true,
        is_emi: false,
      });

      if (error1) throw error1;

      // Transaction 2: Transfer In (Credit to destination account)
      const { error: error2 } = await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_date: transferDate,
        narration: `Transfer In - ${transferDesc}`,
        debit: 0,
        credit: transferAmount,
        bank_type: toAcc?.account_type || "BANK",
        account_name: toAcc?.bank_name,
        category: "Transfer",
        subcategory: "Internal Transfer",
        is_transfer: true,
        is_emi: false,
      });

      if (error2) throw error2;

      // Update account balances
      // Decrease from account balance
      const { error: updateError1 } = await supabase
        .from("bank_accounts")
        .update({ book_balance: (fromAcc?.book_balance || 0) - transferAmount })
        .eq("id", fromAccount);

      if (updateError1) throw updateError1;

      // Increase to account balance
      const { error: updateError2 } = await supabase
        .from("bank_accounts")
        .update({ book_balance: (toAcc?.book_balance || 0) + transferAmount })
        .eq("id", toAccount);

      if (updateError2) throw updateError2;

      toast({ title: "Transfer completed successfully" });
      resetForm();
      onOpenChange(false);
      onTransferComplete();
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast({ title: "Error creating transfer", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fromAccountData = accounts.find(a => a.id === fromAccount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Internal Transfer</DialogTitle>
          <DialogDescription>
            Transfer funds between your accounts (Contra Entry)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fromAccount">From Account *</Label>
              <Select value={fromAccount} onValueChange={setFromAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} ({account.account_number_masked}) - ₹{account.book_balance.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fromAccount && (
              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="toAccount">To Account *</Label>
              <Select value={toAccount} onValueChange={setToAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(a => a.id !== fromAccount)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bank_name} ({account.account_number_masked}) - ₹{account.book_balance.toLocaleString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {fromAccountData && parseFloat(amount) > fromAccountData.book_balance && (
                <p className="text-xs text-destructive">
                  Amount exceeds available balance (₹{fromAccountData.book_balance.toLocaleString()})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transferDate">Date *</Label>
              <Input
                id="transferDate"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., ATM withdrawal, Fund transfer..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
