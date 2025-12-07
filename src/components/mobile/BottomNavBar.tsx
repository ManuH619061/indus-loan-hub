import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Wallet, Receipt, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  matchPaths?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    path: "/dashboard",
    matchPaths: ["/dashboard"],
  },
  {
    id: "loans",
    label: "Loans",
    icon: Wallet,
    path: "/loans",
    matchPaths: ["/loans", "/payments", "/lenders", "/emi-calendar", "/loan-comparison"],
  },
  {
    id: "spending",
    label: "Spending",
    icon: Receipt,
    path: "/budget/spending",
    matchPaths: ["/budget/spending", "/budget/monthly-expenses", "/expenses"],
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    path: "/budget/overview",
    matchPaths: ["/budget", "/financial-insights", "/insights"],
  },
  {
    id: "ai",
    label: "FinPath AI",
    icon: Sparkles,
    path: "/ai/chat",
    matchPaths: ["/ai"],
  },
];

export function BottomNavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (item: NavItem) => {
    if (location.pathname === item.path) return true;
    return item.matchPaths?.some((p) => location.pathname.startsWith(p)) ?? false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border/50 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1.5 relative transition-all duration-200 touch-manipulation rounded-xl mx-0.5",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute inset-1 bg-primary/10 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  active && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium leading-tight",
                  active && "font-semibold"
                )}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
