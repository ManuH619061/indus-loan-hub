import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Building2,
  FileText,
  LogOut,
  PiggyBank,
  BarChart3,
  Scale,
  Receipt,
  Target,
  Calendar,
  LineChart,
  DollarSign,
  Landmark,
  Settings,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  FileBarChart,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard 
  },
  { 
    name: "Money Manager", 
    icon: PiggyBank,
    children: [
      { name: "Budget Planner", href: "/budget-planner", icon: Target },
      { name: "Monthly Expenses", href: "/budget/monthly-expenses", icon: Receipt },
      { name: "Budget History", href: "/budget-history", icon: Calendar },
      { name: "Future Cash-Flow", href: "/budget/future-cashflow", icon: TrendingUpIcon },
      { name: "Savings & Goals", href: "/budget/savings-goals", icon: PiggyBank },
      { name: "Budget Reports", href: "/budget/reports", icon: BarChart3 },
    ]
  },
  { 
    name: "Loans Manager", 
    icon: Wallet,
    children: [
      { name: "Loans", href: "/loans", icon: Wallet },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Lenders", href: "/lenders", icon: Building2 },
      { name: "Loan Comparison", href: "/loan-comparison", icon: Scale },
      { name: "EMI Insights", href: "/insights", icon: LineChart },
    ]
  },
  { 
    name: "Finance Manager", 
    icon: Landmark,
    children: [
      {
        name: "Banking",
        icon: Building2,
        subChildren: [
          { name: "Bank Accounts", href: "/banking/accounts", icon: Building2 },
          { name: "Reconciliation (BRS)", href: "/banking/reconcile", icon: Scale },
          { name: "Automation Rules", href: "/banking/rules", icon: Settings },
          { name: "Transactions", href: "/expenses", icon: Receipt },
          { name: "BRS Report", href: "/banking/brs-report", icon: FileBarChart },
          { name: "Import Statements", href: "/bank-statement-import", icon: FileText },
        ]
      },
      {
        name: "Expenses",
        icon: TrendingDown,
        subChildren: [
          { name: "Expense Ledger", href: "/expenses", icon: Receipt },
        ]
      },
      {
        name: "Income",
        icon: DollarSign,
        subChildren: [
          { name: "Income Ledger", href: "/expenses", icon: DollarSign },
        ]
      },
    ]
  },
  { 
    name: "Insights", 
    href: "/insights", 
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
    <Sidebar className="border-r border-border/40">
      <SidebarContent>
        <div className="flex flex-col h-full">
          {/* Logo / Brand */}
          <div className="px-6 py-5 border-b border-border/40">
            <h2 className="text-lg font-semibold text-foreground">Money Manager</h2>
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
                                <Collapsible key={child.name} defaultOpen={child.subChildren.some((sub: any) => isActive(sub.href))}>
                                  <SidebarMenuSubItem>
                                    <CollapsibleTrigger asChild>
                                      <SidebarMenuSubButton className="flex items-center justify-between w-full px-4 py-2 text-sm ml-4 rounded-md hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                          <span className="text-muted-foreground">{child.name}</span>
                                        </div>
                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                                      </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                  </SidebarMenuSubItem>

                                  <CollapsibleContent>
                                    <SidebarMenuSub>
                                      {child.subChildren.map((subChild: any) => {
                                        const SubIcon = subChild.icon;
                                        return (
                                          <SidebarMenuSubItem key={subChild.name}>
                                            <SidebarMenuSubButton asChild isActive={isActive(subChild.href)}>
                                              <NavLink 
                                                to={subChild.href}
                                                className={cn(
                                                  "flex items-center gap-3 px-4 py-2 text-xs ml-8 rounded-md transition-colors",
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
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            }

                            // Regular child item
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.name}>
                                <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                                  <NavLink 
                                    to={child.href}
                                    className={cn(
                                      "flex items-center gap-3 px-4 py-2 text-sm ml-4 rounded-md transition-colors",
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

                    {/* Divider after Money Manager, Loans Manager, Finance Manager */}
                    {(item.name === "Money Manager" || item.name === "Loans Manager" || item.name === "Finance Manager") && (
                      <div className="my-3 mx-4 border-t border-border/40" />
                    )}
                  </div>
                );
              })}
            </SidebarMenu>
          </div>

          {/* Sign Out Button */}
          <div className="border-t border-border/40 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header with Sidebar Trigger */}
          <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger className="lg:hidden" />
              <div className="flex-1" />
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl mx-auto p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
