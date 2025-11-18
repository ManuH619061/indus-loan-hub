import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { loanAppsLibrary, getCategoryLabel, getCategoryColor } from "@/lib/loan-apps-library";
import type { LoanAppLibraryItem } from "@/lib/loan-apps-library";

interface MultiLenderSelectorProps {
  selectedApps: LoanAppLibraryItem[];
  onSelectionChange: (apps: LoanAppLibraryItem[]) => void;
  maxSelection?: number;
}

export default function MultiLenderSelector({
  selectedApps,
  onSelectionChange,
  maxSelection = 4,
}: MultiLenderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredApps = loanAppsLibrary.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleApp = (app: LoanAppLibraryItem) => {
    const isSelected = selectedApps.some((a) => a.id === app.id);
    if (isSelected) {
      onSelectionChange(selectedApps.filter((a) => a.id !== app.id));
    } else if (selectedApps.length < maxSelection) {
      onSelectionChange([...selectedApps, app]);
    }
  };

  const isSelected = (appId: string) => selectedApps.some((a) => a.id === appId);
  const canSelectMore = selectedApps.length < maxSelection;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {selectedApps.length === 0
            ? "Select Lenders to Compare"
            : `${selectedApps.length} lender${selectedApps.length > 1 ? "s" : ""} selected`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Select Lenders to Compare ({selectedApps.length}/{maxSelection})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search lenders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-3 max-h-[50vh] overflow-y-auto">
            {filteredApps.map((app) => {
              const selected = isSelected(app.id);
              return (
                <div
                  key={app.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  } ${!canSelectMore && !selected ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => (canSelectMore || selected) && toggleApp(app)}
                >
                  <div className="flex items-start gap-3">
                    {app.logo_url ? (
                      <img
                        src={app.logo_url}
                        alt={app.name}
                        className="w-12 h-12 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold">
                        {app.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{app.name}</h3>
                          <Badge
                            variant="outline"
                            className={`mt-1 ${getCategoryColor(app.category)}`}
                          >
                            {getCategoryLabel(app.category)}
                          </Badge>
                        </div>
                        {selected && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Interest: {app.typical_interest_min}% - {app.typical_interest_max}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
