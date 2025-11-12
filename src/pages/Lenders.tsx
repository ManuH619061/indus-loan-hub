import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2 } from "lucide-react";

export default function Lenders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lenders, setLenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    app_display_name: "",
    type: "BANK",
    contact: "",
    website: "",
    upi_vpa: "",
    app_link: "",
    notes: "",
    requires_sanction_letter: true,
    requires_noc_on_close: true,
  });

  useEffect(() => {
    if (user) fetchLenders();
  }, [user]);

  const fetchLenders = async () => {
    try {
      const { data, error } = await supabase
        .from("lenders")
        .select("*")
        .order("name");
      if (error) throw error;
      setLenders(data || []);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("lenders").insert({
        ...formData,
        user_id: user?.id,
      } as any);

      if (error) throw error;

      toast({ title: "Lender added successfully" });
      setDialogOpen(false);
      setFormData({
        name: "",
        app_display_name: "",
        type: "BANK",
        contact: "",
        website: "",
        upi_vpa: "",
        app_link: "",
        notes: "",
        requires_sanction_letter: true,
        requires_noc_on_close: true,
      });
      fetchLenders();
    } catch (error: any) {
      toast({ title: "Error adding lender", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lenders</h1>
          <p className="text-muted-foreground">Manage your loan providers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Lender
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lender</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="app_display_name">App Display Name</Label>
                  <Input
                    id="app_display_name"
                    value={formData.app_display_name}
                    onChange={(e) => setFormData({ ...formData, app_display_name: e.target.value })}
                    placeholder="e.g., Navi, Paytm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK">Bank</SelectItem>
                      <SelectItem value="NBFC">NBFC</SelectItem>
                      <SelectItem value="CARD">Credit Card</SelectItem>
                      <SelectItem value="FRIEND">Friend/Family</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contact">Contact</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Phone or email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="upi_vpa">UPI VPA</Label>
                  <Input
                    id="upi_vpa"
                    value={formData.upi_vpa}
                    onChange={(e) => setFormData({ ...formData, upi_vpa: e.target.value })}
                    placeholder="navi@axis"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="app_link">App Link</Label>
                <Input
                  id="app_link"
                  value={formData.app_link}
                  onChange={(e) => setFormData({ ...formData, app_link: e.target.value })}
                  placeholder="Deep link or app URL"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requires_sanction">Requires Sanction Letter</Label>
                  <Switch
                    id="requires_sanction"
                    checked={formData.requires_sanction_letter}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, requires_sanction_letter: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requires_noc">Requires NOC on Close</Label>
                  <Switch
                    id="requires_noc"
                    checked={formData.requires_noc_on_close}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_noc_on_close: checked })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Add Lender
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {lenders.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                No lenders added yet. Click "Add Lender" to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          lenders.map((lender) => (
            <Card key={lender.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  {lender.logo_url ? (
                    <img src={lender.logo_url} alt={lender.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{lender.app_display_name || lender.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{lender.type}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {lender.contact && (
                    <div>
                      <span className="text-muted-foreground">Contact:</span> {lender.contact}
                    </div>
                  )}
                  {lender.upi_vpa && (
                    <div>
                      <span className="text-muted-foreground">UPI:</span> {lender.upi_vpa}
                    </div>
                  )}
                  {lender.website && (
                    <div className="col-span-2">
                      <a
                        href={lender.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {lender.website}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
