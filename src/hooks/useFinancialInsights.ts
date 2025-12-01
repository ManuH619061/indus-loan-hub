import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchLoansWithAmortization,
  calculateOutstandingFromAmortization,
  calculateNext30DaysEMI,
  calculate6MonthProjection,
  calculatePortfolioStatsFromAmortization,
  countOverdueEMIs,
  calculatePayoffProgress,
  LoanWithAmortization,
  Next30DaysEMI,
  MonthlyProjection,
  PortfolioStats,
} from "@/lib/portfolio-stats";
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from "date-fns";

export interface SpendingCategory {
  category: string;
  currentMonth: number;
  lastMonth: number;
  change: number;
  changePercent: number;
}

export interface LoanInsight {
  id: string;
  loanName: string;
  lenderName: string | null;
  interestRate: number;
  emi: number;
  payoffDate: string | null;
  paidPercent: number;
  riskTag: "Low" | "Medium" | "High";
  outstanding: number;
}

export interface CashFlowProjection {
  month: string;
  income: number;
  expenses: number;
  emis: number;
  netFlow: number;
}

export interface RiskAlert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  recommendation: string;
  category: "emi" | "interest" | "budget" | "emergency" | "dti";
}

export interface FinancialInsightsData {
  // Monthly Finance Summary
  totalIncome: number;
  totalExpenses: number;
  totalEMIThisMonth: number;
  netBalance: number;
  savingsRate: number;
  
  // Debt & Risk Overview
  debtToIncomeRatio: number;
  dtiLabel: "Excellent" | "Good" | "Risky" | "Critical";
  creditUtilization: number;
  emergencyFundMonths: number;
  
  // Spending Insights
  topSpendingCategories: SpendingCategory[];
  
  // Loan Insights
  loanInsights: LoanInsight[];
  earliestPayoff: { loanName: string; date: string } | null;
  latestPayoff: { loanName: string; date: string } | null;
  
  // Cash Flow Projection
  cashFlowProjection: CashFlowProjection[];
  
  // Risk Alerts
  riskAlerts: RiskAlert[];
  
  // Portfolio Stats (reused)
  portfolioStats: PortfolioStats;
  next30DaysEMI: Next30DaysEMI;
  monthlyProjection: MonthlyProjection[];
  overdueCount: number;
  payoffProgress: { totalPrincipal: number; paidPrincipal: number; remainingPrincipal: number; progressPercent: number };
  
  // Raw data for components
  loans: LoanWithAmortization[];
}

