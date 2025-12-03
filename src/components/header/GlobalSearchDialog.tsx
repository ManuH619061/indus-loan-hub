import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, Wallet, Building2, CreditCard, Receipt, 
  LayoutDashboard, Calculator, Landmark, Calendar, 
  Bot, TrendingUp, FileText, Settings, X 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGlobalSearch, SearchResult } from "@/hooks/useGlobalSearch";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  Wallet,
  Building2,
  Calculator,
  Receipt,
  Landmark,
  Calendar,
  CreditCard,
  Bot,
  TrendingUp,
  FileText,
  Settings,
};

const TYPE_ICONS: Record<string, any> = {
  loan: Wallet,
  lender: Building2,
  payment: CreditCard,
  expense: Receipt,
  navigation: LayoutDashboard,
};

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results, isLoading, navigationShortcuts } = useGlobalSearch();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [open, setQuery]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const displayResults = query.length >= 2 ? results : navigationShortcuts;
  const groupedResults = groupResults(displayResults);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    navigate(result.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const flatResults = displayResults;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex]);
        } else if (query.trim().length >= 2) {
          // Navigate to full search page if no result selected
          onOpenChange(false);
          navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        }
        break;
      case "Escape":
        onOpenChange(false);
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-xl p-0 gap-0 overflow-hidden" 
        hideCloseButton
      >
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search loans, lenders, payments, expenses or type a page name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 h-12"
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Searching...
            </div>
          ) : displayResults.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {query.length >= 2 ? "No results found" : "Start typing to search..."}
            </div>
          ) : (
            <>
              {Object.entries(groupedResults).map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    {group}
                  </div>
                  {items.map((result, idx) => {
                    const globalIndex = displayResults.findIndex(r => r.id === result.id);
                    const Icon = result.icon ? ICON_MAP[result.icon] : TYPE_ICONS[result.type];
                    
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors",
                          globalIndex === selectedIndex && "bg-muted"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                          result.type === "navigation" && "bg-primary/10 text-primary",
                          result.type === "loan" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                          result.type === "lender" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
                          result.type === "payment" && "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
                          result.type === "expense" && "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        )}>
                          {Icon && <Icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.type === "navigation" && (
                          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
          <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">/</kbd> to search anytime</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupResults(results: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {};
  const groupLabels: Record<string, string> = {
    navigation: "Quick Navigation",
    loan: "Loans",
    lender: "Lenders",
    payment: "Payments",
    expense: "Expenses",
  };

  results.forEach(result => {
    const label = groupLabels[result.type] || "Other";
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(result);
  });

  return groups;
}
