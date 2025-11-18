import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><NewDashboard /></Layout></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><Layout><NewLoans /></Layout></ProtectedRoute>} />
          <Route path="/loans/new" element={<ProtectedRoute><Layout><NewLoan /></Layout></ProtectedRoute>} />
          <Route path="/loans/:id" element={<ProtectedRoute><Layout><NewLoanDetail /></Layout></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Layout><NewPayments /></Layout></ProtectedRoute>} />
          <Route path="/lenders" element={<ProtectedRoute><Layout><Lenders /></Layout></ProtectedRoute>} />
          <Route path="/lenders/:id" element={<ProtectedRoute><Layout><LenderDetail /></Layout></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Layout><NewInsights /></Layout></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
