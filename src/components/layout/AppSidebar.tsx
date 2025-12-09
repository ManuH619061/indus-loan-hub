import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Building2,
  Wallet,
  TrendingUp,
  Sparkles,
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
  CreditCard,
  CalendarDays,
  Scale,
  Receipt,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Flame,
  PiggyBank,
  AlertTriangle,
  LineChart,
  Target,
  Bot,
  FileBarChart,
  Brain,
  HeartPulse,
  Lightbulb,
  FolderOpen,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import finpathLogo from "@/assets/finpath-logo.png";

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
}

const navigation = [
  { name: "Main Dashboard", href: "/dashboard", icon: Home },
  {
    name: "Loan Manager",
    key: "loans",
    icon: Wallet,
    children: [
      { name: "All Loans", href: "/loans", icon: Wallet },
      { name: "Lenders", href: "/lenders", icon: Building2 },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "EMI Calendar", href: "/emi-calendar", icon: CalendarDays },
      { name: "Smart Comparison Hub", href: "/loan-comparison", icon: Scale },
    ],
  },
  {
    name: "Budget & Spending",
    key: "budget",
    icon: TrendingUp,
    children: [
      { name: "Monthly Expenses", href: "/budget/monthly-expenses", icon: Receipt },
      { name: "Budget Planner", href: "/budget/planner", icon: TrendingUp },
      { name: "12-Month Forecast", href: "/budget/overview", icon: BarChart3 },
      { name: "Spending Tracker", href: "/budget/spending", icon: LineChart },
    ],
  },
  {
    name: "Financial Intelligence",
    key: "intelligence",
    icon: Brain,
    children: [
      { name: "Credit Health Center", href: "/credit-health", icon: HeartPulse },
      { name: "AI Insights & Predictions", href: "/ai/chat", icon: Sparkles },
      { name: "Debt Optimizer", href: "/budget/debt-optimizer", icon: Calculator },
    ],
  },
  {
    name: "Dashboards",
    key: "dashboards",
    icon: LayoutDashboard,
    children: [
      { name: "Overview", href: "/dashboard", icon: Home },
      { name: "Cashflow & Budget", href: "/dashboards/cashflow", icon: TrendingUp },
      { name: "EMI Heatmap", href: "/dashboards/emi-heatmap", icon: Flame },
      { name: "Loan Risk Analysis", href: "/dashboards/loan-risk", icon: AlertTriangle },
      { name: "Spending Intelligence", href: "/dashboards/spending", icon: LineChart },
      { name: "Savings & Goals", href: "/dashboards/savings-goals", icon: Target },
      { name: "Bank Trends", href: "/dashboards/bank-trends", icon: PiggyBank },
      { name: "AI Advisor", href: "/dashboards/ai-advisor", icon: Bot },
    ],
  },
  {
    name: "Banking",
    key: "banking",
    icon: Building2,
    children: [
      { name: "Bank Accounts", href: "/banking/accounts", icon: Building2 },
      { name: "BRS Report", href: "/banking/brs-report", icon: BarChart3 },
      { name: "Transactions", href: "/expenses", icon: Receipt },
    ],
  },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar({ isOpen, onClose, isCollapsed, onCollapseToggle }: AppSidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboards: false,
    banking: false,
    loans: false,
    budget: false,
  });

  // Auto-expand section if current route is within it
  useEffect(() => {
    navigation.forEach((item) => {
      if ("children" in item && item.children) {
        const isChildActive = item.children.some((child) => location.pathname === child.href);
        if (isChildActive) {
          setExpandedSections((prev) => ({ ...prev, [item.key as string]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (href: string) => location.pathname === href;

  const NavItem = ({ item, isChild = false }: { item: any; isChild?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        to={item.href}
        onClick={() => window.innerWidth < 768 && onClose()}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
          isChild && "ml-6 text-[13px]",
          active
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-r-full"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isCollapsed && !isChild && "mx-auto")} />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  const NavGroup = ({ item }: { item: any }) => {
    const Icon = item.icon;
    const isExpanded = expandedSections[item.key] ?? false;
    const hasActiveChild = item.children.some((child: any) => isActive(child.href));

    if (isCollapsed) {
      return (
        <div className="relative group">
          <button
            className={cn(
              "flex items-center justify-center w-full px-3 py-2.5 rounded-lg transition-colors",
              hasActiveChild
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
          {/* Tooltip/Flyout for collapsed state */}
          <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50">
            <div className="bg-popover border rounded-lg shadow-lg py-2 min-w-48">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground">{item.name}</p>
              {item.children.map((child: any) => (
                <Link
                  key={child.name}
                  to={child.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted",
                    isActive(child.href) && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  {child.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleSection(item.key)}
          className={cn(
            "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            hasActiveChild
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.name}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5 py-1">
                {item.children.map((child: any) => (
                  <NavItem key={child.name} item={child} isChild />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-14 md:top-16 left-0 z-40 bg-sidebar border-r transition-all duration-300 flex flex-col",
          // On mobile, extend to bottom nav; on desktop, extend to screen bottom
          "bottom-16 md:bottom-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo Header */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-4 border-b",
          isCollapsed ? "justify-center" : "justify-start"
        )}>
          <img 
            src={finpathLogo} 
            alt="FinPath" 
            className={cn(
              "rounded-lg shadow-sm transition-all",
              isCollapsed ? "h-8 w-8" : "h-10 w-10"
            )} 
          />
          {!isCollapsed && (
            <span className="font-semibold text-foreground">FinPath</span>
          )}
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-1">
            {navigation.map((item) =>
              "children" in item && item.children ? (
                <NavGroup key={item.name} item={item} />
              ) : (
                <NavItem key={item.name} item={item} />
              )
            )}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle - Desktop Only */}
        <div className="hidden md:flex p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-muted-foreground hover:text-foreground"
            onClick={onCollapseToggle}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
