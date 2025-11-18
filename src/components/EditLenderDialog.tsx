import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Validation schema with security constraints
const lenderEditSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Lender name is required")
    .max(100, "Lender name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-&.()]+$/, "Name contains invalid characters"),
  app_display_name: z.string()
    .trim()
    .max(100, "Display name must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  type: z.enum(["BANK", "NBFC", "CARD", "FRIEND", "OTHER"]),
  contact: z.string()
    .trim()
    .max(100, "Contact must be less than 100 characters")
    .refine((val) => !val || /^[\d\s\-+()]+$/.test(val), "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  website: z.string()
    .trim()
    .max(255, "Website URL must be less than 255 characters")
    .refine((val) => !val || /^https?:\/\/.+\..+/.test(val), "Invalid website URL")
    .optional()
    .or(z.literal("")),
  upi_vpa: z.string()
    .trim()
    .max(100, "UPI VPA must be less than 100 characters")
    .refine((val) => !val || /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(val), "Invalid UPI VPA format")
    .optional()
    .or(z.literal("")),
  app_link: z.string()
    .trim()
    .max(255, "App link must be less than 255 characters")
    .refine((val) => !val || /^https?:\/\/.+/.test(val), "Invalid app link URL")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .trim()
    .max(500, "Notes must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  requires_sanction_letter: z.boolean(),
  requires_noc_on_close: z.boolean(),
});

interface EditLenderDialogProps {
  lender: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditLenderDialog = ({ lender, open, onOpenChange, onSuccess }: EditLenderDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: lender.name || "",
    app_display_name: lender.app_display_name || "",
    type: lender.type || "BANK",
    contact: lender.contact || "",
    website: lender.website || "",
    upi_vpa: lender.upi_vpa || "",
    app_link: lender.app_link || "",
    notes: lender.notes || "",
    requires_sanction_letter: lender.requires_sanction_letter ?? true,
    requires_noc_on_close: lender.requires_noc_on_close ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lender) {
      setFormData({
        name: lender.name || "",
        app_display_name: lender.app_display_name || "",
        type: lender.type || "BANK",
        contact: lender.contact || "",
        website: lender.website || "",
        upi_vpa: lender.upi_vpa || "",
        app_link: lender.app_link || "",
        notes: lender.notes || "",
        requires_sanction_letter: lender.requires_sanction_letter ?? true,
        requires_noc_on_close: lender.requires_noc_on_close ?? true,
      });
      setErrors({});
    }
  }, [lender, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate data with security checks
      const validatedData = lenderEditSchema.parse(data);

      const updateData = {
        name: validatedData.name,
        app_display_name: validatedData.app_display_name || null,
        type: validatedData.type,
        contact: validatedData.contact || null,
        website: validatedData.website || null,
        upi_vpa: validatedData.upi_vpa || null,
        app_link: validatedData.app_link || null,
        notes: validatedData.notes || null,
        requires_sanction_letter: validatedData.requires_sanction_letter,
        requires_noc_on_close: validatedData.requires_noc_on_close,
      };

      const { error } = await supabase
        .from("lenders")
        .update(updateData)
        .eq("id", lender.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lenders"] });
      queryClient.invalidateQueries({ queryKey: ["lender", lender.id] });
      toast.success("Lender updated successfully");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error("Please fix validation errors");
      } else {
        toast.error("Failed to update lender");
        console.error(error);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lender</DialogTitle>
          <DialogDescription>Update lender information and preferences</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact & Links</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Lender Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Bank, Bajaj Finserv"
                  maxLength={100}
                  required
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                <p className="text-xs text-muted-foreground">Official name of the lender</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app_display_name">App Display Name</Label>
                <Input
                  id="app_display_name"
                  value={formData.app_display_name}
                  onChange={(e) => setFormData({ ...formData, app_display_name: e.target.value })}
                  placeholder="e.g., HDFC Loans, Bajaj FinServ"
                  maxLength={100}
                />
                {errors.app_display_name && <p className="text-xs text-destructive">{errors.app_display_name}</p>}
                <p className="text-xs text-muted-foreground">Name as shown in their app (optional)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Lender Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank</SelectItem>
                    <SelectItem value="NBFC">NBFC (Non-Banking Financial Company)</SelectItem>
                    <SelectItem value="CARD">Credit Card Company</SelectItem>
                    <SelectItem value="FRIEND">Friend/Family</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this lender"
                  rows={4}
                  maxLength={500}
                />
                {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
                <p className="text-xs text-muted-foreground">{formData.notes.length}/500 characters</p>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  type="tel"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="e.g., +91 1800 XXX XXXX"
                  maxLength={100}
                />
                {errors.contact && <p className="text-xs text-destructive">{errors.contact}</p>}
                <p className="text-xs text-muted-foreground">Customer support phone number</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.example.com"
                  maxLength={255}
                />
                {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                <p className="text-xs text-muted-foreground">Official website URL</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upi_vpa">UPI VPA</Label>
                <Input
                  id="upi_vpa"
                  value={formData.upi_vpa}
                  onChange={(e) => setFormData({ ...formData, upi_vpa: e.target.value })}
                  placeholder="e.g., lender@paytm"
                  maxLength={100}
                />
                {errors.upi_vpa && <p className="text-xs text-destructive">{errors.upi_vpa}</p>}
                <p className="text-xs text-muted-foreground">UPI ID for payments</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app_link">App Link</Label>
                <Input
                  id="app_link"
                  type="url"
                  value={formData.app_link}
                  onChange={(e) => setFormData({ ...formData, app_link: e.target.value })}
                  placeholder="https://play.google.com/store/apps/..."
                  maxLength={255}
                />
                {errors.app_link && <p className="text-xs text-destructive">{errors.app_link}</p>}
                <p className="text-xs text-muted-foreground">Link to mobile app on Play Store/App Store</p>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Switch
                    id="requires_sanction_letter"
                    checked={formData.requires_sanction_letter}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_sanction_letter: checked })}
                  />
                  <div className="flex-1">
                    <Label htmlFor="requires_sanction_letter" className="cursor-pointer font-semibold">
                      Requires Sanction Letter
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Does this lender require a sanction letter for loan approval?
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Switch
                    id="requires_noc_on_close"
                    checked={formData.requires_noc_on_close}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_noc_on_close: checked })}
                  />
                  <div className="flex-1">
                    <Label htmlFor="requires_noc_on_close" className="cursor-pointer font-semibold">
                      Requires NOC on Closure
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Does this lender provide a No Objection Certificate (NOC) when the loan is fully paid?
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};