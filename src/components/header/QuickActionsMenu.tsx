import { useNavigate } from "react-router-dom";
import { 
  Plus, Receipt, CreditCard, Wallet, Building2, 
  FileUp, DollarSign 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  queryParams?: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "add-expense",
    label: "Add Expense",
    description: "Record a new expense",
    icon: Receipt,
    route: "/budget/monthly-expenses",
    queryParams: "?action=add",
    color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    id: "record-payment",
    label: "Record EMI Payment",
    description: "Log an EMI payment",
    icon: DollarSign,
    route: "/payments",
    queryParams: "?action=add",
    color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    id: "add-loan",
    label: "Add Loan",
    description: "Create a new loan",
    icon: Wallet,
    route: "/loans/new",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    id: "add-lender",
    label: "Add Lender",
    description: "Add a new lender",
    icon: Building2,
    route: "/lenders",
    queryParams: "?action=add",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    id: "add-bank-txn",
    label: "Add Bank Transaction",
    description: "Record bank transaction",
    icon: CreditCard,
    route: "/banking",
    queryParams: "?action=add-transaction",
    color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  {
    id: "upload-document",
    label: "Upload Document",
    description: "Upload loan documents",
    icon: FileUp,
    route: "/documents",
    queryParams: "?action=upload",
    color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400",
  },
];

export function QuickActionsMenu() {
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    const fullPath = `${action.route}${action.queryParams || ""}`;
    navigate(fullPath);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 touch-manipulation"
          aria-label="Quick Actions"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        sideOffset={8}
        className="w-72 bg-popover border-border shadow-xl"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">Quick Actions</p>
          <p className="text-xs text-muted-foreground">Create or record items quickly</p>
        </div>
        <DropdownMenuSeparator />
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.id}
              onSelect={(e) => {
                e.preventDefault();
                handleAction(action);
              }}
              className="flex items-center gap-3 py-3 px-3 cursor-pointer"
            >
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                action.color
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{action.label}</p>
                <p className="text-xs text-muted-foreground truncate">{action.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}