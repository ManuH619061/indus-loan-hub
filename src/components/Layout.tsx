import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "./BottomNav";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Building2,
  LineChart,
  FileText,
  PiggyBank,
  Calendar,
  History,
  TrendingUp,
  Target,
  Receipt,
  HandCoins,
  Landmark,
  GitCompare,
  Banknote,
  BarChart3,
  Settings,
  ShoppingBag,
  DollarSign,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  children?: NavSubItem[];
}

interface NavSubItem {
  name: string;
  href?: string;
  icon: any;
  subChildren?: { name: string; href: string; icon: any }[];
}

const navigation: NavItem[] = [
  { 
    name: "Dashboard", 
    href: "/", 
    icon: LayoutDashboard 
  },
  {
    name: "Money Manager",
    icon: Wallet,
    children: [
      { name: "Budget Planner", href: "/budget-planner", icon: PiggyBank },
      { name: "Monthly Expenses", href: "/budget/monthly-expenses", icon: Calendar },
      { name: "Budget History", href: "/budget-history", icon: History },
      { name: "Future Cash-Flow", href: "/budget/future-cashflow", icon: TrendingUp },
      { name: "Savings & Goals", href: "/budget/savings-goals", icon: Target },
      { name: "Budget Reports", href: "/budget/reports", icon: Receipt },
    ],
  },
  {
    name: "Loans Manager",
    icon: CreditCard,
    children: [
      { name: "Loans", href: "/new-loans", icon: CreditCard },
      { name: "Payments", href: "/new-payments", icon: HandCoins },
      { name: "Lenders", href: "/lenders", icon: Building2 },
      { name: "Loan Comparison", href: "/loan-comparison", icon: GitCompare },
      { name: "EMI Insights", href: "/new-insights", icon: BarChart3 },
    ],
  },
  {
    name: "Finance Manager",
    icon: Landmark,
    children: [
      {
        name: "Banking",
        icon: Banknote,
        subChildren: [
          { name: "Bank Accounts", href: "/banking/accounts", icon: Landmark },
          { name: "Reconciliation (BRS)", href: "/banking/reconciliation", icon: GitCompare },
          { name: "Automation Rules", href: "/banking/rules", icon: Settings },
          { name: "Transactions", href: "/expenses", icon: Receipt },
          { name: "BRS Report", href: "/banking/brs-report", icon: BarChart3 },
          { name: "Import Statements", href: "/bank-statement-import", icon: FileText },
        ],
      },
      {
        name: "Expenses",
        icon: ShoppingBag,
        subChildren: [
          { name: "Expense Ledger", href: "/expenses", icon: Receipt },
        ],
      },
      {
        name: "Income",
        icon: DollarSign,
        subChildren: [
          { name: "Income Ledger", href: "/expenses", icon: Receipt },
        ],
      },
    ],
  },
  { 
    name: "Insights", 
    href: "/new-insights", 
    icon: LineChart 
  },
  { 
    name: "Documents", 
    href: "/documents", 
    icon: FileText 
  },
];

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href;
  };

  const isGroupActive = (children?: any[]) => {
    if (!children) return false;
    return children.some(child => {
      if (child.href) return isActive(child.href);
      if (child.subChildren) return child.subChildren.some((sub: any) => isActive(sub.href));
      return false;
    });
  };

  return (
    <Sidebar 
      className="border-r border-border/40 bg-background"
      collapsible="offcanvas"
    >
      <SidebarContent className="bg-background">
        <div className="flex flex-col h-full">
          {/* Logo / Brand */}
          <div className="px-6 py-5 border-b border-border/40">
            <h2 className="text-lg font-semibold text-foreground">Finance Manager</h2>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4">
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const hasChildren = 'children' in item && item.children;

                // Simple link item
                if (!hasChildren && item.href) {
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)}>
                        <NavLink 
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-md mx-2",
                            isActive(item.href)
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.name}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Collapsible group item
                return (
                  <div key={item.name} className="mb-1">
                    <Collapsible defaultOpen={isGroupActive(item.children)} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            className={cn(
                              "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors rounded-md mx-2",
                              isGroupActive(item.children)
                                ? "text-foreground bg-muted/50"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{item.name}</span>
                            </div>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                      </SidebarMenuItem>

                      <CollapsibleContent className="mt-1">
                        <SidebarMenuSub>
                          {item.children?.map((child) => {
                            // Check if this child has sub-children (like Banking, Expenses, Income)
                            if ('subChildren' in child && child.subChildren) {
                              const ChildIcon = child.icon;
                              return (
                                <div key={child.name} className="ml-4">
                                  <Collapsible defaultOpen={child.subChildren.some(sub => isActive(sub.href))} className="group/sub-collapsible">
                                    <SidebarMenuSubItem>
                                      <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton
                                          className={cn(
                                            "flex items-center justify-between w-full px-3 py-2 text-sm transition-colors rounded-md",
                                            child.subChildren.some(sub => isActive(sub.href))
                                              ? "text-foreground font-medium"
                                              : "text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          <div className="flex items-center gap-2">
                                            <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                            <span>{child.name}</span>
                                          </div>
                                          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-180" />
                                        </SidebarMenuSubButton>
                                      </CollapsibleTrigger>
                                    </SidebarMenuSubItem>

                                    <CollapsibleContent className="mt-1 ml-4">
                                      {child.subChildren.map((subChild) => {
                                        const SubIcon = subChild.icon;
                                        return (
                                          <SidebarMenuSubItem key={subChild.name}>
                                            <SidebarMenuSubButton asChild isActive={isActive(subChild.href)}>
                                              <NavLink
                                                to={subChild.href}
                                                className={cn(
                                                  "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md",
                                                  isActive(subChild.href)
                                                    ? "bg-accent text-accent-foreground font-medium"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                              >
                                                <SubIcon className="h-3.5 w-3.5 shrink-0" />
                                                <span>{subChild.name}</span>
                                              </NavLink>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              );
                            }

                            // Regular child without sub-children
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.name}>
                                <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                                  <NavLink
                                    to={child.href!}
                                    className={cn(
                                      "flex items-center gap-2 px-4 py-2 text-sm transition-colors rounded-md ml-4",
                                      isActive(child.href)
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                  >
                                    <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span>{child.name}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Add separator after each main section except the last */}
                    {item.name !== "Documents" && (
                      <Separator className="my-3 mx-4" />
                    )}
                  </div>
                );
              })}
            </SidebarMenu>
          </div>

          {/* Footer with Sign Out */}
          <div className="border-t border-border/40 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

function MobileHeader() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background md:hidden">
      <div className="flex h-14 items-center gap-4 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
        <h1 className="text-lg font-semibold">Finance Manager</h1>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background w-full max-w-full">
          <MobileHeader />
          <div className="px-4 sm:px-6 py-3 sm:py-6 pb-20 md:pb-6 w-full max-w-full">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
