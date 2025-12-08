import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  Image,
  FileSpreadsheet,
  File,
  Check,
  FolderOpen,
  Link2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const DOC_TYPES = [
  { value: "Loan Sanction Letter", label: "Loan Sanction Letter", icon: "📄" },
  { value: "NOC", label: "NOC / No Objection Certificate", icon: "🔑" },
  { value: "ID Proof", label: "ID Proof (Aadhaar, PAN, etc.)", icon: "🪪" },
  { value: "Bank Statement", label: "Bank Statement", icon: "🏦" },
  { value: "Insurance", label: "Insurance Document", icon: "🔐" },
  { value: "Agreement", label: "Loan Agreement", icon: "📋" },
  { value: "EMI Receipt", label: "EMI Payment Receipt", icon: "🧾" },
  { value: "Other", label: "Other Document", icon: "📁" },
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

type UploadDocumentStepperProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loans: { id: string; loan_name: string; lender_id: string | null }[];
  lenders: { id: string; name: string }[];
  onSuccess: () => void;
};

export default function UploadDocumentStepper({
  open,
  onOpenChange,
  loans,
  lenders,
  onSuccess,
}: UploadDocumentStepperProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [docType, setDocType] = useState("");
  const [loanId, setLoanId] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const detectFileType = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? FILE_TYPE_MAP[extension] || "Other" : "Other";
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension === "pdf") return FileText;
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")) return Image;
    if (["xls", "xlsx", "csv"].includes(extension || "")) return FileSpreadsheet;
    return File;
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
      toast.error("Please complete all required steps");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("loan-documents")
        .getPublicUrl(filePath);

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

      toast.success("Document uploaded successfully!");
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
    setStep(1);
    setDragActive(false);
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!file;
      case 2: return !!docType;
      case 3: return true; // Optional step
      case 4: return !!label && !!loanId;
      default: return false;
    }
  };

  const selectedLoan = loans.find((l) => l.id === loanId);
  const selectedLender = selectedLoan?.lender_id
    ? lenders.find((l) => l.id === selectedLoan.lender_id)
    : null;

  const FileIcon = file ? getFileIcon(file.name) : File;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[95vh] sm:h-[90vh] rounded-t-3xl p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl">Upload Document</SheetTitle>
                <SheetDescription className="mt-0.5">
                  Step {step} of {totalSteps}
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Progress value={progress} className="mt-3 h-1.5" />
          </SheetHeader>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Pick File */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Select a File</h3>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or browse to upload
                    </p>
                  </div>

                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                      dragActive
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    />
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-primary/10 rounded-xl">
                          <FileIcon className="h-10 w-10 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setLabel("");
                            setDocType("");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                          <FolderOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">Drop your file here</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            PDF, DOC, JPG, PNG, XLS up to 10MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Choose Category */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Choose Category</h3>
                    <p className="text-sm text-muted-foreground">
                      What type of document is this?
                    </p>
                  </div>

                  {docType && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-muted-foreground">Auto-detected: </span>
                      <Badge variant="secondary">{docType}</Badge>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {DOC_TYPES.map((type) => (
                      <Card
                        key={type.value}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          docType === type.value && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={() => setDocType(type.value)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <span className="text-2xl">{type.icon}</span>
                          <span className="text-sm font-medium">{type.label.split(" ")[0]}</span>
                          {docType === type.value && (
                            <Check className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Link to Loan (Optional) */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Link2 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Link to Loan</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect this document to an existing loan
                    </p>
                  </div>

                  <div className="space-y-3">
                    {loans.map((loan) => {
                      const lender = loan.lender_id 
                        ? lenders.find((l) => l.id === loan.lender_id)
                        : null;
                      return (
                        <Card
                          key={loan.id}
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            loanId === loan.id && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => setLoanId(loan.id)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{loan.loan_name}</p>
                              {lender && (
                                <p className="text-sm text-muted-foreground">{lender.name}</p>
                              )}
                            </div>
                            {loanId === loan.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Confirm */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Confirm Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Review and finalize your upload
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">Document Name *</Label>
                      <Input
                        id="label"
                        placeholder="e.g., Home Loan Sanction Letter"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </div>

                    {!loanId && (
                      <div className="space-y-2">
                        <Label>Select Loan *</Label>
                        <Select value={loanId} onValueChange={setLoanId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a loan" />
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
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="validTo">Valid Until (Optional)</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="validTo"
                          type="date"
                          value={validTo}
                          onChange={(e) => setValidTo(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any additional notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Summary */}
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">File:</span>
                            <span className="font-medium truncate max-w-[200px]">{file?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <Badge variant="secondary" className="text-xs">{docType}</Badge>
                          </div>
                          {selectedLoan && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Loan:</span>
                              <span className="font-medium">{selectedLoan.loan_name}</span>
                            </div>
                          )}
                          {selectedLender && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Lender:</span>
                              <span className="font-medium">{selectedLender.name}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex gap-3">
              {step > 1 && (
                <Button 
                  variant="outline" 
                  onClick={() => setStep(s => s - 1)}
                  disabled={uploading}
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {step < totalSteps ? (
                <Button 
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={handleUpload}
                  disabled={uploading || !canProceed()}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
