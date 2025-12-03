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
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { useIsMobile } from "@/hooks/use-mobile";

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
      { name: "Category Manager", href: "/budget/category-manager", icon: SettingsIcon },
      { name: "Budget History", href: "/budget-history", icon: BarChart3 },
      { name: "Future Cash-Flow", href: "/budget/future-cashflow", icon: TrendingUp },
      { name: "Savings & Goals", href: "/budget/savings-goals", icon: TrendingUp },
      { name: "Visual Reports", href: "/budget/visual-reports", icon: BarChart3 },
      { name: "Budget Reports", href: "/budget/reports", icon: FileText },
    ]
  },
  { 
    name: "AI Advice Manager", 
    key: "ai",
    icon: Sparkles,
    children: [
      { name: "AI Chat Advisor", href: "/ai/chat", icon: Sparkles },
      { name: "AI Insights", href: "/insights", icon: Sparkles },
      { name: "Budget AI Advice", href: "/ai/budget-advice", icon: TrendingUp },
      { name: "Expense AI Advice", href: "/ai/expense-advice", icon: Receipt },
      { name: "Loan & EMI AI Advice", href: "/ai/loan-advice", icon: Wallet },
    ]
  },
  { name: "Financial Insights", href: "/financial-insights", icon: BarChart3 },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Settings", href: "/settings", icon: SettingsIcon },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isMobileLayout } = useDisplayMode();
  const isMobileDevice = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    banking: false,
    loans: false,
    budget: false,
    ai: false,
  });

  // Enable swipe-from-left-edge to open drawer
  const openDrawer = useCallback(() => setMobileMenuOpen(true), []);
  useSwipeToOpen(openDrawer);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // On mobile, only one section open at a time
        const newState: Record<string, boolean> = {
          banking: false,
          loans: false,
          budget: false,
          ai: false,
        };
        newState[key] = !prev[key];
        return newState;
      } else {
        // On desktop, allow multiple sections open
        return {
          ...prev,
          [key]: !prev[key]
        };
      }
    });
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
        const iconSize = isMobile ? "h-5 w-5" : "h-4 w-4";
        const textSize = isMobile ? "text-base" : "text-sm";
        const padding = isMobile ? "px-3 py-3" : "px-2.5 py-2";
        const gap = isMobile ? "gap-3" : "gap-2.5";
        
        if ('children' in item && item.children && 'key' in item) {
          const isAnyChildActive = item.children.some(child => location.pathname === child.href);
          const isExpanded = expandedSections[item.key as string] ?? true;
          
          return (
            <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleSection(item.key as string)}
                  className={cn(
                    "flex items-center justify-between w-full rounded-lg transition-colors touch-target",
                    "text-muted-foreground hover:bg-muted/70 active:bg-muted",
                    padding,
                    textSize,
                    "font-medium"
                  )}
                  aria-expanded={isExpanded}
                >
                  <div className={cn("flex items-center", gap)}>
                    <Icon className={iconSize} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown 
                    className={cn(
                      "h-4 w-4 transition-transform duration-200 flex-shrink-0",
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

  // Show mobile layout if: display mode is "mobile" OR display mode is "auto" and screen is small
  const showMobileLayout = isMobileLayout;

  return (
    <div className={cn(
      "min-h-screen bg-background overflow-x-hidden max-w-full",
      showMobileLayout && "mobile-view"
    )}>
      {/* Header - Mobile style when mobile layout is active */}
      <header className={cn(
        "sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 safe-top",
        showMobileLayout && "shadow-sm"
      )}>
        <div className={cn(
          "flex items-center px-3 max-w-full",
          showMobileLayout ? "h-14" : "h-14 md:h-14 md:px-6"
        )}>
          {/* Hamburger Menu Button - Show when mobile layout is active */}
          {showMobileLayout && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 touch-target mr-2 flex-shrink-0"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Desktop Menu Button - Only visible when NOT in mobile layout on small screens */}
          {!showMobileLayout && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-10 w-10 touch-target mr-2 flex-shrink-0"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Mobile Drawer */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent 
              side="left" 
              className="w-[85vw] max-w-[320px] p-0 border-r-0"
            >
              <div className="flex flex-col h-full bg-card overflow-y-auto">
                {/* Drawer Header - User Profile */}
                <div className="p-4 border-b bg-primary/5 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-primary rounded-lg">
                        <Wallet className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <span className="font-semibold text-base">Loan Tracker</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 touch-target flex-shrink-0"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {/* User Info */}
                  <div className="flex items-center gap-2.5 px-1">
                    <Avatar className="h-10 w-10 border-2 border-primary/20 flex-shrink-0">
                      <AvatarImage 
                        src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture} 
                        alt={user?.user_metadata?.full_name || user?.user_metadata?.name || "User"} 
                      />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                        {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "U")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user?.user_metadata?.full_name || user?.user_metadata?.name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Drawer Navigation */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
                  <NavItems isMobile={true} />
                </nav>

                {/* Drawer Footer */}
                <div className="p-3 border-t bg-muted/20 flex-shrink-0 safe-bottom">
                  <Button 
                    variant="outline" 
                    className="w-full h-11 text-sm touch-target" 
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3 md:ml-0 flex-1 min-w-0">
            {!showMobileLayout && (
              <div className="hidden md:flex items-center gap-2">
                <div className="p-1.5 bg-gradient-primary rounded-lg flex-shrink-0">
                  <Wallet className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-base truncate">Loan Tracker</span>
              </div>
            )}
            <div className={cn(
              "flex items-center gap-2",
              showMobileLayout ? "" : "md:hidden"
            )}>
              <div className="p-1.5 bg-gradient-primary rounded-lg flex-shrink-0">
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-base truncate">Loan Tracker</span>
            </div>
          </div>

          {/* Desktop User Profile - Hide in mobile layout */}
          {!showMobileLayout && (
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <UserProfileDropdown user={user} onSignOut={handleSignOut} />
            </div>
          )}
          
          {/* Mobile header user avatar */}
          {showMobileLayout && (
            <div className="flex-shrink-0">
              <UserProfileDropdown user={user} onSignOut={handleSignOut} />
            </div>
          )}
        </div>
      </header>

      <div className="flex overflow-x-hidden">
        {/* Sidebar - Desktop Only (Hide in mobile layout) */}
        {!showMobileLayout && (
          <aside className="hidden md:flex w-60 flex-col fixed inset-y-0 top-14 border-r bg-card overflow-y-auto">
            <nav className="flex-1 p-3 space-y-1 scrollbar-hide">
              <NavItems isMobile={false} />
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 w-full overflow-x-hidden",
          !showMobileLayout && "md:ml-60"
        )}>
          <div className={cn(
            "mx-auto w-full",
            showMobileLayout 
              ? "p-3 max-w-full" 
              : "p-3 md:p-4 lg:p-6 max-w-[1400px]"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
