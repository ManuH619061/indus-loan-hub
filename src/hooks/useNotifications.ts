import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, isPast, isWithinInterval, startOfToday, endOfDay, subDays } from "date-fns";

export interface Notification {
  id: string;
  type: "emi_upcoming" | "emi_overdue" | "high_interest" | "budget_exceeded" | "low_balance";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  entityType?: string;
  entityId?: string;
  route?: string;
  createdAt: Date;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const alerts: Notification[] = [];
    const today = startOfToday();
    const next7Days = addDays(today, 7);

    try {
      // Fetch upcoming and overdue EMIs
      const { data: amortizationRows } = await supabase
        .from("amortization_rows")
        .select(`
          id, due_on, scheduled_emi, is_paid, loan_id,
          loans!inner(id, loan_name, user_id, lenders(name))
        `)
        .eq("loans.user_id", user.id)
        .eq("is_paid", false)
        .gte("due_on", subDays(today, 30).toISOString())
        .lte("due_on", next7Days.toISOString())
        .order("due_on", { ascending: true });

      if (amortizationRows) {
        amortizationRows.forEach((row: any) => {
          const dueDate = new Date(row.due_on);
          const isOverdue = isPast(dueDate) && dueDate < today;
          const isUpcoming = isWithinInterval(dueDate, { start: today, end: next7Days });

          if (isOverdue) {
            alerts.push({
              id: `overdue-${row.id}`,
              type: "emi_overdue",
              title: "Overdue EMI",
              message: `EMI of ₹${row.scheduled_emi?.toLocaleString()} for ${row.loans?.loan_name} was due on ${dueDate.toLocaleDateString()}`,
              severity: "critical",
              entityType: "loan",
              entityId: row.loan_id,
              route: `/loans/${row.loan_id}`,
              createdAt: dueDate,
            });
          } else if (isUpcoming) {
            alerts.push({
              id: `upcoming-${row.id}`,
              type: "emi_upcoming",
              title: "Upcoming EMI",
              message: `EMI of ₹${row.scheduled_emi?.toLocaleString()} for ${row.loans?.loan_name} due on ${dueDate.toLocaleDateString()}`,
              severity: "warning",
              entityType: "loan",
              entityId: row.loan_id,
              route: `/emi-calendar`,
              createdAt: new Date(),
            });
          }
        });
      }

      // Fetch high interest loans (above 30%)
      const { data: highInterestLoans } = await supabase
        .from("loans")
        .select("id, loan_name, interest_rate_apy, lenders(name)")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .gte("interest_rate_apy", 30);

      if (highInterestLoans) {
        highInterestLoans.forEach((loan: any) => {
          alerts.push({
            id: `high-interest-${loan.id}`,
            type: "high_interest",
            title: "High Interest Loan",
            message: `${loan.loan_name} at ${loan.interest_rate_apy}% - consider refinancing`,
            severity: "warning",
            entityType: "loan",
            entityId: loan.id,
            route: `/loan-comparison`,
            createdAt: new Date(),
          });
        });
      }

      // Fetch budget vs actual expenses for current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: budget } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .single();

      if (budget) {
        const { data: expenses } = await supabase
          .from("monthly_expenses")
          .select("amount, expense_groups(name)")
          .eq("user_id", user.id)
          .gte("expense_date", `${currentMonth}-01`)
          .lte("expense_date", `${currentMonth}-31`);

        if (expenses) {
          const categoryTotals: Record<string, number> = {};
          expenses.forEach((exp: any) => {
            const category = exp.expense_groups?.name || "Other";
            categoryTotals[category] = (categoryTotals[category] || 0) + (exp.amount || 0);
          });

          // Check shopping limit
          if (budget.shopping_limit && categoryTotals["Shopping"] > budget.shopping_limit) {
            alerts.push({
              id: `budget-shopping-${currentMonth}`,
              type: "budget_exceeded",
              title: "Budget Exceeded",
              message: `Shopping expenses exceeded budget by ₹${(categoryTotals["Shopping"] - budget.shopping_limit).toLocaleString()}`,
              severity: "warning",
              route: `/budget/monthly-expenses`,
              createdAt: new Date(),
            });
          }

          // Check food limit
          if (budget.food_limit && categoryTotals["Food"] > budget.food_limit) {
            alerts.push({
              id: `budget-food-${currentMonth}`,
              type: "budget_exceeded",
              title: "Budget Exceeded",
              message: `Food expenses exceeded budget by ₹${(categoryTotals["Food"] - budget.food_limit).toLocaleString()}`,
              severity: "warning",
              route: `/budget/monthly-expenses`,
              createdAt: new Date(),
            });
          }
        }
      }

      // Check low bank balances
      const { data: bankAccounts } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, book_balance, account_number_masked")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .lt("book_balance", 10000);

      if (bankAccounts) {
        bankAccounts.forEach((account) => {
          alerts.push({
            id: `low-balance-${account.id}`,
            type: "low_balance",
            title: "Low Bank Balance",
            message: `${account.bank_name} (${account.account_number_masked}) balance is ₹${account.book_balance?.toLocaleString()}`,
            severity: "info",
            entityType: "bank_account",
            entityId: account.id,
            route: `/banking`,
            createdAt: new Date(),
          });
        });
      }

    } catch (error) {
      console.error("Error fetching notifications:", error);
    }

    // Sort by severity and date
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    setNotifications(alerts);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => n.severity === "critical" || n.severity === "warning").length;

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch: fetchNotifications,
  };
}
