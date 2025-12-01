import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const indianBanks = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Yes Bank",
  "IndusInd Bank",
  "IDBI Bank",
  "Bank of Baroda",
  "Punjab National Bank",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "Indian Overseas Bank",
  "UCO Bank",
  "Bank of Maharashtra",
  "Other",
];

interface BankAccount {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  account_number_full: string | null;
  ifsc_code: string | null;
  branch: string | null;
  book_balance: number;
  notes: string | null;
}

interface EditBankAccountDialogProps {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditBankAccountDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: EditBankAccountDialogProps) {
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [bookBalance, setBookBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (account) {
      setBankName(account.bank_name);
      setAccountType(account.account_type);
      setAccountNumber(account.account_number_full || "");
      setIfscCode(account.ifsc_code || "");
      setBranch(account.branch || "");
      setBookBalance(account.book_balance.toString());
      setNotes(account.notes || "");
    }
  }, [account]);

  const maskAccountNumber = (number: string) => {
    if (number.length < 4) return number;
    return "****" + number.slice(-4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account || !bankName || !accountNumber) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("bank_accounts")
        .update({
          bank_name: bankName,
          account_type: accountType,
          account_number_masked: maskAccountNumber(accountNumber),
          account_number_full: accountNumber,
          ifsc_code: ifscCode || null,
          branch: branch || null,
          book_balance: parseFloat(bookBalance) || 0,
          notes: notes || null,
        })
        .eq("id", account.id);

      if (error) throw error;

      toast({ title: "Bank account updated successfully" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating account:", error);
      toast({ title: "Error updating account", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bank Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type *</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="accountType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank Account</SelectItem>
                <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankName">Bank/Card Name *</Label>
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger id="bankName">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {indianBanks.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankName === "Other" && (
              <Input
                placeholder="Enter bank name"
                value={bankName === "Other" ? "" : bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account/Card Number *</Label>
            <Input
              id="accountNumber"
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter full account number"
            />
            {accountNumber && (
              <p className="text-xs text-muted-foreground">
                Will be displayed as: {maskAccountNumber(accountNumber)}
              </p>
            )}
          </div>

          {accountType === "BANK" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ifscCode">IFSC Code</Label>
                <Input
                  id="ifscCode"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SBIN0001234"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch name"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="bookBalance">Current Balance (As per Books)</Label>
            <Input
              id="bookBalance"
              type="number"
              step="0.01"
              value={bookBalance}
              onChange={(e) => setBookBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
