import { useCallback, useEffect, useState } from "react";
import { Plus, Receipt, Search } from "lucide-react";
import { archiveClient, deleteClient, listClients, unarchiveClient } from "@/api/clients";
import { extractErrorMessage } from "@/api/client";
import { ClientCard } from "@/components/clients/ClientCard";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/cn";
import type { Client, ClientStatus } from "@/types/client";

type StatusFilter = ClientStatus | "all";

export function ClientDashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const [formTarget, setFormTarget] = useState<Client | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    listClients({
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    })
      .then((response) => setClients(response.items))
      .catch((err) => setError(extractErrorMessage(err, "Could not load clients.")))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchClients, 250);
    return () => clearTimeout(timeout);
  }, [fetchClients]);

  const handleArchiveToggle = async (client: Client) => {
    const action = client.status === "active" ? archiveClient : unarchiveClient;
    await action(client.id);
    fetchClients();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      fetchClients();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Receipt className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
                AI Invoice Accounting
              </p>
              <p className="text-xs text-slate-400">Client Dashboard</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Clients</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every client&apos;s invoices, masters, and reports are kept completely separate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Client
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, GSTIN, PAN, contact..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {(["active", "archived", "all"] as StatusFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  statusFilter === option
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && clients.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-20 text-center dark:border-slate-800">
            <Receipt className="h-8 w-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search ? "No clients match your search." : "No clients yet. Create your first client to get started."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={setFormTarget}
              onArchiveToggle={handleArchiveToggle}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      </main>

      {formTarget && (
        <ClientFormModal
          client={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            fetchClients();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Client"
          message={`This permanently deletes "${deleteTarget.company_name}" and all of its invoices, masters, and reports. This cannot be undone.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Client"}
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
