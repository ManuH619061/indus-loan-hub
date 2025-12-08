import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Plus, 
  Search, 
  Loader2,
  X,
  SortAsc,
  SortDesc,
  Download,
  Trash2,
  CheckSquare,
  Square,
  FolderOpen,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import FadeInStagger from "@/components/FadeInStagger";
import DocumentCard, { DocumentRow, getExpiryStatus } from "@/components/documents/DocumentCard";
import DocumentDetailSheet from "@/components/documents/DocumentDetailSheet";
import UploadDocumentStepper from "@/components/documents/UploadDocumentStepper";
import DocumentEmptyState from "@/components/documents/DocumentEmptyState";
import { cn } from "@/lib/utils";

const useIsMobileBoolean = () => {
  const result = useIsMobile();
  return result === true;
};

const DOC_TYPES = [
  "Loan Sanction Letter",
  "NOC",
  "ID Proof",
  "Bank Statement",
  "Insurance",
  "Agreement",
  "EMI Receipt",
  "Other"
];

const CATEGORY_TABS = [
  { value: "all", label: "All", icon: FolderOpen },
  { value: "loans", label: "Loans", icon: null },
  { value: "bank", label: "Bank", icon: null },
  { value: "personal", label: "Personal", icon: null },
  { value: "other", label: "Other", icon: null },
];

type SortOption = "name" | "date" | "type" | "linked";
type SortOrder = "asc" | "desc";

