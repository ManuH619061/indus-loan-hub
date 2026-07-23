import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ClientShell } from "@/components/layout/ClientShell";
import { ClientDashboardPage } from "@/pages/ClientDashboardPage";
import { ClientWorkspacePage } from "@/pages/ClientWorkspacePage";
import { UploadInvoicesPage } from "@/pages/UploadInvoicesPage";
import { UploadLedgerMasterPage } from "@/pages/UploadLedgerMasterPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientDashboardPage />} />
        <Route path="/clients/:clientId" element={<ClientShell />}>
          <Route index element={<ClientWorkspacePage />} />
          <Route path="upload" element={<UploadInvoicesPage />} />
          <Route path="masters" element={<UploadLedgerMasterPage />} />
          <Route path="process" element={<PlaceholderPage />} />
          <Route path="review" element={<PlaceholderPage />} />
          <Route path="export" element={<PlaceholderPage />} />
          <Route path="settings" element={<PlaceholderPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
