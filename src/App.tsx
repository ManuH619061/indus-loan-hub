import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Loans from "./pages/Loans";
import NewLoan from "./pages/NewLoan";
import LoanDetail from "./pages/LoanDetail";
import Payments from "./pages/Payments";
import Lenders from "./pages/Lenders";
import LendersDashboard from "./pages/LendersDashboard";
import LenderDetail from "./pages/LenderDetail";
import Documents from "./pages/Documents";
import BulkPayments from "./pages/BulkPayments";
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
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/dashboard/:tab" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/dashboard/lenders" element={<ProtectedRoute><Layout><LendersDashboard /></Layout></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><Layout><Loans /></Layout></ProtectedRoute>} />
          <Route path="/loans/new" element={<ProtectedRoute><Layout><NewLoan /></Layout></ProtectedRoute>} />
          <Route path="/loans/:id" element={<ProtectedRoute><Layout><LoanDetail /></Layout></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Layout><Payments /></Layout></ProtectedRoute>} />
          <Route path="/payments/bulk" element={<ProtectedRoute><Layout><BulkPayments /></Layout></ProtectedRoute>} />
          <Route path="/lenders" element={<ProtectedRoute><Layout><Lenders /></Layout></ProtectedRoute>} />
          <Route path="/lenders/:id" element={<ProtectedRoute><Layout><LenderDetail /></Layout></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
