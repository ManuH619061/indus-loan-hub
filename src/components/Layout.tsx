import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  TrendingUp,
  Building2,
  FileText,
  LogOut,
  Menu,
  BarChart3,
  Scale,
  Receipt,
  ChevronDown,
  X,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// Hook for swipe-to-open gesture
function useSwipeToOpen(onOpen: () => void, edgeThreshold = 30, minSwipeDistance = 50) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // Only track if starting from left edge
    if (touch.clientX <= edgeThreshold) {
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
    }
  }, [edgeThreshold]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    // If swiping more horizontally than vertically and swiped far enough
    if (deltaX > minSwipeDistance && deltaX > deltaY * 2) {
      onOpen();
      touchStartX.current = null;
      touchStartY.current = null;
    }
  }, [minSwipeDistance, onOpen]);

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  useEffect(() => {
    // Only add listeners on mobile
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { 
    name: "Bank Manager", 
    key: "banking",
    icon: Building2,
    children: [
      { name: "Bank Accounts", href: "/banking/accounts", icon: Building2 },
      { name: "BRS Report", href: "/banking/brs-report", icon: BarChart3 },
      { name: "Transactions", href: "/expenses", icon: Receipt },
    ]
  },
  { 
    name: "Loan Manager", 
    key: "loans",
    icon: Wallet,
    children: [
      { name: "Loans", href: "/loans", icon: Wallet },
      { name: "Lenders", href: "/lenders", icon: Building2 },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "EMI Calendar", href: "/emi-calendar", icon: CalendarDays },
      { name: "Loan & Lender Comparison", href: "/loan-comparison", icon: Scale },
      { name: "Debt Payoff Calculator", href: "/budget/debt-optimizer", icon: Scale },
    ]
  },
  { 
    name: "Budget Manager", 
    key: "budget",
    icon: TrendingUp,
    children: [
      { name: "Budget Planner", href: "/budget-planner", icon: TrendingUp },
      { name: "Monthly Expenses", href: "/budget/monthly-expenses", icon: Receipt },
      { name: "Budget History", href: "/budget-history", icon: BarChart3 },
      { name: "Future Cash-Flow", href: "/budget/future-cashflow", icon: TrendingUp },
      { name: "Savings & Goals", href: "/budget/savings-goals", icon: TrendingUp },
      { name: "Budget Reports", href: "/budget/reports", icon: FileText },
    ]
  },
  { 
    name: "AI Advice Manager", 
    key: "ai",
    icon: FileText,
    children: [
      { name: "AI Insights", href: "/insights", icon: FileText },
      { name: "Budget AI Advice", href: "/ai/budget-advice", icon: TrendingUp },
      { name: "Expense AI Advice", href: "/ai/expense-advice", icon: Receipt },
      { name: "Loan & EMI AI Advice", href: "/ai/loan-advice", icon: Wallet },
    ]
  },
  { name: "Financial Insights", href: "/financial-insights", icon: BarChart3 },
  { name: "Documents", href: "/documents", icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    banking: true,
    loans: true,
    budget: true,
    ai: false,
  });

  // Enable swipe-from-left-edge to open drawer
  const openDrawer = useCallback(() => setMobileMenuOpen(true), []);
  useSwipeToOpen(openDrawer);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const NavItems = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const iconSize = isMobile ? "h-6 w-6" : "h-5 w-5";
        const textSize = isMobile ? "text-base" : "text-sm";
        const padding = isMobile ? "px-4 py-4" : "px-3 py-2";
        const gap = isMobile ? "gap-4" : "gap-3";
        
        if ('children' in item && item.children && 'key' in item) {
          const isAnyChildActive = item.children.some(child => location.pathname === child.href);
          const isExpanded = expandedSections[item.key as string] ?? true;
          
          return (
            <div key={item.name} className="space-y-1">
              <button
                onClick={() => toggleSection(item.key as string)}
                className={cn(
                  "flex items-center justify-between w-full rounded-lg transition-colors touch-target",
                  "text-muted-foreground hover:bg-muted active:bg-muted/80",
                  padding,
                  textSize,
                  "font-medium"
                )}
              >
                <div className={cn("flex items-center", gap)}>
                  <Icon className={iconSize} />
                  <span>{item.name}</span>
                </div>
                <ChevronDown 
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
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
                    <div className={cn(
                      "border-l-2 border-muted",
                      isMobile ? "ml-5 pl-4 space-y-1" : "ml-4 pl-2 space-y-1"
                    )}>
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isActive = location.pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            onClick={handleNavClick}
                            className={cn(
                              "flex items-center rounded-lg font-medium transition-all duration-200 relative overflow-hidden touch-target",
                              padding,
                              gap,
                              textSize,
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId={isMobile ? "activeNavMobile" : "activeNav"}
                                className="absolute inset-0 bg-primary rounded-lg"
                                initial={false}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 30,
                                }}
                              />
                            )}
                            <span className={cn("relative z-10 flex items-center", gap)}>
                              <ChildIcon className={iconSize} />
                              {child.name}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }
        
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={handleNavClick}
            className={cn(
              "flex items-center rounded-lg font-medium transition-all duration-200 relative overflow-hidden touch-target",
              padding,
              gap,
              textSize,
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
            )}
          >
            {isActive && (
              <motion.div
                layoutId={isMobile ? "activeNavMobile" : "activeNav"}
                className="absolute inset-0 bg-primary rounded-lg"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}
            <span className={cn("relative z-10 flex items-center", gap)}>
              <Icon className={iconSize} />
              {item.name}
            </span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - Larger and more app-like */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-top">
        <div className="flex h-16 md:h-14 items-center px-4 md:px-6">
          {/* Mobile Menu Button - Always visible on mobile */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden h-12 w-12 touch-target mr-2"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-7 w-7" />
          </Button>

          {/* Mobile Drawer */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent 
              side="left" 
              className="w-[85vw] max-w-[320px] p-0 border-r-0"
            >
              <div className="flex flex-col h-full bg-card">
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-5 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-primary rounded-xl">
                      <Wallet className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <span className="font-bold text-xl">Loan Tracker</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-11 w-11 touch-target"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
                
                {/* Drawer Navigation */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                  <NavItems isMobile={true} />
                </nav>

                {/* Drawer Footer */}
                <div className="p-4 border-t bg-muted/30">
                  <div className="mb-3 px-2">
                    <p className="text-sm text-muted-foreground">Signed in as</p>
                    <p className="text-base font-medium truncate">{user?.email}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-base touch-target" 
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-3 md:ml-0 ml-2">
            <div className="hidden md:flex items-center gap-2">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Loan Tracker</span>
            </div>
            <span className="md:hidden font-bold text-xl">Loan Tracker</span>
          </div>

          <div className="flex-1" />

          {/* Desktop User Info */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 top-14 border-r bg-card">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
            <NavItems isMobile={false} />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
