import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loanAppsLibrary } from "@/lib/loan-apps-library";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import LenderLogoUpload from "./LenderLogoUpload";

interface AddCustomLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderData: {
    name: string;
    type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER";
    logo_url: string;
    website: string;
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState(loanAppsLibrary);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && lenderData.name.trim() && !loading) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleNameChange = (value: string) => {
    onDataChange({ ...lenderData, name: value });
    
    // Filter suggestions based on input
    if (value.trim().length > 0) {
      const filtered = loanAppsLibrary.filter(app =>
        app.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions(loanAppsLibrary);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = (appName: string) => {
    const selectedApp = loanAppsLibrary.find(app => app.name === appName);
    if (selectedApp) {
      onDataChange({
        ...lenderData,
        name: selectedApp.name,
        website: selectedApp.website || lenderData.website,
      });
    }
    setShowSuggestions(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Lender</DialogTitle>
        </DialogHeader>
        <div className="space-y-4" onKeyPress={handleKeyPress}>
          <div className="space-y-2">
            <Label>Lender Name *</Label>
            <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    value={lenderData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => {
                      if (lenderData.name.trim().length > 0 && filteredSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="e.g., Local Credit Union"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandEmpty>No lenders found.</CommandEmpty>
                    <CommandGroup heading="Popular Loan Apps">
                      {filteredSuggestions.slice(0, 8).map((app) => (
                        <CommandItem
                          key={app.id}
                          value={app.name}
                          onSelect={() => handleSuggestionSelect(app.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              lenderData.name === app.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{app.name}</span>
                            <span className="text-xs text-muted-foreground">{app.category}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={lenderData.type}
              onValueChange={(value: any) => onDataChange({ ...lenderData, type: value })}
            >
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

          <LenderLogoUpload
            lenderName={lenderData.name}
            logoUrl={lenderData.logo_url}
            onLogoChange={(url) => onDataChange({ ...lenderData, logo_url: url })}
            disabled={loading}
          />

          <div className="space-y-2">
            <Label>Website (optional)</Label>
            <Input
              value={lenderData.website}
              onChange={(e) => onDataChange({ ...lenderData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact (optional)</Label>
            <Input
              value={lenderData.contact}
              onChange={(e) => onDataChange({ ...lenderData, contact: e.target.value })}
              placeholder="Phone or email"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={lenderData.notes}
              onChange={(e) => onDataChange({ ...lenderData, notes: e.target.value })}
              placeholder="Any additional notes"
            />
          </div>
          <Button onClick={onSubmit} disabled={loading || !lenderData.name} className="w-full">
            {loading ? "Adding..." : "Add Lender"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
