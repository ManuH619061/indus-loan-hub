import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, Landmark, Receipt, ShoppingCart, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency";

interface SearchResult {
  id: string;
  type: "loan" | "payment" | "expense";
  title: string;
  subtitle?: string;
  route: string;
  amount?: number;
}

interface SearchResults {
  loans: SearchResult[];
  payments: SearchResult[];
  expenses: SearchResult[];
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialQuery = searchParams.get("q") || "";
  const initialTab = searchParams.get("tab") || "all";
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [results, setResults] = useState<SearchResults>({ loans: [], payments: [], expenses: [] });
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!user || searchQuery.length < 2) {
      setResults({ loans: [], payments: [], expenses: [] });
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResults = { loans: [], payments: [], expenses: [] };
    const lowerQuery = searchQuery.toLowerCase();

    try {
      // Search loans
      const { data: loans } = await supabase
        .from("loans")
        .select("id, loan_name, principal_amount, emi_amount, status, lenders(name)")
        .eq("user_id", user.id)
        .ilike("loan_name", `%${searchQuery}%`)
        .limit(20);

      if (loans) {
        searchResults.loans = loans.map((loan: any) => ({
          id: loan.id,
          type: "loan",
          title: loan.loan_name,
          subtitle: `${loan.lenders?.name || "Unknown"} · ${loan.status}`,
          route: `/loans/${loan.id}`,
          amount: loan.emi_amount,
        }));
      }

      // Search payments
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
          .limit(50);

        if (payments) {
          const filteredPayments = payments.filter((p: any) =>
            p.loans?.loan_name?.toLowerCase().includes(lowerQuery) ||
            p.loans?.lenders?.name?.toLowerCase().includes(lowerQuery) ||
            p.amount?.toString().includes(searchQuery)
          );
          searchResults.payments = filteredPayments.map((payment: any) => ({
            id: payment.id,
            type: "payment",
            title: `${payment.loans?.loan_name || "Payment"} - ${payment.payment_type}`,
            subtitle: `${payment.loans?.lenders?.name || ""} · ${new Date(payment.paid_on).toLocaleDateString()}`,
            route: `/payments?highlight=${payment.id}`,
            amount: payment.amount,
          }));
        }
      }

      // Search expenses
      const { data: expenses } = await supabase
        .from("monthly_expenses")
        .select("id, description, amount, expense_date, expense_groups(name)")
        .eq("user_id", user.id)
        .ilike("description", `%${searchQuery}%`)
        .limit(20);

      if (expenses) {
        searchResults.expenses = expenses.map((expense: any) => ({
          id: expense.id,
          type: "expense",
          title: expense.description,
          subtitle: `${expense.expense_groups?.name || "Expense"} · ${new Date(expense.expense_date).toLocaleDateString()}`,
          route: `/budget/monthly-expenses?highlight=${expense.id}`,
          amount: expense.amount,
        }));
      }

    } catch (error) {
      console.error("Search error:", error);
    }

    setResults(searchResults);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (initialQuery) {
      search(initialQuery);
    }
  }, [initialQuery, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query, tab: activeTab });
      search(query);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ q: query, tab });
  };

  const totalResults = results.loans.length + results.payments.length + results.expenses.length;

  return (
    <PageContainer title="Search" subtitle="Search across all your financial data">
      <div className="space-y-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search loans, payments, expenses..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {/* Results */}
        {query && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Searching..." : `${totalResults} results for "${query}"`}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
                <TabsTrigger value="loans">Loans ({results.loans.length})</TabsTrigger>
                <TabsTrigger value="payments">Payments ({results.payments.length})</TabsTrigger>
                <TabsTrigger value="expenses">Expenses ({results.expenses.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6 mt-4">
                {results.loans.length > 0 && (
                  <ResultSection
                    title="Loans & Lenders"
                    icon={<Wallet className="h-4 w-4" />}
                    items={results.loans}
                    navigate={navigate}
                  />
                )}
                {results.payments.length > 0 && (
                  <ResultSection
                    title="Payments"
                    icon={<Receipt className="h-4 w-4" />}
                    items={results.payments}
                    navigate={navigate}
                  />
                )}
                {results.expenses.length > 0 && (
                  <ResultSection
                    title="Expenses"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    items={results.expenses}
                    navigate={navigate}
                  />
                )}
                {totalResults === 0 && !isLoading && <EmptyState query={query} />}
              </TabsContent>

              <TabsContent value="loans" className="mt-4">
                {results.loans.length > 0 ? (
                  <ResultSection title="Loans" icon={<Wallet className="h-4 w-4" />} items={results.loans} navigate={navigate} showAll />
                ) : (
                  <EmptyState query={query} type="loans" />
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                {results.payments.length > 0 ? (
                  <ResultSection title="Payments" icon={<Receipt className="h-4 w-4" />} items={results.payments} navigate={navigate} showAll />
                ) : (
                  <EmptyState query={query} type="payments" />
                )}
              </TabsContent>

              <TabsContent value="expenses" className="mt-4">
                {results.expenses.length > 0 ? (
                  <ResultSection title="Expenses" icon={<ShoppingCart className="h-4 w-4" />} items={results.expenses} navigate={navigate} showAll />
                ) : (
                  <EmptyState query={query} type="expenses" />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!query && (
          <Card>
            <CardContent className="py-12 text-center">
              <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Search your finances</h3>
              <p className="text-muted-foreground">Search across loans, payments, expenses, and more.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

interface ResultSectionProps {
  title: string;
  icon: React.ReactNode;
  items: SearchResult[];
  navigate: (path: string) => void;
  showAll?: boolean;
}

function ResultSection({ title, icon, items, navigate, showAll }: ResultSectionProps) {
  const displayItems = showAll ? items : items.slice(0, 5);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.route)}
            className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              </div>
              {item.amount && (
                <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
              )}
            </div>
          </button>
        ))}
        {!showAll && items.length > 5 && (
          <p className="text-sm text-muted-foreground text-center pt-2">+{items.length - 5} more results</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ query, type }: { query: string; type?: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="text-muted-foreground">No {type || "results"} found for "{query}"</p>
      </CardContent>
    </Card>
  );
}
