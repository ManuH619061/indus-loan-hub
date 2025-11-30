import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import LenderLogoUpload from "./LenderLogoUpload";

interface LenderData {
  id: string;
  name: string;
  type: string;
  logo_url?: string | null;
  website?: string | null;
  contact?: string | null;
  notes?: string | null;
  upi_vpa?: string | null;
}

interface EditLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lender: LenderData | null;
  onSave: (lender: LenderData) => Promise<void>;
  loading: boolean;
}

export default function EditLenderDialog({
  open,
  onOpenChange,
  lender,
  onSave,
  loading,
}: EditLenderDialogProps) {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    type: "BANK" as string,
    logo_url: "",
    website: "",
    contact: "",
    notes: "",
    upi_vpa: "",
  });

  useEffect(() => {
    if (lender) {
      setFormData({
        id: lender.id,
        name: lender.name,
        type: lender.type,
        logo_url: lender.logo_url || "",
        website: lender.website || "",
        contact: lender.contact || "",
        notes: lender.notes || "",
        upi_vpa: lender.upi_vpa || "",
      });
    }
  }, [lender]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lender</DialogTitle>
          <DialogDescription>
            Update lender information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Lender Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., HDFC Bank"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger id="edit-type">
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

          <LenderLogoUpload
            lenderName={formData.name}
            logoUrl={formData.logo_url}
            onLogoChange={(url) => setFormData({ ...formData, logo_url: url })}
            disabled={loading}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              type="url"
              value={formData.website || ""}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact">Contact</Label>
            <Input
              id="edit-contact"
              value={formData.contact || ""}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="Phone or email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-upi">UPI VPA</Label>
            <Input
              id="edit-upi"
              value={formData.upi_vpa || ""}
              onChange={(e) => setFormData({ ...formData, upi_vpa: e.target.value })}
              placeholder="lender@upi"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
