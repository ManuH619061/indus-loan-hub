import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, ExternalLink, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FadeInStagger from "@/components/FadeInStagger";
import LendersSummaryCard from "@/components/lenders/LendersSummaryCard";
import AllLoanAppsTab from "@/components/lenders/AllLoanAppsTab";
import AddCustomLenderDialog from "@/components/lenders/AddCustomLenderDialog";
import EditLenderDialog from "@/components/lenders/EditLenderDialog";
import DeleteLenderDialog from "@/components/lenders/DeleteLenderDialog";
import LenderAvatar from "@/components/lenders/LenderAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LenderWithStats {
  id: string;
  name: string;
  type: string;
  logo_url?: string | null;
  website?: string | null;
  contact?: string | null;
  notes?: string | null;
  upi_vpa?: string | null;
  loan_count: number;
  total_outstanding: number;
}

export default function Lenders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [lenders, setLenders] = useState<LenderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [customLenderData, setCustomLenderData] = useState({
    name: "",
    type: "BANK" as const,
    logo_url: "",
    website: "",
    contact: "",
    notes: "",
  });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingLender, setEditingLender] = useState<LenderWithStats | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingLender, setDeletingLender] = useState<LenderWithStats | null>(null);

  useEffect(() => {
    if (user) {
      fetchLendersWithStats();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel('lenders-master-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lenders' },
          () => fetchLendersWithStats()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loans' },
          () => fetchLendersWithStats()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchLendersWithStats = async () => {
    if (!user) return;

    try {
      // Fetch all lenders
      const { data: lendersData, error: lendersError } = await supabase
        .from("lenders")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (lendersError) throw lendersError;

      // Fetch loan stats for each lender
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("lender_id, principal_amount, status")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      if (loansError) throw loansError;

      // Calculate stats
      const lendersWithStats = (lendersData || []).map((lender) => {
        const lenderLoans = (loansData || []).filter(
          (loan) => loan.lender_id === lender.id
        );
        return {
          ...lender,
          loan_count: lenderLoans.length,
          total_outstanding: lenderLoans.reduce(
            (sum, loan) => sum + (loan.principal_amount || 0),
            0
          ),
        };
      });

      setLenders(lendersWithStats);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLender = async () => {
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

    setAddLoading(true);
    try {
      const { error } = await supabase
        .from("lenders")
        .insert([{
          user_id: user.id,
          name: trimmedName,
          type: customLenderData.type,
          logo_url: customLenderData.logo_url?.trim() || null,
          website: customLenderData.website?.trim() || null,
          contact: customLenderData.contact?.trim() || null,
          notes: customLenderData.notes?.trim() || null,
        }]);

      if (error) throw error;

      toast({ title: "Lender added successfully!" });
      setAddDialogOpen(false);
      setCustomLenderData({ name: "", type: "BANK", logo_url: "", website: "", contact: "", notes: "" });
    } catch (error: any) {
      console.error('Error adding lender:', error);
      toast({ 
        variant: "destructive", 
        title: "Failed to add lender", 
        description: error.message 
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditLender = async (lenderData: any) => {
    if (!user) return;

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("lenders")
        .update({
          name: lenderData.name.trim(),
          type: lenderData.type,
          logo_url: lenderData.logo_url?.trim() || null,
          website: lenderData.website?.trim() || null,
          contact: lenderData.contact?.trim() || null,
          notes: lenderData.notes?.trim() || null,
          upi_vpa: lenderData.upi_vpa?.trim() || null,
        })
        .eq("id", lenderData.id);

      if (error) throw error;

      toast({ title: "Lender updated successfully!" });
      setEditDialogOpen(false);
      setEditingLender(null);
    } catch (error: any) {
      console.error('Error updating lender:', error);
      toast({ 
        variant: "destructive", 
        title: "Failed to update lender", 
        description: error.message 
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteLender = async () => {
    if (!user || !deletingLender) return;

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("lenders")
        .delete()
        .eq("id", deletingLender.id);

      if (error) throw error;

      toast({ title: "Lender deleted successfully!" });
      setDeleteDialogOpen(false);
      setDeletingLender(null);
    } catch (error: any) {
      console.error('Error deleting lender:', error);
      toast({ 
        variant: "destructive", 
        title: "Failed to delete lender", 
        description: error.message 
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredLenders = lenders.filter((lender) =>
    lender.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lender.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLenderTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      BANK: "Bank",
      NBFC: "NBFC",
      CARD: "Credit Card",
      FRIEND: "Friend/Family",
      OTHER: "Other",
    };
    return types[type] || type;
  };

  const getLenderTypeBadgeVariant = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      BANK: "default",
      NBFC: "secondary",
      CARD: "outline",
    };
    return variants[type] || "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Lender Master</h1>
          <p className="text-muted-foreground mt-2">Manage all your lenders in one place</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lender
        </Button>
      </div>

      <FadeInStagger>
        <LendersSummaryCard />

        <Tabs defaultValue="my-lenders" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="my-lenders">My Lenders ({lenders.length})</TabsTrigger>
            <TabsTrigger value="all-apps">Loan App Library</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-lenders" className="mt-6 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lenders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Lenders Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredLenders.length === 0 ? (
              <Card className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {searchQuery ? "No lenders found" : "No lenders yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Add your first lender to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Lender
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLenders.map((lender) => (
                  <Card key={lender.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <LenderAvatar 
                              name={lender.name} 
                              logoUrl={lender.logo_url} 
                              size="lg" 
                            />
                            <div>
                              <CardTitle className="text-base">{lender.name}</CardTitle>
                              <Badge variant={getLenderTypeBadgeVariant(lender.type)} className="mt-1">
                                {getLenderTypeLabel(lender.type)}
                              </Badge>
                            </div>
                          </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingLender(lender);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingLender(lender);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Active Loans</p>
                          <p className="font-medium">{lender.loan_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outstanding</p>
                          <p className="font-medium">{formatINR(lender.total_outstanding)}</p>
                        </div>
                      </div>
                      
                      {lender.website && (
                        <a
                          href={lender.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Website
                        </a>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/lenders/${lender.id}`)}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/loans/new?lender=${lender.id}`)}
                        >
                          Add Loan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="all-apps" className="mt-6">
            <AllLoanAppsTab />
          </TabsContent>
        </Tabs>
      </FadeInStagger>
      
      {/* Add Lender Dialog */}
      <AddCustomLenderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        lenderData={customLenderData}
        onDataChange={setCustomLenderData}
        onSubmit={handleAddLender}
        loading={addLoading}
      />

      {/* Edit Lender Dialog */}
      <EditLenderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        lender={editingLender}
        onSave={handleEditLender}
        loading={editLoading}
      />

      {/* Delete Lender Dialog */}
      <DeleteLenderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        lenderName={deletingLender?.name || ""}
        hasLoans={(deletingLender?.loan_count || 0) > 0}
        onConfirm={handleDeleteLender}
        loading={deleteLoading}
      />
    </div>
  );
}
