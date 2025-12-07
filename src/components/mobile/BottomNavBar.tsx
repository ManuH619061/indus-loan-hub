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
    label: "AI",
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full pt-1 pb-1 relative transition-colors touch-manipulation",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className={cn("h-5 w-5 mb-0.5", active && "scale-110")} />
              <span className={cn("text-[10px] font-medium", active && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
