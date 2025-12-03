import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, isPast, isWithinInterval, startOfToday, subDays } from "date-fns";

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
  isRead: boolean;
  readAt?: Date;
}

interface DbNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  route: string | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stored notifications from database
  const fetchStoredNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return [];

    return (data as DbNotification[]).map((n) => ({
      id: n.id,
      type: n.type as Notification["type"],
      title: n.title,
      message: n.message,
      severity: n.severity as Notification["severity"],
      entityType: n.entity_type || undefined,
      entityId: n.entity_id || undefined,
      route: n.route || undefined,
      createdAt: new Date(n.created_at),
      isRead: n.is_read,
      readAt: n.read_at ? new Date(n.read_at) : undefined,
    }));
  }, [user]);

  // Generate new alerts from data and sync to database
  const generateAndSyncAlerts = useCallback(async () => {
    if (!user) return [];

    const alerts: Omit<Notification, "id" | "isRead" | "readAt">[] = [];
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

      // Fetch high interest loans
      const { data: highInterestLoans } = await supabase
        .from("loans")
        .select("id, loan_name, interest_rate_apy, lenders(name)")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .gte("interest_rate_apy", 30);

      if (highInterestLoans) {
        highInterestLoans.forEach((loan: any) => {
          alerts.push({
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

      // Check budget vs expenses
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

          if (budget.shopping_limit && categoryTotals["Shopping"] > budget.shopping_limit) {
            alerts.push({
              type: "budget_exceeded",
              title: "Budget Exceeded",
              message: `Shopping expenses exceeded budget by ₹${(categoryTotals["Shopping"] - budget.shopping_limit).toLocaleString()}`,
              severity: "warning",
              route: `/budget/monthly-expenses`,
              createdAt: new Date(),
            });
          }

          if (budget.food_limit && categoryTotals["Food"] > budget.food_limit) {
            alerts.push({
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

      // Sync new alerts to database (avoid duplicates by checking entity_id + type + date)
      for (const alert of alerts) {
        const alertDate = alert.createdAt.toISOString().slice(0, 10);
        
        // Check if similar notification exists
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", alert.type)
          .eq("entity_id", alert.entityId || "")
          .gte("created_at", `${alertDate}T00:00:00`)
          .lte("created_at", `${alertDate}T23:59:59`)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("notifications").insert({
            user_id: user.id,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            entity_type: alert.entityType || null,
            entity_id: alert.entityId || null,
            route: alert.route || null,
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error generating alerts:", error);
      return [];
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // First generate and sync new alerts
    await generateAndSyncAlerts();

    // Then fetch all stored notifications
    const stored = await fetchStoredNotifications();

    // Sort by severity and date
    stored.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    setNotifications(stored);
    setIsLoading(false);
  }, [user, generateAndSyncAlerts, fetchStoredNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
      )
    );
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
    );
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id);

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, [user]);

  const clearAllRead = useCallback(async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("is_read", true);

    setNotifications((prev) => prev.filter((n) => !n.isRead));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
  };
}
