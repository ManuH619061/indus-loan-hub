import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  Pin,
  PinOff,
  Pencil,
  Link2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CreditCard,
  ShieldCheck,
  IdCard,
  Receipt,
  Key,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  label: string;
  doc_type: string | null;
  file_url: string;
  file_name: string | null;
  file_size?: number | null;
  added_on: string;
  valid_to: string | null;
  valid_from?: string | null;
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

type DocumentCardProps = {
  doc: DocumentRow;
  isPinned?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onPreview: (doc: DocumentRow) => void;
  onDelete: (doc: DocumentRow) => void;
  onRename: (doc: DocumentRow) => void;
  onLinkChange: (doc: DocumentRow) => void;
  onTogglePin: (doc: DocumentRow) => void;
  onSelect: (doc: DocumentRow, selected: boolean) => void;
};

const getFileIcon = (fileName: string | null, docType: string | null) => {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  
  if (extension === "pdf") return FileText;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")) return Image;
  if (["xls", "xlsx", "csv"].includes(extension || "")) return FileSpreadsheet;
  
  // Doc type based icons
  if (docType?.toLowerCase().includes("insurance")) return ShieldCheck;
  if (docType?.toLowerCase().includes("id proof")) return IdCard;
  if (docType?.toLowerCase().includes("bank")) return Building2;
  if (docType?.toLowerCase().includes("receipt")) return Receipt;
  
  return File;
};

const getDocTypeIcon = (docType: string | null) => {
  if (!docType) return null;
  const type = docType.toLowerCase();
  
  if (type.includes("insurance")) return { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (type.includes("id proof")) return { icon: IdCard, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (type.includes("bank")) return { icon: Building2, color: "text-purple-500", bg: "bg-purple-500/10" };
  if (type.includes("receipt") || type.includes("emi")) return { icon: Receipt, color: "text-orange-500", bg: "bg-orange-500/10" };
  if (type.includes("noc") || type.includes("proof")) return { icon: Key, color: "text-amber-500", bg: "bg-amber-500/10" };
  if (type.includes("agreement") || type.includes("sanction")) return { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-500/10" };
  
  return { icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
};

export const getExpiryStatus = (validTo: string | null) => {
  if (!validTo) return null;
  const today = new Date();
  const expiryDate = parseISO(validTo);
  const daysUntilExpiry = differenceInDays(expiryDate, today);

  if (daysUntilExpiry < 0) {
    return { 
      status: "expired", 
      icon: AlertTriangle,
      className: "bg-destructive/10 text-destructive border-destructive/20",
      label: "Expired",
      daysText: `Expired ${Math.abs(daysUntilExpiry)} days ago`
    };
  } else if (daysUntilExpiry <= 30) {
    return { 
      status: "expiring-soon", 
      icon: Clock,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      label: `${daysUntilExpiry}d left`,
      daysText: `Expires in ${daysUntilExpiry} days`
    };
  }
  return { 
    status: "valid", 
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    label: "Valid",
    daysText: `Valid until ${format(expiryDate, "MMM d, yyyy")}`
  };
};

export const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function DocumentCard({
  doc,
  isPinned = false,
  isSelected = false,
  selectionMode = false,
  onPreview,
  onDelete,
  onRename,
  onLinkChange,
  onTogglePin,
  onSelect,
}: DocumentCardProps) {
  const expiryStatus = getExpiryStatus(doc.valid_to);
  const addedOnDate = new Date(doc.added_on);
  const FileIcon = getFileIcon(doc.file_name, doc.doc_type);
  const docTypeInfo = getDocTypeIcon(doc.doc_type);

  return (
    <Card 
      className={cn(
        "group relative transition-all duration-200 hover:shadow-lg hover:border-primary/30",
        isPinned && "ring-2 ring-primary/20 bg-primary/5",
        isSelected && "ring-2 ring-primary bg-primary/10",
        selectionMode && "cursor-pointer"
      )}
      onClick={() => selectionMode && onSelect(doc, !isSelected)}
    >
      {/* Pin indicator */}
      {isPinned && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
            <Pin className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-3 left-3 z-10">
          <Checkbox 
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(doc, !!checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* File type icon */}
          <div className={cn(
            "shrink-0 p-3 rounded-xl transition-colors",
            docTypeInfo?.bg || "bg-primary/10"
          )}>
            <FileIcon className={cn("h-6 w-6", docTypeInfo?.color || "text-primary")} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title and actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-base leading-tight line-clamp-2">
                  {doc.label}
                </h4>
              </div>

              {/* Actions dropdown */}
              {!selectionMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover">
                    <DropdownMenuItem onClick={() => onPreview(doc)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Document
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={doc.file_url} download className="flex items-center">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onRename(doc)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onLinkChange(doc)}>
                      <Link2 className="h-4 w-4 mr-2" />
                      Change Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTogglePin(doc)}>
                      {isPinned ? (
                        <>
                          <PinOff className="h-4 w-4 mr-2" />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4 mr-2" />
                          Pin to Top
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(doc)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
              {doc.doc_type && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {doc.doc_type}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                {doc.loans.loan_name}
              </Badge>
            </div>

            {/* Linked lender */}
            {doc.loans.lenders?.name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {doc.loans.lenders.name}
              </p>
            )}

            {/* Date and file info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                Added {formatDistanceToNow(addedOnDate, { addSuffix: true })}
              </span>
              {doc.file_size && (
                <span>{formatFileSize(doc.file_size)}</span>
              )}
            </div>

            {/* Expiry status */}
            {expiryStatus && (
              <div className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border mt-2",
                expiryStatus.className
              )}>
                <expiryStatus.icon className="h-3.5 w-3.5" />
                <span className="font-medium">{expiryStatus.daysText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions on hover (mobile-friendly tap targets) */}
        {!selectionMode && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 h-9"
              onClick={() => onPreview(doc)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Open
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 h-9"
              asChild
            >
              <a href={doc.file_url} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(doc)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
