import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, Building2, FileText, Pencil, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/formatBytes";
import type { Client } from "@/types/client";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onArchiveToggle: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export function ClientCard({ client, onEdit, onArchiveToggle, onDelete }: ClientCardProps) {
  const isArchived = client.status === "archived";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          {isArchived && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Archived
            </span>
          )}
        </div>
        <Link
          to={`/clients/${client.id}`}
          className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100"
          title={client.company_name}
        >
          {client.company_name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {client.gstin ?? "No GSTIN"} {client.financial_year ? `· FY ${client.financial_year}` : ""}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {client.invoice_count} invoice{client.invoice_count === 1 ? "" : "s"}
          </span>
          <span>{formatBytes(client.total_size_bytes)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <Link
          to={`/clients/${client.id}`}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Open
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(client)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Edit client"
            title="Edit client"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onArchiveToggle(client)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={isArchived ? "Unarchive client" : "Archive client"}
            title={isArchived ? "Unarchive client" : "Archive client"}
          >
            {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(client)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            aria-label="Delete client"
            title="Delete client"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
