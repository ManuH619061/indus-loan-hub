import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Calculator,
  Building2,
  FileText,
  LogOut,
  Menu,
  Upload,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cash Flow", href: "/dashboard/cashflow", icon: TrendingUp },
  { name: "Lenders", href: "/dashboard/lenders", icon: Building2 },
  { name: "Risk & Alerts", href: "/dashboard/risk", icon: AlertCircle },
  { name: "Payoff Simulator", href: "/dashboard/simulator", icon: Calculator },
  { name: "Loans", href: "/loans", icon: Wallet },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Bulk Upload", href: "/payments/bulk", icon: Upload },
  { name: "Analytics", href: "/payments/analytics", icon: BarChart3 },
  { name: "Savings Calculator", href: "/payments/savings-calculator", icon: TrendingDown },
  { name: "Lender Management", href: "/lenders", icon: Building2 },
  { name: "Documents", href: "/documents", icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const NavItems = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center px-4">
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-primary rounded-lg">
                      <Wallet className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="font-bold">Loan Tracker</span>
                  </div>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                  <NavItems />
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 lg:ml-0">
            <div className="hidden lg:flex items-center gap-2">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Loan Tracker</span>
            </div>
            <span className="lg:hidden font-bold text-lg">Loan Tracker</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm">
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
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 top-14 border-r bg-card">
          <nav className="flex-1 p-4 space-y-1">
            <NavItems />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="container p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