export default function Documents() {
  const { user } = useAuth();
  const isMobile = useIsMobile() === true;
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentRow | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryTab, setCategoryTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [lenderFilter, setLenderFilter] = useState("all");
  const [loanFilter, setLoanFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [showExpiring, setShowExpiring] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pinned documents (stored locally)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("pinnedDocuments");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem("pinnedDocuments", JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
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

      const { data: loansData } = await supabase
        .from("loans")
        .select("id, loan_name, lender_id")
        .eq("user_id", user.id);
      setLoans(loansData || []);

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const docsToDelete = documents.filter(d => selectedIds.has(d.id));
      
      // Delete files from storage
      const fileNames = docsToDelete
        .map(d => d.file_url.split("/").pop())
        .filter(Boolean) as string[];
      
      if (fileNames.length > 0) {
        await supabase.storage.from("loan-documents").remove(fileNames);
      }

      // Delete records
      const { error } = await supabase
        .from("documents")
        .delete()
        .in("id", [...selectedIds]);

      if (error) throw error;

      toast.success(`${selectedIds.size} document(s) deleted successfully`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete documents");
    }
  };

  const getCategoryForDoc = (doc: DocumentRow): string => {
    const docType = doc.doc_type?.toLowerCase() || "";
    
    if (docType.includes("sanction") || docType.includes("agreement") || docType.includes("noc") || docType.includes("emi")) {
      return "loans";
    }
    if (docType.includes("bank") || docType.includes("statement")) {
      return "bank";
    }
    if (docType.includes("id proof") || docType.includes("insurance")) {
      return "personal";
    }
    return "other";
  };

  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Category tab filter
    if (categoryTab !== "all") {
      filtered = filtered.filter(doc => getCategoryForDoc(doc) === categoryTab);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.label.toLowerCase().includes(term) ||
          doc.file_name?.toLowerCase().includes(term) ||
          doc.notes?.toLowerCase().includes(term) ||
          doc.loans.loan_name.toLowerCase().includes(term) ||
          doc.loans.lenders?.name?.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((doc) => doc.doc_type === typeFilter);
    }

    // Lender filter
    if (lenderFilter !== "all") {
      filtered = filtered.filter((doc) => doc.loans.lender_id === lenderFilter);
    }

    // Loan filter
    if (loanFilter !== "all") {
      filtered = filtered.filter((doc) => doc.loan_id === loanFilter);
    }

    // Expiry filter
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

    // Show expiring toggle
    if (showExpiring) {
      const today = new Date();
      filtered = filtered.filter((doc) => {
        if (!doc.valid_to) return false;
        const expiryDate = parseISO(doc.valid_to);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        return daysUntilExpiry <= 30;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      // Pinned items always first
      const aPinned = pinnedIds.has(a.id);
      const bPinned = pinnedIds.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.label.localeCompare(b.label);
          break;
        case "date":
          comparison = new Date(a.added_on).getTime() - new Date(b.added_on).getTime();
          break;
        case "type":
          comparison = (a.doc_type || "").localeCompare(b.doc_type || "");
          break;
        case "linked":
          comparison = a.loans.loan_name.localeCompare(b.loans.loan_name);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [documents, searchTerm, categoryTab, typeFilter, lenderFilter, loanFilter, expiryFilter, showExpiring, sortBy, sortOrder, pinnedIds]);

  // Stats
  const expiringCount = useMemo(() => {
    const today = new Date();
    return documents.filter((doc) => {
      if (!doc.valid_to) return false;
      const expiryDate = parseISO(doc.valid_to);
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    }).length;
  }, [documents]);

  const expiredCount = useMemo(() => {
    const today = new Date();
    return documents.filter((doc) => {
      if (!doc.valid_to) return false;
      const expiryDate = parseISO(doc.valid_to);
      return differenceInDays(expiryDate, today) < 0;
    }).length;
  }, [documents]);

  const hasActiveFilters = !!(searchTerm || typeFilter !== "all" || lenderFilter !== "all" || loanFilter !== "all" || expiryFilter !== "all" || showExpiring);

  const clearAllFilters = () => {
    setSearchTerm("");
    setCategoryTab("all");
    setTypeFilter("all");
    setLenderFilter("all");
    setLoanFilter("all");
    setExpiryFilter("all");
    setShowExpiring(false);
  };

  const handleTogglePin = (doc: DocumentRow) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
        toast.success("Document unpinned");
      } else {
        next.add(doc.id);
        toast.success("Document pinned to top");
      }
      return next;
    });
  };

  const handleSelect = (doc: DocumentRow, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(doc.id);
      } else {
        next.delete(doc.id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Document Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {documents.length} document{documents.length !== 1 ? "s" : ""} stored securely
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Expiry alerts */}
          {(expiringCount > 0 || expiredCount > 0) && (
            <div className="flex items-center gap-2 mr-2">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {expiredCount} expired
                </Badge>
              )}
              {expiringCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20"
                  onClick={() => setShowExpiring(!showExpiring)}
                >
                  <Clock className="h-3 w-3" />
                  {expiringCount} expiring
                </Badge>
              )}
            </div>
          )}
          
          {!isMobile && (
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <ScrollArea className="w-full whitespace-nowrap">
        <Tabs value={categoryTab} onValueChange={setCategoryTab}>
          <TabsList className="inline-flex h-10 bg-muted/50">
            {CATEGORY_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, loans, lenders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Type" />
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

          <Select value={loanFilter} onValueChange={setLoanFilter}>
            <SelectTrigger className="w-[140px] h-10">
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
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Expiry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="expired">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  Expired
                </span>
              </SelectItem>
              <SelectItem value="expiring-soon">
                <span className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Expiring Soon
                </span>
              </SelectItem>
              <SelectItem value="valid">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Valid
                </span>
              </SelectItem>
              <SelectItem value="no-expiry">No Expiry</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                {sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setSortBy("date")}>
                Sort by Date {sortBy === "date" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                Sort by Name {sortBy === "name" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("type")}>
                Sort by Type {sortBy === "type" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("linked")}>
                Sort by Loan {sortBy === "linked" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleSortOrder}>
                {sortOrder === "asc" ? "Descending" : "Ascending"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle (desktop only) */}
          {!isMobile && (
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-10 w-10 rounded-none"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-10 w-10 rounded-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Active filters and bulk actions bar */}
      {(hasActiveFilters || selectionMode) && (
        <div className="flex items-center justify-between gap-4 py-2 px-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            {selectionMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === filteredDocuments.length ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  {selectedIds.size === filteredDocuments.length ? "Deselect All" : "Select All"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  {filteredDocuments.length} of {documents.length} documents
                </span>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-7"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectionMode && selectedIds.size > 0 && (
              <>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download ({selectedIds.size})
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              </>
            )}
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
              }}
            >
              {selectionMode ? "Done" : "Select"}
            </Button>
          </div>
        </div>
      )}

      {/* Documents Grid/List */}
      <AnimatePresence mode="wait">
        {filteredDocuments.length === 0 ? (
          <DocumentEmptyState 
            hasFilters={hasActiveFilters}
            onUpload={() => setUploadDialogOpen(true)}
            onClearFilters={clearAllFilters}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "grid gap-4",
              viewMode === "grid" 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1"
            )}
          >
            {filteredDocuments.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DocumentCard
                  doc={doc}
                  isPinned={pinnedIds.has(doc.id)}
                  isSelected={selectedIds.has(doc.id)}
                  selectionMode={selectionMode}
                  onPreview={(doc) => {
                    setSelectedDocument(doc);
                    setDetailSheetOpen(true);
                  }}
                  onDelete={(doc) => {
                    setDocumentToDelete(doc);
                    setDeleteDialogOpen(true);
                  }}
                  onRename={(doc) => {
                    setSelectedDocument(doc);
                    setDetailSheetOpen(true);
                  }}
                  onLinkChange={(doc) => {
                    setSelectedDocument(doc);
                    setDetailSheetOpen(true);
                  }}
                  onTogglePin={handleTogglePin}
                  onSelect={handleSelect}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile FAB */}
      {isMobile && (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
          {selectionMode && selectedIds.size > 0 && (
            <Button
              size="icon"
              variant="destructive"
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl"
            onClick={() => setUploadDialogOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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

      {/* Upload Stepper */}
      <UploadDocumentStepper
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        loans={loans}
        lenders={lenders}
        onSuccess={fetchData}
      />

      {/* Document Detail Sheet */}
      <DocumentDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        document={selectedDocument}
        loans={loans}
        onUpdate={fetchData}
        onDelete={(doc) => {
          setDocumentToDelete(doc);
          setDeleteDialogOpen(true);
        }}
      />
    </div>
  );
}
