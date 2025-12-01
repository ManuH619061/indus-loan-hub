import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import NewDashboard from "./pages/NewDashboard";
import NewLoans from "./pages/NewLoans";
import NewLoan from "./pages/NewLoan";
import EditLoan from "./pages/EditLoan";
import NewLoanDetail from "./pages/NewLoanDetail";
import NewPayments from "./pages/NewPayments";
import Lenders from "./pages/Lenders";
import LenderDetail from "./pages/LenderDetail";
import Documents from "./pages/Documents";
import NewInsights from "./pages/NewInsights";
import FinancialInsights from "./pages/FinancialInsights";
import BudgetPlanner from "./pages/BudgetPlanner";
import BudgetHistory from "./pages/BudgetHistory";
import MonthlyExpenses from "./pages/budget/MonthlyExpenses";
import FutureCashFlow from "./pages/budget/FutureCashFlow";
import SavingsGoals from "./pages/budget/SavingsGoals";
import BudgetReports from "./pages/budget/BudgetReports";
import DebtPayoffCalculator from "./pages/budget/DebtPayoffCalculator";
import CategoryManager from "./pages/budget/CategoryManager";
import BudgetReportsPage from "./pages/budget/BudgetReportsPage";
import BankStatementImport from "./pages/BankStatementImport";
import BankAccountsDashboard from "./pages/banking/BankAccountsDashboard";
import Reconciliation from "./pages/banking/Reconciliation";
import BankRules from "./pages/banking/BankRules";
import BRSReport from "./pages/banking/BRSReport";
import AddBankAccount from "./pages/banking/AddBankAccount";
import Expenses from "./pages/Expenses";
import LoanComparison from "./pages/LoanComparison";
import EMICalendar from "./pages/EMICalendar";
import InstallApp from "./pages/InstallApp";
import Settings from "./pages/Settings";
import BudgetAIAdvice from "./pages/ai/BudgetAIAdvice";
import ExpenseAIAdvice from "./pages/ai/ExpenseAIAdvice";
import LoanEMIAIAdvice from "./pages/ai/LoanEMIAIAdvice";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { OfflineIndicator } from "./components/OfflineIndicator";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/install" element={<InstallApp />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><PageTransition><NewDashboard /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget-planner" element={<ProtectedRoute><Layout><PageTransition><BudgetPlanner /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/monthly-expenses" element={<ProtectedRoute><Layout><PageTransition><MonthlyExpenses /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget-history" element={<ProtectedRoute><Layout><PageTransition><BudgetHistory /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/future-cashflow" element={<ProtectedRoute><Layout><PageTransition><FutureCashFlow /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/savings-goals" element={<ProtectedRoute><Layout><PageTransition><SavingsGoals /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/debt-optimizer" element={<ProtectedRoute><Layout><PageTransition><DebtPayoffCalculator /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/category-manager" element={<ProtectedRoute><Layout><PageTransition><CategoryManager /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/visual-reports" element={<ProtectedRoute><Layout><PageTransition><BudgetReportsPage /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget/reports" element={<ProtectedRoute><Layout><PageTransition><BudgetReports /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/accounts" element={<ProtectedRoute><Layout><PageTransition><BankAccountsDashboard /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/add-account" element={<ProtectedRoute><Layout><PageTransition><AddBankAccount /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/reconcile" element={<ProtectedRoute><Layout><PageTransition><Reconciliation /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/reconcile/:accountId" element={<ProtectedRoute><Layout><PageTransition><Reconciliation /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/rules" element={<ProtectedRoute><Layout><PageTransition><BankRules /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/banking/brs-report" element={<ProtectedRoute><Layout><PageTransition><BRSReport /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/bank-import" element={<ProtectedRoute><Layout><PageTransition><BankStatementImport /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Layout><PageTransition><Expenses /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute><Layout><PageTransition><NewLoans /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans/new" element={<ProtectedRoute><Layout><PageTransition><NewLoan /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans/:id/edit" element={<ProtectedRoute><Layout><PageTransition><EditLoan /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans/:id" element={<ProtectedRoute><Layout><PageTransition><NewLoanDetail /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Layout><PageTransition><NewPayments /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/lenders" element={<ProtectedRoute><Layout><PageTransition><Lenders /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/lenders/:id" element={<ProtectedRoute><Layout><PageTransition><LenderDetail /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loan-comparison" element={<ProtectedRoute><Layout><PageTransition><LoanComparison /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/emi-calendar" element={<ProtectedRoute><Layout><PageTransition><EMICalendar /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Layout><PageTransition><NewInsights /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/financial-insights" element={<ProtectedRoute><Layout><PageTransition><FinancialInsights /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Layout><PageTransition><Documents /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><PageTransition><Settings /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/ai/budget-advice" element={<ProtectedRoute><Layout><PageTransition><BudgetAIAdvice /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/ai/expense-advice" element={<ProtectedRoute><Layout><PageTransition><ExpenseAIAdvice /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/ai/loan-advice" element={<ProtectedRoute><Layout><PageTransition><LoanEMIAIAdvice /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <PWAInstallPrompt />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
