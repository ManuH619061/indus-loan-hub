import {
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Settings as SettingsIcon,
  UploadCloud,
  ClipboardCheck,
  Cpu,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof UploadCloud;
  available: boolean;
}

/** Navigation for a single client's workspace. Every path is scoped under
 * /clients/:clientId so switching clients never mixes their data. */
export function getClientNavItems(clientId: string): NavItem[] {
  const base = `/clients/${clientId}`;
  return [
    { label: "Client Home", path: base, icon: LayoutDashboard, available: true },
    { label: "Upload Invoices", path: `${base}/upload`, icon: UploadCloud, available: true },
    { label: "Upload Ledger Master", path: `${base}/masters`, icon: FolderOpen, available: false },
    { label: "Process Invoices", path: `${base}/process`, icon: Cpu, available: false },
    { label: "Review Results", path: `${base}/review`, icon: ClipboardCheck, available: false },
    { label: "Export Excel", path: `${base}/export`, icon: FileSpreadsheet, available: false },
    { label: "Settings", path: `${base}/settings`, icon: SettingsIcon, available: false },
  ];
}