export function useFinancialInsights() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialInsightsData | null>(null);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const today = new Date();
      const currentMonthStart = startOfMonth(today);
      const currentMonthEnd = endOfMonth(today);
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const lastMonthEnd = endOfMonth(subMonths(today, 1));

      // Fetch all data in parallel
      const [
        loans,
        profileResult,
        currentBudgetResult,
        currentTransactionsResult,
        lastTransactionsResult,
        bankAccountsResult,
      ] = await Promise.all([
        fetchLoansWithAmortization(user.id),
        supabase.from("profiles").select("monthly_income").eq("id", user.id).single(),
        supabase
          .from("monthly_budgets")
          .select("*")
          .eq("user_id", user.id)
          .eq("month_year", format(today, "yyyy-MM"))
          .single(),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .gte("transaction_date", format(currentMonthStart, "yyyy-MM-dd"))
          .lte("transaction_date", format(currentMonthEnd, "yyyy-MM-dd")),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .gte("transaction_date", format(lastMonthStart, "yyyy-MM-dd"))
          .lte("transaction_date", format(lastMonthEnd, "yyyy-MM-dd")),
        supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_active", true),
      ]);

      const profile = profileResult.data;
      const currentBudget = currentBudgetResult.data;
      const currentTransactions = currentTransactionsResult.data || [];
      const lastTransactions = lastTransactionsResult.data || [];
      const bankAccounts = bankAccountsResult.data || [];

      // Calculate portfolio stats using existing functions
      const portfolioStats = calculatePortfolioStatsFromAmortization(loans);
      const next30DaysEMI = calculateNext30DaysEMI(loans, today);
      const monthlyProjection = calculate6MonthProjection(loans, today);
      const overdueCount = countOverdueEMIs(loans, today);
      const payoffProgress = calculatePayoffProgress(loans);

      // Calculate income
      const budgetIncome = currentBudget
        ? (currentBudget.salary || 0) + (currentBudget.side_income || 0) + (currentBudget.other_income || 0)
        : 0;
      const profileIncome = profile?.monthly_income || 0;
      const totalIncome = budgetIncome > 0 ? budgetIncome : profileIncome;

      // Calculate expenses from transactions (debits)
      const transactionExpenses = currentTransactions
        .filter(t => t.debit && t.debit > 0 && !t.is_emi)
        .reduce((sum, t) => sum + (t.debit || 0), 0);

      // Calculate budget-based expenses
      const budgetExpenses = currentBudget
        ? (currentBudget.rent || 0) +
          (currentBudget.food || 0) +
          (currentBudget.transport || 0) +
          (currentBudget.utilities || 0) +
          (currentBudget.school || 0) +
          (currentBudget.subscriptions || 0) +
          (currentBudget.insurance || 0) +
          (currentBudget.eating_out || 0) +
          (currentBudget.shopping || 0) +
          (currentBudget.travel || 0) +
          (currentBudget.other_variable || 0)
        : 0;

      const totalExpenses = Math.max(transactionExpenses, budgetExpenses);

      // Calculate EMI this month from amortization
      const currentMonthEMI = monthlyProjection[0]?.emi || 0;

      // Net balance and savings rate
      const netBalance = totalIncome - totalExpenses - currentMonthEMI;
      const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

      // Debt-to-Income Ratio
      const monthlyEMITotal = loans.reduce((sum, loan) => {
        const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
        if (unpaidRows.length > 0) {
          return sum + unpaidRows[0].scheduled_emi;
        }
        return sum;
      }, 0);
      
      const debtToIncomeRatio = totalIncome > 0 ? (monthlyEMITotal / totalIncome) * 100 : 0;
      
      const getDTILabel = (dti: number): "Excellent" | "Good" | "Risky" | "Critical" => {
        if (dti <= 20) return "Excellent";
        if (dti <= 36) return "Good";
        if (dti <= 50) return "Risky";
        return "Critical";
      };

      // Credit utilization (estimate from credit card conversion loans)
      const creditLoans = loans.filter(l => 
        l.loan_name.toLowerCase().includes("credit") || 
        l.loan_name.toLowerCase().includes("card")
      );
      const creditUsed = creditLoans.reduce((sum, loan) => {
        const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
        return sum + outstanding.total;
      }, 0);
      const creditLimit = creditLoans.reduce((sum, loan) => sum + loan.principal_amount * 1.5, 0);
      const creditUtilization = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

      // Emergency fund months
      const avgMonthlyExpenses = totalExpenses > 0 ? totalExpenses : monthlyEMITotal;
      const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.book_balance || 0), 0);
      const emergencyFundMonths = avgMonthlyExpenses > 0 ? totalBankBalance / avgMonthlyExpenses : 0;

      // Spending insights - top 5 categories
      const categoryTotals = new Map<string, { current: number; last: number }>();
      
      currentTransactions.forEach(t => {
        if (t.debit && t.debit > 0) {
          const cat = t.category || "Other";
          const existing = categoryTotals.get(cat) || { current: 0, last: 0 };
          categoryTotals.set(cat, { ...existing, current: existing.current + t.debit });
        }
      });
      
      lastTransactions.forEach(t => {
        if (t.debit && t.debit > 0) {
          const cat = t.category || "Other";
          const existing = categoryTotals.get(cat) || { current: 0, last: 0 };
          categoryTotals.set(cat, { ...existing, last: existing.last + t.debit });
        }
      });

      const topSpendingCategories: SpendingCategory[] = Array.from(categoryTotals.entries())
        .map(([category, totals]) => ({
          category,
          currentMonth: totals.current,
          lastMonth: totals.last,
          change: totals.current - totals.last,
          changePercent: totals.last > 0 ? ((totals.current - totals.last) / totals.last) * 100 : 0,
        }))
        .sort((a, b) => b.currentMonth - a.currentMonth)
        .slice(0, 5);

      // Loan insights with payoff dates
      const loanInsights: LoanInsight[] = loans.map(loan => {
        const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
        const unpaidRows = (loan.amortization_rows || []).filter(r => !r.is_paid);
        const paidRows = (loan.amortization_rows || []).filter(r => r.is_paid);
        const totalRows = loan.amortization_rows?.length || 1;
        const paidPercent = (paidRows.length / totalRows) * 100;
        
        const lastUnpaidRow = unpaidRows.length > 0 
          ? unpaidRows.sort((a, b) => new Date(b.due_on).getTime() - new Date(a.due_on).getTime())[0]
          : null;
        
        const emi = unpaidRows[0]?.scheduled_emi || 0;

        // Risk tag based on interest rate and DTI contribution
        let riskTag: "Low" | "Medium" | "High" = "Low";
        if (loan.interest_rate_apy > 18 || (totalIncome > 0 && (emi / totalIncome) > 0.15)) {
          riskTag = "High";
        } else if (loan.interest_rate_apy > 12 || (totalIncome > 0 && (emi / totalIncome) > 0.1)) {
          riskTag = "Medium";
        }

        return {
          id: loan.id,
          loanName: loan.loan_name,
          lenderName: loan.lenders?.name || null,
          interestRate: loan.interest_rate_apy,
          emi,
          payoffDate: lastUnpaidRow?.due_on || null,
          paidPercent,
          riskTag,
          outstanding: outstanding.total,
        };
      });

      // Earliest and latest payoff
      const loansWithPayoff = loanInsights.filter(l => l.payoffDate);
      const sortedByPayoff = [...loansWithPayoff].sort(
        (a, b) => new Date(a.payoffDate!).getTime() - new Date(b.payoffDate!).getTime()
      );
      
      const earliestPayoff = sortedByPayoff.length > 0
        ? { loanName: sortedByPayoff[0].loanName, date: sortedByPayoff[0].payoffDate! }
        : null;
      const latestPayoff = sortedByPayoff.length > 0
        ? { loanName: sortedByPayoff[sortedByPayoff.length - 1].loanName, date: sortedByPayoff[sortedByPayoff.length - 1].payoffDate! }
        : null;

      // Cash flow projection for next 6 months
      const cashFlowProjection: CashFlowProjection[] = [];
      for (let i = 0; i < 6; i++) {
        const monthDate = addMonths(today, i);
        const monthEMI = monthlyProjection[i]?.emi || 0;
        
        // Use current budget expenses as baseline
        const projectedExpenses = totalExpenses > 0 ? totalExpenses : budgetExpenses;
        const projectedIncome = totalIncome;
        
        cashFlowProjection.push({
          month: format(monthDate, "MMM"),
          income: projectedIncome,
          expenses: projectedExpenses,
          emis: monthEMI,
          netFlow: projectedIncome - projectedExpenses - monthEMI,
        });
      }

      // Risk alerts
      const riskAlerts: RiskAlert[] = [];

      // Overdue EMIs
      if (overdueCount > 0) {
        riskAlerts.push({
          id: "overdue",
          type: "error",
          title: "Overdue EMIs",
          message: `You have ${overdueCount} overdue EMI${overdueCount > 1 ? "s" : ""}.`,
          recommendation: "Pay immediately to avoid penalties and credit score impact.",
          category: "emi",
        });
      }

      // High interest loans
      const highInterestLoans = loans.filter(l => l.interest_rate_apy > 18);
      if (highInterestLoans.length > 0) {
        riskAlerts.push({
          id: "high-interest",
          type: "warning",
          title: "High Interest Loans",
          message: `${highInterestLoans.length} loan${highInterestLoans.length > 1 ? "s" : ""} with interest >18%.`,
          recommendation: "Consider refinancing or prepaying highest interest loans first.",
          category: "interest",
        });
      }

      // EMI > 40% of income
      if (debtToIncomeRatio > 40) {
        riskAlerts.push({
          id: "high-dti",
          type: "error",
          title: "High Debt Load",
          message: `EMI is ${debtToIncomeRatio.toFixed(1)}% of your income.`,
          recommendation: "Reduce debt or increase income. Avoid new loans.",
          category: "dti",
        });
      }

      // Low emergency fund
      if (emergencyFundMonths < 3) {
        riskAlerts.push({
          id: "low-emergency",
          type: "warning",
          title: "Low Emergency Fund",
          message: `Only ${emergencyFundMonths.toFixed(1)} months of expenses saved.`,
          recommendation: "Build emergency fund to at least 3-6 months of expenses.",
          category: "emergency",
        });
      }

      // Budget overshoot
      if (currentBudget) {
        const categories = [
          { name: "Food", actual: transactionExpenses * 0.3, limit: currentBudget.food_limit },
          { name: "Shopping", actual: transactionExpenses * 0.2, limit: currentBudget.shopping_limit },
          { name: "Eating Out", actual: transactionExpenses * 0.15, limit: currentBudget.eating_out_limit },
          { name: "Travel", actual: transactionExpenses * 0.1, limit: currentBudget.travel_limit },
        ];
        
        categories.forEach(cat => {
          if (cat.limit && cat.actual > cat.limit) {
            riskAlerts.push({
              id: `budget-${cat.name.toLowerCase()}`,
              type: "info",
              title: `${cat.name} Budget Exceeded`,
              message: `You've exceeded your ${cat.name.toLowerCase()} budget.`,
              recommendation: `Cut ${cat.name.toLowerCase()} spending to stay within budget.`,
              category: "budget",
            });
          }
        });
      }

      setData({
        totalIncome,
        totalExpenses,
        totalEMIThisMonth: currentMonthEMI,
        netBalance,
        savingsRate,
        debtToIncomeRatio,
        dtiLabel: getDTILabel(debtToIncomeRatio),
        creditUtilization,
        emergencyFundMonths,
        topSpendingCategories,
        loanInsights,
        earliestPayoff,
        latestPayoff,
        cashFlowProjection,
        riskAlerts,
        portfolioStats,
        next30DaysEMI,
        monthlyProjection,
        overdueCount,
        payoffProgress,
        loans,
      });
    } catch (error) {
      console.error("Error fetching financial insights:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("financial-insights-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "loans" }, fetchAllData)
      .on("postgres_changes", { event: "*", schema: "public", table: "amortization_rows" }, fetchAllData)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, fetchAllData)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchAllData)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_budgets" }, fetchAllData)
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);

  return { loading, data, refetch: fetchAllData };
}
