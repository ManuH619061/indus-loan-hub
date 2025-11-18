import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function AddBankAccount() {
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [bookBalance, setBookBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const maskAccountNumber = (number: string) => {
    if (number.length < 4) return number;
    return "****" + number.slice(-4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName || !accountNumber) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("bank_accounts").insert({
        user_id: user.id,
        bank_name: bankName,
        account_type: accountType,
        account_number_masked: maskAccountNumber(accountNumber),
        account_number_full: accountNumber, // In production, encrypt this
        ifsc_code: ifscCode || null,
        branch: branch || null,
        book_balance: parseFloat(bookBalance) || 0,
        notes: notes || null,
      });

      if (error) throw error;

      toast({ title: "Bank account added successfully" });
      navigate("/banking/accounts");
    } catch (error) {
      console.error("Error adding account:", error);
      toast({ title: "Error adding account", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Bank Account</h1>
        <p className="text-muted-foreground mt-1">Add a new bank account or credit card for reconciliation</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
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

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/banking/accounts")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
