import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Receipt,
  Wallet,
  DollarSign,
  Building2,
  FileUp,
  CreditCard,
  Target,
  Landmark,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  queryParams?: string;
  gradient: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "add-expense",
    label: "Add Expense",
    icon: Receipt,
    route: "/budget/monthly-expenses",
    queryParams: "?action=add",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    id: "record-payment",
    label: "Record EMI",
    icon: DollarSign,
    route: "/payments",
    queryParams: "?action=add",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    id: "add-loan",
    label: "Add Loan",
    icon: Wallet,
    route: "/loans/new",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "add-lender",
    label: "Add Lender",
    icon: Building2,
    route: "/lenders",
    queryParams: "?action=add",
    gradient: "from-purple-500 to-violet-500",
  },
  {
    id: "add-bank-txn",
    label: "Bank Txn",
    icon: Landmark,
    route: "/banking/accounts",
    queryParams: "?action=add-transaction",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    id: "upload-doc",
    label: "Upload Doc",
    icon: FileUp,
    route: "/documents",
    queryParams: "?action=upload",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    id: "create-goal",
    label: "Savings Goal",
    icon: Target,
    route: "/budget/savings-goals",
    queryParams: "?action=add",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    id: "compare-loans",
    label: "Compare",
    icon: Calculator,
    route: "/loan-comparison",
    gradient: "from-sky-500 to-blue-500",
  },
];

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    const fullPath = `${action.route}${action.queryParams || ""}`;
    navigate(fullPath);
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-20 left-3 right-3 z-50 bg-card rounded-2xl border border-border/50 shadow-2xl p-4 md:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-foreground">Quick Actions</h3>
                <p className="text-xs text-muted-foreground">Create or record items</p>
              </div>
              <motion.button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </motion.button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {QUICK_ACTIONS.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleAction(action)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all touch-manipulation"
                  >
                    <div className={cn(
                      "p-2 rounded-xl bg-gradient-to-br shadow-sm",
                      action.gradient
                    )}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-[9px] font-medium text-foreground text-center leading-tight line-clamp-2">
                      {action.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed z-50 md:hidden w-14 h-14 rounded-full shadow-xl flex items-center justify-center touch-manipulation",
          "bg-gradient-to-br from-primary to-primary/80",
          isOpen ? "right-4 bottom-24" : "right-4 bottom-20"
        )}
        whileTap={{ scale: 0.92 }}
        animate={{ 
          rotate: isOpen ? 45 : 0,
          scale: isOpen ? 0.95 : 1 
        }}
        transition={{ duration: 0.2 }}
        style={{
          boxShadow: "0 8px 32px hsl(var(--primary) / 0.35)"
        }}
      >
        <Plus className="h-7 w-7 text-primary-foreground" />
      </motion.button>
    </>
  );
}
