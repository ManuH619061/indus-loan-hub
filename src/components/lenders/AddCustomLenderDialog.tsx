import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AddCustomLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderData: {
    name: string;
    type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER";
    logo_url?: string;
    website?: string;
    contact: string;
    notes: string;
  };
  onDataChange: (data: any) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function AddCustomLenderDialog({
  open,
  onOpenChange,
  lenderData,
  onDataChange,
  onSubmit,
  loading,
}: AddCustomLenderDialogProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && lenderData.name.trim() && !loading) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lender</DialogTitle>
        </DialogHeader>
        <div className="space-y-4" onKeyPress={handleKeyPress}>
          <div className="space-y-2">
            <Label>Lender Name *</Label>
            <Input
              value={lenderData.name}
              onChange={(e) => onDataChange({ ...lenderData, name: e.target.value })}
              placeholder="e.g., HDFC Bank, Navi, Slice"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Lender Type *</Label>
            <Select
              value={lenderData.type}
              onValueChange={(value: any) => onDataChange({ ...lenderData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="OTHER">App / Fintech</SelectItem>
                <SelectItem value="NBFC">NBFC</SelectItem>
                <SelectItem value="FRIEND">Friend / Family</SelectItem>
                <SelectItem value="CARD">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contact Number (optional)</Label>
            <Input
              value={lenderData.contact}
              onChange={(e) => onDataChange({ ...lenderData, contact: e.target.value })}
              placeholder="Phone or email"
              type="tel"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={lenderData.notes}
              onChange={(e) => onDataChange({ ...lenderData, notes: e.target.value })}
              placeholder="Any additional notes about this lender"
              rows={2}
            />
          </div>

          <Button onClick={onSubmit} disabled={loading || !lenderData.name.trim()} className="w-full">
            {loading ? "Adding..." : "Add Lender"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
