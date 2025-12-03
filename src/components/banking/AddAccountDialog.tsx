import { useState } from "react";
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

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded: () => void;
}

const accountTypes = [
  { value: "BANK", label: "Bank Account" },
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "WALLET", label: "Wallet" },
];

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
  "Other",
];

export default function AddAccountDialog({
  open,
  onOpenChange,
  onAccountAdded,
}: AddAccountDialogProps) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [bankName, setBankName] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setAccountName("");
    setAccountType("BANK");
    setBankName("");
    setCustomBankName("");
    setLastFourDigits("");
    setOpeningBalance("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountName) {
      toast({ title: "Please enter account name", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const finalBankName = bankName === "Other" ? customBankName : (bankName || accountName);
      const maskedNumber = lastFourDigits ? `****${lastFourDigits}` : "****";

      const { error } = await supabase.from("bank_accounts").insert({
        user_id: user.id,
        bank_name: finalBankName,
        account_type: accountType,
        account_number_masked: maskedNumber,
        account_number_full: lastFourDigits || null,
        book_balance: parseFloat(openingBalance) || 0,
        notes: notes || null,
      });

      if (error) throw error;

      toast({ title: "Account added successfully" });
      resetForm();
      onOpenChange(false);
      onAccountAdded();
    } catch (error) {
      console.error("Error adding account:", error);
      toast({ title: "Error adding account", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Add a new bank, cash, or card account
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name *</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., HDFC Savings, Petty Cash"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type *</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(accountType === "BANK" || accountType === "CREDIT_CARD") && (
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank (optional)" />
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
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                  />
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lastFour">Last 4 Digits (optional)</Label>
              <Input
                id="lastFour"
                value={lastFourDigits}
                onChange={(e) => setLastFourDigits(e.target.value.slice(0, 4))}
                placeholder="e.g., 1234"
                maxLength={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openingBalance">Opening Balance</Label>
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
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
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
