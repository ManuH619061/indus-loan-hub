import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FadeInStagger from "@/components/FadeInStagger";
import LendersSummaryCard from "@/components/lenders/LendersSummaryCard";
import MyLendersTab from "@/components/lenders/MyLendersTab";
import AllLoanAppsTab from "@/components/lenders/AllLoanAppsTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AddCustomLenderDialog from "@/components/lenders/AddCustomLenderDialog";

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

  const handleAddCustomLender = async () => {
    if (!user || !customLenderData.name.trim()) {
      toast({ 
        title: "Validation Error", 
        description: "Lender name is required", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lenders")
        .insert([{
          user_id: user.id,
          name: customLenderData.name.trim(),
          type: customLenderData.type,
          logo_url: customLenderData.logo_url.trim() || null,
          website: customLenderData.website.trim() || null,
          contact: customLenderData.contact.trim() || null,
          notes: customLenderData.notes.trim() || null,
        }])
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
        <Button onClick={() => setCustomLenderOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Lender
        </Button>
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
      
      <AddCustomLenderDialog
        open={customLenderOpen}
        onOpenChange={setCustomLenderOpen}
        lenderData={customLenderData}
        onDataChange={setCustomLenderData}
        onSubmit={handleAddCustomLender}
        loading={loading}
      />
    </div>
  );
}
