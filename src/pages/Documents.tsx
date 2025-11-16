import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          loans!inner (
            loan_name,
            user_id,
            lenders (name)
          )
        `)
        .order("added_on", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupByLoan = () => {
    const grouped: Record<string, any[]> = {};
    documents.forEach((doc) => {
      const loanName = doc.loans?.loan_name || "Unknown";
      if (!grouped[loanName]) grouped[loanName] = [];
      grouped[loanName].push(doc);
    });
    return grouped;
  };

  const groupByLender = () => {
    const grouped: Record<string, any[]> = {};
    documents.forEach((doc) => {
      const lenderName = doc.loans?.lenders?.name || "Unknown";
      if (!grouped[lenderName]) grouped[lenderName] = [];
      grouped[lenderName].push(doc);
    });
    return grouped;
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      // Delete from storage if file exists
      if (documentToDelete.file_url) {
        const fileName = documentToDelete.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('loan-documents')
            .remove([fileName]);
        }
      }

      // Delete document record
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentToDelete.id);

      if (error) throw error;

      toast({ title: "Document deleted successfully" });
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error: any) {
      toast({ 
        title: "Error deleting document", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const DocumentCard = ({ doc }: { doc: any }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <FileText className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex-1">
              <h4 className="font-medium">{doc.label}</h4>
              <p className="text-sm text-muted-foreground">
                {doc.doc_type || "Document"} • Added {formatDistanceToNow(new Date(doc.added_on))} ago
              </p>
              {doc.valid_to && (
                <p className="text-xs text-muted-foreground mt-1">
                  Valid until {new Date(doc.valid_to).toLocaleDateString("en-IN")}
                </p>
              )}
              {doc.notes && <p className="text-sm mt-2">{doc.notes}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDocumentToDelete(doc);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  const byLoan = groupByLoan();
  const byLender = groupByLender();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage loan documents and files</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <Tabs defaultValue="by-loan" className="w-full">
        <TabsList>
          <TabsTrigger value="by-loan">By Loan</TabsTrigger>
          <TabsTrigger value="by-lender">By Lender</TabsTrigger>
        </TabsList>

        <TabsContent value="by-loan" className="space-y-6 mt-6">
          {Object.keys(byLoan).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No documents uploaded yet. Add documents to your loans to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(byLoan).map(([loanName, docs]) => (
              <div key={loanName}>
                <h3 className="text-lg font-semibold mb-3">{loanName}</h3>
                <div className="space-y-3">
                  {docs.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="by-lender" className="space-y-6 mt-6">
          {Object.keys(byLender).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No documents uploaded yet. Add documents to your loans to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(byLender).map(([lenderName, docs]) => (
              <div key={lenderName}>
                <h3 className="text-lg font-semibold mb-3">{lenderName}</h3>
                <div className="space-y-3">
                  {docs.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.label}"? This action cannot be undone and will permanently remove the document from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
