import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddCustomLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderData: {
    name: string;
    type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER";
    logo_url: string;
    website: string;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Lender</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lender Name *</Label>
            <Input
              value={lenderData.name}
              onChange={(e) => onDataChange({ ...lenderData, name: e.target.value })}
              placeholder="e.g., Local Credit Union"
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={lenderData.type}
              onValueChange={(value: any) => onDataChange({ ...lenderData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="NBFC">NBFC</SelectItem>
                <SelectItem value="CARD">Credit Card</SelectItem>
                <SelectItem value="FRIEND">Friend/Family</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Logo URL (optional)</Label>
            <Input
              value={lenderData.logo_url}
              onChange={(e) => onDataChange({ ...lenderData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="space-y-2">
            <Label>Website (optional)</Label>
            <Input
              value={lenderData.website}
              onChange={(e) => onDataChange({ ...lenderData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact (optional)</Label>
            <Input
              value={lenderData.contact}
              onChange={(e) => onDataChange({ ...lenderData, contact: e.target.value })}
              placeholder="Phone or email"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={lenderData.notes}
              onChange={(e) => onDataChange({ ...lenderData, notes: e.target.value })}
              placeholder="Any additional notes"
            />
          </div>
          <Button onClick={onSubmit} disabled={loading || !lenderData.name} className="w-full">
            {loading ? "Adding..." : "Add Lender"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
