import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  Filter,
  Eye,
  AlertCircle,
  Loader2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInDays, parseISO } from "date-fns";
import FadeInStagger from "@/components/FadeInStagger";
import UploadDocumentDialog from "@/components/documents/UploadDocumentDialog";
import DocumentPreviewDialog from "@/components/documents/DocumentPreviewDialog";

type DocumentRow = {
  id: string;
  label: string;
  doc_type: string | null;
  file_url: string;
  file_name: string | null;
  added_on: string;
  valid_to: string | null;
  notes: string | null;
  loan_id: string;
  loans: {
    loan_name: string;
    user_id: string;
    lender_id: string | null;
    lenders: {
      name: string;
    } | null;
  };
};

const DOC_TYPES = [
  "Loan Sanction Letter",
  "NOC",
  "ID Proof",
  "Bank Statement",
  "Insurance",
  "Agreement",
  "Other"
];

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentRow | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<DocumentRow | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [lenderFilter, setLenderFilter] = useState("all");
  const [loanFilter, setLoanFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch documents
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select(`
          *,
          loans!inner (
            loan_name,
            user_id,
            lender_id,
            lenders (name)
          )
        `)
        .order("added_on", { ascending: false });

      if (docsError) throw docsError;

      const filtered = (docsData as any)?.filter((doc: any) => doc.loans?.user_id === user.id) ?? [];
      setDocuments(filtered);

      // Fetch loans
      const { data: loansData } = await supabase
        .from("loans")
        .select("id, loan_name")
        .eq("user_id", user.id);
      setLoans(loansData || []);

      // Fetch lenders
      const { data: lendersData } = await supabase
        .from("lenders")
        .select("id, name")
        .eq("user_id", user.id);
      setLenders(lendersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      if (documentToDelete.file_url) {
        const fileName = documentToDelete.file_url.split("/").pop();
        if (fileName) {
          await supabase.storage.from("loan-documents").remove([fileName]);
        }
      }

      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentToDelete.id);

      if (error) throw error;

      toast.success("Document deleted successfully");
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete document");
    }
  };

  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    if (searchTerm) {
      filtered = filtered.filter(
        (doc) =>
          doc.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((doc) => doc.doc_type === typeFilter);
    }

    if (lenderFilter !== "all") {
      filtered = filtered.filter((doc) => doc.loans.lender_id === lenderFilter);
    }

    if (loanFilter !== "all") {
      filtered = filtered.filter((doc) => doc.loan_id === loanFilter);
    }

    if (expiryFilter !== "all") {
      const today = new Date();
      filtered = filtered.filter((doc) => {
        if (!doc.valid_to) return expiryFilter === "no-expiry";
        const expiryDate = parseISO(doc.valid_to);
        const daysUntilExpiry = differenceInDays(expiryDate, today);

        if (expiryFilter === "expired") return daysUntilExpiry < 0;
        if (expiryFilter === "expiring-soon") return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
        if (expiryFilter === "valid") return daysUntilExpiry > 30;
        return true;
      });
    }

    return filtered;
  }, [documents, searchTerm, typeFilter, lenderFilter, loanFilter, expiryFilter]);

  const getExpiryStatus = (validTo: string | null) => {
    if (!validTo) return null;
    const today = new Date();
    const expiryDate = parseISO(validTo);
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    if (daysUntilExpiry < 0) {
      return { status: "expired", variant: "destructive" as const, label: "Expired" };
    } else if (daysUntilExpiry <= 30) {
      return { status: "expiring-soon", variant: "secondary" as const, label: `Expires in ${daysUntilExpiry} days` };
    }
    return { status: "valid", variant: "default" as const, label: `Valid until ${expiryDate.toLocaleDateString()}` };
  };

  const DocumentCard = ({ doc }: { doc: DocumentRow }) => {
    const expiryStatus = getExpiryStatus(doc.valid_to);
    const addedOnDate = new Date(doc.added_on);

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-1">{doc.label}</h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {doc.doc_type && (
                      <Badge variant="outline">{doc.doc_type}</Badge>
                    )}
                    <Badge variant="secondary">
                      {doc.loans.lenders?.name || "Unknown Lender"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Loan: {doc.loans.loan_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Added {formatDistanceToNow(addedOnDate, { addSuffix: true })}
                  </p>
                  {doc.notes && (
                    <p className="text-sm mt-2 text-muted-foreground">{doc.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setDocumentToPreview(doc);
                      setPreviewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={doc.file_url} download>
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
              {expiryStatus && (
                <div className="mt-3 flex items-center gap-2">
                  {expiryStatus.status === "expired" || expiryStatus.status === "expiring-soon" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : null}
                  <Badge variant={expiryStatus.variant}>{expiryStatus.label}</Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Documents Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage and organize your loan documents
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <FadeInStagger>
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter documents by type, lender, loan, or expiry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DOC_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={lenderFilter} onValueChange={setLenderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lenders</SelectItem>
                  {lenders.map((lender) => (
                    <SelectItem key={lender.id} value={lender.id}>
                      {lender.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={loanFilter} onValueChange={setLoanFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Loan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Loans</SelectItem>
                  {loans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.loan_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Expiry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="expiring-soon">Expiring Soon (30 days)</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="no-expiry">No Expiry Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredDocuments.length} of {documents.length} documents
              </div>
              {(searchTerm || typeFilter !== "all" || lenderFilter !== "all" || loanFilter !== "all" || expiryFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setTypeFilter("all");
                    setLenderFilter("all");
                    setLoanFilter("all");
                    setExpiryFilter("all");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {documents.length === 0
                ? "No documents uploaded yet. Add documents to your loans to see them here."
                : "No documents found matching the filters."}
            </CardContent>
          </Card>
        )}
      </FadeInStagger>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.label}"? This action cannot be
              undone and will permanently remove the document from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        loans={loans}
        lenders={lenders}
        onSuccess={fetchData}
      />

      <DocumentPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        document={documentToPreview}
      />
    </div>
  );
}
