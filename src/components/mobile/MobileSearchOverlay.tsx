import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, X, ArrowLeft, Wallet, Building2, Receipt, 
  FileText, Sparkles, BarChart3, CreditCard, History 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_LINKS = [
  { label: "Loans", icon: Wallet, path: "/loans", color: "text-blue-500" },
  { label: "Lenders", icon: Building2, path: "/lenders", color: "text-purple-500" },
  { label: "Expenses", icon: Receipt, path: "/budget/spending", color: "text-orange-500" },
  { label: "Documents", icon: FileText, path: "/documents", color: "text-teal-500" },
  { label: "AI Advisor", icon: Sparkles, path: "/ai/chat", color: "text-amber-500" },
  { label: "Reports", icon: BarChart3, path: "/budget/reports-hub", color: "text-green-500" },
  { label: "Payments", icon: CreditCard, path: "/payments", color: "text-indigo-500" },
];

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  loan: Wallet,
  lender: Building2,
  payment: CreditCard,
  expense: Receipt,
  document: FileText,
  page: BarChart3,
};

export function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results, isLoading, setQuery: setSearchQuery } = useGlobalSearch();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!open) {
      setQuery("");
      setSearchQuery("");
    }
  }, [open, setSearchQuery]);

  useEffect(() => {
    setSearchQuery(query);
  }, [query, setSearchQuery]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background md:hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-3 border-b border-border/50 bg-card safe-top">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors touch-manipulation"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search loans, lenders, expenses..."
                className="pl-10 pr-10 h-11 bg-muted/50 border-0 text-base"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!query ? (
              <>
                {/* Quick Links */}
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <History className="h-3 w-3" />
                    QUICK ACCESS
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_LINKS.map((link) => {
                      const Icon = link.icon;
                      return (
                        <button
                          key={link.path}
                          onClick={() => handleSelect(link.path)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all touch-manipulation"
                        >
                          <Icon className={cn("h-5 w-5", link.color)} />
                          <span className="text-[10px] font-medium text-foreground">
                            {link.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Suggestions */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    TRY SEARCHING
                  </p>
                  <div className="space-y-2">
                    {[
                      "My active loans",
                      "HDFC Bank lender",
                      "Recent payments",
                      "Upload documents",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setQuery(suggestion)}
                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-muted/30 hover:bg-muted text-left transition-colors"
                      >
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Search Results */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result, index) => {
                      const Icon = TYPE_ICONS[result.type] || Search;
                      return (
                        <motion.button
                          key={`${result.type}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => handleSelect(result.route)}
                          className="flex items-center gap-3 w-full p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 text-left transition-all active:scale-[0.98]"
                        >
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No results for "{query}"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try different keywords
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
