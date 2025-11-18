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
import NewLoanDetail from "./pages/NewLoanDetail";
import NewPayments from "./pages/NewPayments";
import Lenders from "./pages/Lenders";
import LenderDetail from "./pages/LenderDetail";
import Documents from "./pages/Documents";
import NewInsights from "./pages/NewInsights";
import BudgetPlanner from "./pages/BudgetPlanner";
import BudgetHistory from "./pages/BudgetHistory";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><PageTransition><NewDashboard /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget-planner" element={<ProtectedRoute><Layout><PageTransition><BudgetPlanner /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/budget-history" element={<ProtectedRoute><Layout><PageTransition><BudgetHistory /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute><Layout><PageTransition><NewLoans /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans/new" element={<ProtectedRoute><Layout><PageTransition><NewLoan /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/loans/:id" element={<ProtectedRoute><Layout><PageTransition><NewLoanDetail /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Layout><PageTransition><NewPayments /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/lenders" element={<ProtectedRoute><Layout><PageTransition><Lenders /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/lenders/:id" element={<ProtectedRoute><Layout><PageTransition><LenderDetail /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Layout><PageTransition><NewInsights /></PageTransition></Layout></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Layout><PageTransition><Documents /></PageTransition></Layout></ProtectedRoute>} />
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
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
