import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

interface RecentPage {
  path: string;
  title: string;
  timestamp: number;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/loans": "Loan Manager",
  "/lenders": "Lenders",
  "/budget-planner": "Budget Planner",
  "/budget/monthly-expenses": "Monthly Expenses",
  "/banking": "Bank Manager",
  "/emi-calendar": "EMI Calendar",
  "/payments": "Payments",
  "/ai-advisor": "AI Advisor",
  "/insights": "Insights",
  "/documents": "Documents",
  "/settings": "Settings",
  "/loan-comparison": "Loan Comparison",
  "/budget/reports": "Budget Reports",
  "/budget/category-manager": "Category Manager",
  "/budget/savings-goals": "Savings Goals",
  "/budget/future-cashflow": "Future Cashflow",
  "/banking/reconciliation": "Reconciliation",
  "/banking/rules": "Bank Rules",
  "/banking/brs-report": "BRS Report",
};

const STORAGE_KEY = "finpath_recent_pages";
const MAX_RECENT = 5;

export function useRecentPages() {
  const location = useLocation();
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Load recent pages from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentPages(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading recent pages:", error);
    }
  }, []);

  // Track page visits
  useEffect(() => {
    const path = location.pathname;
    const title = PAGE_TITLES[path];
    
    if (!title) return; // Only track known pages

    setRecentPages(prev => {
      // Remove existing entry for this path
      const filtered = prev.filter(p => p.path !== path);
      
      // Add new entry at the beginning
      const newPages = [
        { path, title, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT);

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPages));
      } catch (error) {
        console.error("Error saving recent pages:", error);
      }

      return newPages;
    });
  }, [location.pathname]);

  return { recentPages };
}
