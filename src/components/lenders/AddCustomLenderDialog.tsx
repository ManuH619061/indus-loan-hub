import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loanAppsLibrary, getCategoryLabel } from "@/lib/loan-apps-library";
import { useState, useMemo } from "react";
import { Search, Sparkles } from "lucide-react";

interface AddCustomLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderData: {
    name: string;
    type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER";
    logo_url?: string;
    website?: string;
    contact: string;
    notes: string;
  };
  onDataChange: (data: any) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function AddCustomLenderDialog({
  open,
  onOpenChange,
  lenderData,
  onDataChange,
  onSubmit,
  loading,
}: AddCustomLenderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(true);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return loanAppsLibrary.slice(0, 12);
    return loanAppsLibrary.filter(app =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const mapCategoryToType = (category: string): "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER" => {
    switch (category) {
      case "BANK": return "BANK";
      case "NBFC": return "NBFC";
      case "CREDIT_CARD": return "CARD";
      case "INSTANT_LOAN":
      case "BNPL":
      case "SALARY_ADVANCE":
      default:
        return "OTHER";
    }
  };

  const handleQuickSelect = (app: typeof loanAppsLibrary[0]) => {
    onDataChange({
      ...lenderData,
      name: app.name,
      type: mapCategoryToType(app.category),
      logo_url: app.logo_url || "",
      website: app.website || "",
    });
    setShowQuickAdd(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && lenderData.name.trim() && !loading) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery("");
      setShowQuickAdd(true);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Lender</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4" onKeyPress={handleKeyPress}>
          {/* Quick Add Section */}
          {showQuickAdd && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Quick add from popular lenders</span>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search banks, apps, NBFCs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[180px] rounded-md border">
                <div className="grid grid-cols-2 gap-2 p-2">
                  {filteredApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleQuickSelect(app)}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left transition-colors border border-transparent hover:border-border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{getCategoryLabel(app.category)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {filteredApps.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No matches found. Enter details manually below.
                  </div>
                )}
              </ScrollArea>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or enter manually</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          <div className="space-y-4">
            {!showQuickAdd && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickAdd(true)}
                className="text-xs text-muted-foreground"
              >
                ← Back to quick add
              </Button>
            )}

            <div className="space-y-2">
              <Label>Lender Name *</Label>
              <Input
                value={lenderData.name}
                onChange={(e) => onDataChange({ ...lenderData, name: e.target.value })}
                placeholder="e.g., HDFC Bank, Navi, Slice"
                autoFocus={!showQuickAdd}
              />
              {lenderData.name && (
                <p className="text-xs text-muted-foreground">
                  Selected: <Badge variant="secondary" className="text-xs ml-1">{lenderData.name}</Badge>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Lender Type *</Label>
              <Select
                value={lenderData.type}
                onValueChange={(value: any) => onDataChange({ ...lenderData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="OTHER">App / Fintech</SelectItem>
                  <SelectItem value="NBFC">NBFC</SelectItem>
                  <SelectItem value="FRIEND">Friend / Family</SelectItem>
                  <SelectItem value="CARD">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contact Number (optional)</Label>
              <Input
                value={lenderData.contact}
                onChange={(e) => onDataChange({ ...lenderData, contact: e.target.value })}
                placeholder="Phone or email"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={lenderData.notes}
                onChange={(e) => onDataChange({ ...lenderData, notes: e.target.value })}
                placeholder="Any additional notes about this lender"
                rows={2}
              />
            </div>

            <Button onClick={onSubmit} disabled={loading || !lenderData.name.trim()} className="w-full">
              {loading ? "Adding..." : "Add Lender"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}