import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SearchResult {
  id: string;
  type: "loan" | "lender" | "payment" | "expense" | "navigation";
  title: string;
  subtitle?: string;
  route: string;
  icon?: string;
}

const NAVIGATION_SHORTCUTS = [
  { id: "nav-dashboard", type: "navigation" as const, title: "Dashboard", route: "/dashboard", icon: "LayoutDashboard" },
  { id: "nav-loans", type: "navigation" as const, title: "Loan Manager", route: "/loans", icon: "Wallet" },
  { id: "nav-lenders", type: "navigation" as const, title: "Lenders", route: "/lenders", icon: "Building2" },
  { id: "nav-budget", type: "navigation" as const, title: "Budget Planner", route: "/budget-planner", icon: "Calculator" },
  { id: "nav-expenses", type: "navigation" as const, title: "Monthly Expenses", route: "/budget/monthly-expenses", icon: "Receipt" },
  { id: "nav-bank", type: "navigation" as const, title: "Bank Manager", route: "/banking", icon: "Landmark" },
  { id: "nav-emi", type: "navigation" as const, title: "EMI Calendar", route: "/emi-calendar", icon: "Calendar" },
  { id: "nav-payments", type: "navigation" as const, title: "Payments", route: "/payments", icon: "CreditCard" },
  { id: "nav-ai", type: "navigation" as const, title: "AI Advisor", route: "/ai-advisor", icon: "Bot" },
  { id: "nav-insights", type: "navigation" as const, title: "Insights", route: "/insights", icon: "TrendingUp" },
  { id: "nav-documents", type: "navigation" as const, title: "Documents", route: "/documents", icon: "FileText" },
  { id: "nav-settings", type: "navigation" as const, title: "Settings", route: "/settings", icon: "Settings" },
];

export function useGlobalSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!user || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    try {
      // Search navigation shortcuts
      const navResults = NAVIGATION_SHORTCUTS.filter(
        nav => nav.title.toLowerCase().includes(lowerQuery)
      );
      searchResults.push(...navResults);

      // Search loans
      const { data: loans } = await supabase
        .from("loans")
        .select("id, loan_name, principal_amount, emi_amount, lenders(name)")
        .eq("user_id", user.id)
        .ilike("loan_name", `%${searchQuery}%`)
        .limit(5);

      if (loans) {
        loans.forEach((loan: any) => {
          searchResults.push({
            id: `loan-${loan.id}`,
            type: "loan",
            title: loan.loan_name,
            subtitle: `${loan.lenders?.name || "Unknown"} · EMI ₹${loan.emi_amount?.toLocaleString() || 0}`,
            route: `/loans/${loan.id}`,
          });
        });
      }

      // Search lenders
      const { data: lenders } = await supabase
        .from("lenders")
        .select("id, name, type")
        .eq("user_id", user.id)
        .ilike("name", `%${searchQuery}%`)
        .limit(5);

      if (lenders) {
        lenders.forEach((lender) => {
          searchResults.push({
            id: `lender-${lender.id}`,
            type: "lender",
            title: lender.name,
            subtitle: lender.type,
            route: `/lenders/${lender.id}`,
          });
        });
      }

      // Search payments - get loans first, then payments
      const { data: userLoans } = await supabase
        .from("loans")
        .select("id")
        .eq("user_id", user.id);

      if (userLoans && userLoans.length > 0) {
        const loanIds = userLoans.map(l => l.id);
        const { data: payments } = await supabase
          .from("payments")
          .select("id, amount, paid_on, payment_type, loans(loan_name, lenders(name))")
          .in("loan_id", loanIds)
          .order("paid_on", { ascending: false })
          .limit(20);

        if (payments) {
          const filteredPayments = payments.filter((p: any) =>
            p.loans?.loan_name?.toLowerCase().includes(lowerQuery) ||
            p.loans?.lenders?.name?.toLowerCase().includes(lowerQuery) ||
            p.amount?.toString().includes(searchQuery)
          );
          filteredPayments.slice(0, 5).forEach((payment: any) => {
            searchResults.push({
              id: `payment-${payment.id}`,
              type: "payment",
              title: `₹${payment.amount?.toLocaleString()} - ${payment.loans?.loan_name || "Payment"}`,
              subtitle: `${payment.loans?.lenders?.name || ""} · ${new Date(payment.paid_on).toLocaleDateString()}`,
              route: `/payments?highlight=${payment.id}`,
            });
          });
        }
      }

      // Search expenses
      const { data: expenses } = await supabase
        .from("monthly_expenses")
        .select("id, description, amount, expense_date, expense_groups(name)")
        .eq("user_id", user.id)
        .ilike("description", `%${searchQuery}%`)
        .limit(5);

      if (expenses) {
        expenses.forEach((expense: any) => {
          searchResults.push({
            id: `expense-${expense.id}`,
            type: "expense",
            title: expense.description,
            subtitle: `₹${expense.amount?.toLocaleString()} · ${expense.expense_groups?.name || "Expense"}`,
            route: `/budget/monthly-expenses?highlight=${expense.id}`,
          });
        });
      }

    } catch (error) {
      console.error("Search error:", error);
    }

    setResults(searchResults);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    navigationShortcuts: NAVIGATION_SHORTCUTS,
  };
}
