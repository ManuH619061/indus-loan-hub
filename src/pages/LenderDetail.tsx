import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { Building2, Edit, Trash2, ArrowLeft, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Lender {
  id: string;
  name: string;
  app_display_name: string;
  type: string;
  logo_url: string | null;
  upi_vpa: string | null;
  contact: string | null;
  website: string | null;
  app_link: string | null;
  notes: string | null;
}

interface Loan {
  id: string;
  loan_name: string;
  loan_type: string;
  principal_amount: number;
  interest_rate_apy: number;
  emi_amount: number;
  status: string;
}

export default function LenderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lender, setLender] = useState<Lender | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    app_display_name: "",
    type: "BANK",
    contact: "",
    website: "",
    upi_vpa: "",
    app_link: "",
    notes: "",
  });

  useEffect(() => {
    if (user && id) fetchData();
  }, [user, id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch lender
      const { data: lenderData, error: lenderError } = await supabase
        .from("lenders")
        .select("*")
        .eq("id", id)
        .single();

      if (lenderError) throw lenderError;
      setLender(lenderData);
      setFormData({
        name: lenderData.name || "",
        app_display_name: lenderData.app_display_name || "",
        type: lenderData.type || "BANK",
        contact: lenderData.contact || "",
        website: lenderData.website || "",
        upi_vpa: lenderData.upi_vpa || "",
        app_link: lenderData.app_link || "",
        notes: lenderData.notes || "",
      });

      // Fetch loans for this lender
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .eq("lender_id", id)
        .order("disbursed_on", { ascending: false });

      if (loansError) throw loansError;
      setLoans(loansData || []);

      // Fetch lender-level documents
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select("*, loans!inner(lender_id)")
        .eq("loans.lender_id", id);

      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch (error: any) {
      console.error("Error fetching lender:", error);
      toast({ title: "Error loading lender", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }

    try {
      // Convert empty strings to null for optional fields
      const updateData = {
        name: formData.name.trim(),
        app_display_name: formData.app_display_name.trim() || null,
        type: formData.type as "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER",
        contact: formData.contact.trim() || null,
        website: formData.website.trim() || null,
        upi_vpa: formData.upi_vpa.trim() || null,
        app_link: formData.app_link.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const { error } = await supabase
        .from("lenders")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Lender updated successfully" });
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error updating lender", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      const activeLoans = loans.filter((loan) => loan.status === "ACTIVE");
      if (activeLoans.length > 0) {
        toast({
          title: "Cannot delete lender",
          description: "Close or reassign all active loans before deleting this lender.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("lenders").delete().eq("id", id);

      if (error) throw error;

      toast({ title: "Lender deleted successfully" });
      navigate("/dashboard/lenders");
    } catch (error: any) {
      toast({ title: "Error deleting lender", description: error.message, variant: "destructive" });
    }
  };

  const getLoanTypeLabel = (type: string) => {
    return type.replace(/_/g, " ");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-500";
      case "CLOSED":
        return "bg-gray-500/10 text-gray-500";
      case "DEFAULTED":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-blue-500/10 text-blue-500";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!lender) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Lender not found</p>
        <Button className="mt-4" onClick={() => navigate("/dashboard/lenders")}>
          Back to Lenders
        </Button>
      </div>
    );
  }

  const activeLoansCount = loans.filter((loan) => loan.status === "ACTIVE").length;
  const totalOutstanding = loans
    .filter((loan) => loan.status === "ACTIVE")
    .reduce((sum, loan) => sum + (loan.principal_amount || 0), 0);
  const avgROI = loans.length > 0
    ? loans.reduce((sum, loan) => sum + (loan.interest_rate_apy || 0), 0) / loans.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/lenders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            {lender.logo_url ? (
              <img src={lender.logo_url} alt={lender.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{lender.app_display_name || lender.name}</h1>
              <p className="text-muted-foreground">{lender.name}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={activeLoansCount > 0}
            title={activeLoansCount > 0 ? "Close or reassign loans before deleting lender" : ""}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="text-lg font-medium">{lender.type}</p>
            </div>
            {lender.upi_vpa && (
              <div>
                <p className="text-sm text-muted-foreground">UPI VPA</p>
                <p className="text-lg font-medium font-mono">{lender.upi_vpa}</p>
              </div>
            )}
            {lender.contact && (
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="text-lg font-medium">{lender.contact}</p>
              </div>
            )}
            {lender.website && (
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a
                  href={lender.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-medium text-primary hover:underline"
                >
                  Visit
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Loan Name</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium text-right">Principal</th>
                      <th className="pb-3 font-medium text-right">Outstanding</th>
                      <th className="pb-3 font-medium text-right">ROI</th>
                      <th className="pb-3 font-medium text-right">EMI</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id} className="border-b hover:bg-muted/50">
                        <td className="py-4 font-medium">{loan.loan_name}</td>
                        <td className="py-4">{getLoanTypeLabel(loan.loan_type)}</td>
                        <td className="py-4 text-right">{formatINR(loan.principal_amount)}</td>
                        <td className="py-4 text-right">{formatINR(loan.principal_amount)}</td>
                        <td className="py-4 text-right">{loan.interest_rate_apy.toFixed(2)}%</td>
                        <td className="py-4 text-right">{formatINR(loan.emi_amount || 0)}</td>
                        <td className="py-4">
                          <Badge className={getStatusColor(loan.status)}>{loan.status}</Badge>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/loans/${loan.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {loans.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No loans found for this lender
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No documents found</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.label}</p>
                          <p className="text-sm text-muted-foreground">{doc.doc_type}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Active Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeLoansCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatINR(totalOutstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{avgROI.toFixed(2)}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lender</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app_display_name">App Display Name</Label>
                <Input
                  id="app_display_name"
                  value={formData.app_display_name}
                  onChange={(e) => setFormData({ ...formData, app_display_name: e.target.value })}
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
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contact">Contact</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
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
                />
              </div>
              <div>
                <Label htmlFor="upi_vpa">UPI VPA</Label>
                <Input
                  id="upi_vpa"
                  value={formData.upi_vpa}
                  onChange={(e) => setFormData({ ...formData, upi_vpa: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="app_link">App Link</Label>
              <Input
                id="app_link"
                value={formData.app_link}
                onChange={(e) => setFormData({ ...formData, app_link: e.target.value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lender "{lender.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
