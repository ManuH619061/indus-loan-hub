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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  queryParams?: string;
  color: string;
  bgColor: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "add-expense",
    label: "Add Expense",
    icon: Receipt,
    route: "/budget/monthly-expenses",
    queryParams: "?action=add",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/40",
  },
  {
    id: "record-payment",
    label: "Record EMI",
    icon: DollarSign,
    route: "/payments",
    queryParams: "?action=add",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/40",
  },
  {
    id: "add-loan",
    label: "Add Loan",
    icon: Wallet,
    route: "/loans/new",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
  },
  {
    id: "add-lender",
    label: "Add Lender",
    icon: Building2,
    route: "/lenders",
    queryParams: "?action=add",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/40",
  },
  {
    id: "add-bank-txn",
    label: "Bank Txn",
    icon: CreditCard,
    route: "/banking/accounts",
    queryParams: "?action=add-transaction",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/40",
  },
  {
    id: "upload-doc",
    label: "Upload Doc",
    icon: FileUp,
    route: "/documents",
    queryParams: "?action=upload",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-100 dark:bg-teal-900/40",
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
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
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-card rounded-2xl border border-border shadow-xl p-4 md:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Quick Actions</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {QUICK_ACTIONS.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleAction(action)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all touch-manipulation"
                  >
                    <div className={cn("p-2.5 rounded-full", action.bgColor)}>
                      <Icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center leading-tight">
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
          "fixed right-4 z-50 md:hidden w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors touch-manipulation",
          isOpen
            ? "bg-muted text-muted-foreground bottom-24"
            : "bg-primary text-primary-foreground bottom-20"
        )}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Plus className="h-6 w-6" />
      </motion.button>
    </>
  );
}
