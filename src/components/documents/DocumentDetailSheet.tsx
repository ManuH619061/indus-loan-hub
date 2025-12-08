import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import {
  Download,
  Trash2,
  Pencil,
  Link2,
  FileText,
  Image,
  Calendar,
  HardDrive,
  Building2,
  CreditCard,
  Eye,
  ZoomIn,
  ZoomOut,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { DocumentRow, getExpiryStatus, formatFileSize } from "./DocumentCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DocumentDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentRow | null;
  loans: { id: string; loan_name: string; lender_id: string | null }[];
  onUpdate: () => void;
  onDelete: (doc: DocumentRow) => void;
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

export default function DocumentDetailSheet({
  open,
  onOpenChange,
  document,
  loans,
  onUpdate,
  onDelete,
}: DocumentDetailSheetProps) {
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editLoanId, setEditLoanId] = useState("");
  const [editDocType, setEditDocType] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!document) return null;

  const expiryStatus = getExpiryStatus(document.valid_to);
  const fileExtension = document.file_name?.split('.').pop()?.toLowerCase() || 
                       document.file_url.split('.').pop()?.toLowerCase();
  const isPDF = fileExtension === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');

  const handleStartEdit = () => {
    setEditLabel(document.label);
    setEditLoanId(document.loan_id);
    setEditDocType(document.doc_type || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditLabel("");
    setEditLoanId("");
    setEditDocType("");
  };

  const handleSaveEdit = async () => {
    if (!editLabel.trim()) {
      toast.error("Document label is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          label: editLabel.trim(),
          loan_id: editLoanId,
          doc_type: editDocType || null,
        })
        .eq("id", document.id);

      if (error) throw error;

      toast.success("Document updated successfully");
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    onOpenChange(false);
    onDelete(document);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] rounded-t-3xl p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="text-lg font-semibold"
                      autoFocus
                    />
                  ) : (
                    <SheetTitle className="text-xl line-clamp-2">{document.label}</SheetTitle>
                  )}
                  <SheetDescription className="mt-1">
                    {document.file_name || "Document details and preview"}
                  </SheetDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Preview section */}
              <div className="bg-muted/30 p-4">
                <div className="bg-background rounded-xl border overflow-hidden">
                  {isImage && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(50, z - 25))}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(200, z + 25))}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-center p-4 min-h-[200px] max-h-[300px] overflow-auto">
                        <img
                          src={document.file_url}
                          alt={document.label}
                          style={{ transform: `scale(${zoom / 100})` }}
                          className="max-w-full object-contain transition-transform"
                        />
                      </div>
                    </div>
                  )}
                  
                  {isPDF && (
                    <div className="aspect-[4/3] w-full">
                      <iframe
                        src={document.file_url}
                        className="w-full h-full border-0"
                        title={document.label}
                      />
                    </div>
                  )}

                  {!isPDF && !isImage && (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                      <FileText className="h-16 w-16 mb-3" />
                      <p className="text-sm">Preview not available</p>
                      <Button variant="secondary" size="sm" className="mt-3" asChild>
                        <a href={document.file_url} download>
                          <Download className="h-4 w-4 mr-2" />
                          Download to View
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata section */}
              <div className="p-4 space-y-4">
                {/* Edit fields */}
                {isEditing && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Linked Loan</Label>
                        <Select value={editLoanId} onValueChange={setEditLoanId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select loan" />
                          </SelectTrigger>
                          <SelectContent>
                            {loans.map((loan) => (
                              <SelectItem key={loan.id} value={loan.id}>
                                {loan.loan_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select value={editDocType} onValueChange={setEditDocType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOC_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          className="flex-1" 
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="flex-1" 
                          onClick={handleSaveEdit}
                          disabled={saving}
                        >
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Info cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-xs font-medium">Linked Loan</span>
                      </div>
                      <p className="text-sm font-semibold truncate">{document.loans.loan_name}</p>
                    </CardContent>
                  </Card>
                  
                  {document.loans.lenders?.name && (
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Building2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Lender</span>
                        </div>
                        <p className="text-sm font-semibold truncate">{document.loans.lenders.name}</p>
                      </CardContent>
                    </Card>
                  )}

                  {document.doc_type && (
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs font-medium">Type</span>
                        </div>
                        <Badge variant="secondary">{document.doc_type}</Badge>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs font-medium">Added On</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {format(new Date(document.added_on), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>

                  {document.file_size && (
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <HardDrive className="h-4 w-4" />
                          <span className="text-xs font-medium">File Size</span>
                        </div>
                        <p className="text-sm font-semibold">{formatFileSize(document.file_size)}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Expiry status */}
                {expiryStatus && (
                  <Card className={cn("border", expiryStatus.className)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <expiryStatus.icon className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold">{expiryStatus.label}</p>
                        <p className="text-xs opacity-80">{expiryStatus.daysText}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {document.notes && (
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{document.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="shrink-0 p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              {isEditing ? null : (
                <div className="grid grid-cols-4 gap-2">
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3"
                    onClick={handleStartEdit}
                  >
                    <Pencil className="h-5 w-5 mb-1" />
                    <span className="text-xs">Edit</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3"
                    asChild
                  >
                    <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-5 w-5 mb-1" />
                      <span className="text-xs">View</span>
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3"
                    asChild
                  >
                    <a href={document.file_url} download>
                      <Download className="h-5 w-5 mb-1" />
                      <span className="text-xs">Download</span>
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-5 w-5 mb-1" />
                    <span className="text-xs">Delete</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.label}"? This action cannot be
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
    </>
  );
}
