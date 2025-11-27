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
    if (!user) {
      toast({ 
        title: "Authentication Error", 
        description: "Please log in to add a lender", 
        variant: "destructive" 
      });
      return;
    }

    const trimmedName = customLenderData.name?.trim();
    if (!trimmedName) {
      toast({ 
        title: "Validation Error", 
        description: "Lender name is required", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      // Prepare data with proper null handling
      const insertData = {
        user_id: user.id,
        name: trimmedName,
        type: customLenderData.type,
        logo_url: customLenderData.logo_url?.trim() || null,
        website: customLenderData.website?.trim() || null,
        contact: customLenderData.contact?.trim() || null,
        notes: customLenderData.notes?.trim() || null,
      };

      console.log('Inserting lender data:', insertData);

      const { data, error } = await supabase
        .from("lenders")
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Lender insert error:', error);
        throw error;
      }

      console.log('Lender created successfully:', data);
      toast({ 
        title: "Lender added successfully!",
        description: "Your lender has been saved to the database"
      });
      setCustomLenderOpen(false);
      setCustomLenderData({ name: "", type: "BANK", logo_url: "", website: "", contact: "", notes: "" });
      
      // Stay on lenders page to show the updated list
      // User can then navigate to add loan if needed
    } catch (error: any) {
      console.error('Error adding lender:', error);
      toast({ 
        variant: "destructive", 
        title: "Failed to add lender", 
        description: error.message || "Please try again" 
      });
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
