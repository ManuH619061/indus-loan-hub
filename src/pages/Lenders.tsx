import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FadeInStagger from "@/components/FadeInStagger";
import LendersSummaryCard from "@/components/lenders/LendersSummaryCard";
import MyLendersTab from "@/components/lenders/MyLendersTab";
import AllLoanAppsTab from "@/components/lenders/AllLoanAppsTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Lenders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customLenderOpen, setCustomLenderOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customLenderData, setCustomLenderData] = useState({
    name: "",
    type: "BANK" as const,
    logo_url: "",
    website: "",
    contact: "",
    notes: "",
  });

  const handleAddCustomLender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customLenderData.name) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lenders")
        .insert([{
          user_id: user.id,
          name: customLenderData.name,
          type: customLenderData.type,
          logo_url: customLenderData.logo_url || null,
          website: customLenderData.website || null,
          contact: customLenderData.contact || null,
          notes: customLenderData.notes || null,
        }] as any)
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Custom lender added successfully!" });
      setCustomLenderOpen(false);
      setCustomLenderData({ name: "", type: "BANK", logo_url: "", website: "", contact: "", notes: "" });
      
      // Redirect to add loan with this lender
      navigate(`/loans/new?lender=${data.id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Lenders & Loan Apps</h1>
          <p className="text-muted-foreground mt-2">Manage your lenders and explore loan app library</p>
        </div>
        <Dialog open={customLenderOpen} onOpenChange={setCustomLenderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Lender
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Lender</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCustomLender} className="space-y-4">
              <div>
                <Label>Lender Name *</Label>
                <Input
                  value={customLenderData.name}
                  onChange={(e) => setCustomLenderData({ ...customLenderData, name: e.target.value })}
                  placeholder="Enter lender name"
                  required
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={customLenderData.type}
                  onValueChange={(value: any) => setCustomLenderData({ ...customLenderData, type: value })}
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
              <div>
                <Label>Logo URL (optional)</Label>
                <Input
                  value={customLenderData.logo_url}
                  onChange={(e) => setCustomLenderData({ ...customLenderData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <Label>Website (optional)</Label>
                <Input
                  value={customLenderData.website}
                  onChange={(e) => setCustomLenderData({ ...customLenderData, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>Contact (optional)</Label>
                <Input
                  value={customLenderData.contact}
                  onChange={(e) => setCustomLenderData({ ...customLenderData, contact: e.target.value })}
                  placeholder="Phone or email"
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={customLenderData.notes}
                  onChange={(e) => setCustomLenderData({ ...customLenderData, notes: e.target.value })}
                  placeholder="Any additional notes"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add Lender"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setCustomLenderOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <FadeInStagger>
        <LendersSummaryCard />

        <Tabs defaultValue="my-lenders" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="my-lenders">My Lenders</TabsTrigger>
            <TabsTrigger value="all-apps">All Loan Apps</TabsTrigger>
          </TabsList>
          <TabsContent value="my-lenders" className="mt-6">
            <MyLendersTab />
          </TabsContent>
          <TabsContent value="all-apps" className="mt-6">
            <AllLoanAppsTab />
          </TabsContent>
        </Tabs>
      </FadeInStagger>
    </div>
  );
}
