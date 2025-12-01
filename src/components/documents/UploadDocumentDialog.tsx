import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2 } from "lucide-react";

const DOC_TYPES = [
  "Loan Sanction Letter",
  "NOC",
  "ID Proof",
  "Bank Statement",
  "Insurance",
  "Agreement",
  "Other"
];

const FILE_TYPE_MAP: Record<string, string> = {
  pdf: "Agreement",
  doc: "Agreement",
  docx: "Agreement",
  jpg: "ID Proof",
  jpeg: "ID Proof",
  png: "ID Proof",
  xls: "Bank Statement",
  xlsx: "Bank Statement",
};

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loans: { id: string; loan_name: string; lender_id: string | null }[];
  lenders: { id: string; name: string }[];
  onSuccess: () => void;
};

export default function UploadDocumentDialog({
  open,
  onOpenChange,
  loans,
  lenders,
  onSuccess,
}: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [docType, setDocType] = useState("");
  const [loanId, setLoanId] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectFileType = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? FILE_TYPE_MAP[extension] || "Other" : "Other";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!label) setLabel(droppedFile.name.replace(/\.[^/.]+$/, ""));
      if (!docType) setDocType(detectFileType(droppedFile.name));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!label) setLabel(selectedFile.name.replace(/\.[^/.]+$/, ""));
      if (!docType) setDocType(detectFileType(selectedFile.name));
    }
  };

  const handleUpload = async () => {
    if (!file || !label || !loanId) {
      toast.error("Please provide file, label, and select a loan");
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("loan-documents")
        .getPublicUrl(filePath);

      // Insert document record
      const { error: insertError } = await supabase.from("documents").insert({
        loan_id: loanId,
        label,
        doc_type: docType || null,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        valid_to: validTo || null,
        notes: notes || null,
      });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setLabel("");
    setDocType("");
    setLoanId("");
    setValidTo("");
    setNotes("");
    setDragActive(false);
    onOpenChange(false);
  };

  const selectedLoan = loans.find((l) => l.id === loanId);
  const selectedLender = selectedLoan?.lender_id
    ? lenders.find((l) => l.id === selectedLoan.lender_id)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document and link it to a loan. Drag and drop or click to browse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports PDF, DOC, DOCX, JPG, PNG, XLS, XLSX
                </p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Document Label *</Label>
              <Input
                id="label"
                placeholder="e.g., Home Loan Sanction Letter"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="loan">Loan *</Label>
              <Select value={loanId} onValueChange={setLoanId}>
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
              {selectedLender && (
                <p className="text-xs text-muted-foreground">
                  Lender: {selectedLender.name}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="docType">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detected or select" />
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

            <div className="grid gap-2">
              <Label htmlFor="validTo">Valid Until (Optional)</Label>
              <Input
                id="validTo"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this document"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file || !label || !loanId}>
            {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
