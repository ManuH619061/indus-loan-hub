import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileWarning, Files, HardDrive, Layers } from "lucide-react";
import { getInvoiceStats } from "@/api/invoices";
import { useCurrentClient } from "@/context/ClientContext";
import { getClientNavItems } from "@/lib/navigation";
import { formatBytes } from "@/lib/formatBytes";
import type { InvoiceStatsResponse } from "@/types/invoice";

const FUTURE_MODULE_METRICS = [
  "Invoice Value",
  "Taxable Value",
  "GST Amount",
  "Duplicate Invoices",
  "Vendor Summary",
  "Expense Summary",
];

export function ClientWorkspacePage() {
  const { client } = useCurrentClient();
  const [stats, setStats] = useState<InvoiceStatsResponse | null>(null);

  useEffect(() => {
    getInvoiceStats(client.id)
      .then(setStats)
      .catch((error) => console.error("Failed to load invoice stats", error));
  }, [client.id]);

  const tiles = getClientNavItems(client.id).filter((item) => item.path !== `/clients/${client.id}`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{client.company_name}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {client.gstin ?? "No GSTIN on file"}
          {client.financial_year ? ` · FY ${client.financial_year}` : ""}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Files} label="Invoices" value={stats ? `${stats.total}` : "…"} />
        <StatTile icon={Layers} label="Uploaded" value={stats ? `${stats.uploaded_count}` : "…"} tone="success" />
        <StatTile
          icon={FileWarning}
          label="Needs Attention"
          value={stats ? `${stats.error_count}` : "…"}
          tone={stats && stats.error_count > 0 ? "danger" : undefined}
        />
        <StatTile icon={HardDrive} label="Storage Used" value={stats ? formatBytes(stats.total_size_bytes) : "…"} />
      </div>

      <div className="mb-8 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
        {FUTURE_MODULE_METRICS.join(" · ")} will appear here once the Process Invoices module is built.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ label, path, icon: Icon, available }) => (
          <Link
            key={path}
            to={path}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {available ? "Ready to use." : "Coming in a later module."}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:gap-2 dark:text-blue-400">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-all" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Files;
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <Icon className="mb-2 h-4 w-4 text-slate-400" />
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
