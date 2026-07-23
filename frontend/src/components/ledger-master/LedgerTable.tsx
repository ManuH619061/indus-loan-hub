import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { listLedgers } from "@/api/ledgerMaster";
import { extractErrorMessage } from "@/api/client";
import { LedgerRow } from "@/components/ledger-master/LedgerRow";
import { LedgerEditModal } from "@/components/ledger-master/LedgerEditModal";
import { LEDGER_TYPE_LABELS } from "@/lib/ledgerDisplay";
import { cn } from "@/lib/cn";
import type { Ledger, LedgerType } from "@/types/ledger";

const FILTERS: { value: LedgerType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vendor", label: LEDGER_TYPE_LABELS.vendor },
  { value: "customer", label: LEDGER_TYPE_LABELS.customer },
  { value: "bank", label: LEDGER_TYPE_LABELS.bank },
  { value: "cash", label: LEDGER_TYPE_LABELS.cash },
  { value: "gst_duty", label: LEDGER_TYPE_LABELS.gst_duty },
  { value: "tds_duty", label: LEDGER_TYPE_LABELS.tds_duty },
  { value: "expense", label: LEDGER_TYPE_LABELS.expense },
  { value: "income", label: LEDGER_TYPE_LABELS.income },
  { value: "asset", label: LEDGER_TYPE_LABELS.asset },
  { value: "liability", label: LEDGER_TYPE_LABELS.liability },
];

export function LedgerTable({ clientId, refreshKey }: { clientId: string; refreshKey: number }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LedgerType | "all">("all");
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => {
      listLedgers(clientId, {
        search: search.trim() || undefined,
        ledger_type: typeFilter === "all" ? undefined : typeFilter,
        limit: 1000,
      })
        .then((response) => {
          setLedgers(response.items);
          setTotal(response.total);
        })
        .catch((err) => setError(extractErrorMessage(err, "Could not load ledgers.")))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [clientId, search, typeFilter, refreshKey]);

  const virtualizer = useVirtualizer({
    count: ledgers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ledgers by name or group..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                typeFilter === filter.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {loading ? "Loading…" : `${total} ledger${total === 1 ? "" : "s"}`}
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && ledgers.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
          No ledgers match your search.
        </div>
      )}

      {ledgers.length > 0 && (
        <div
          ref={parentRef}
          className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const ledger = ledgers[virtualRow.index];
              return (
                <div
                  key={ledger.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LedgerRow ledger={ledger} onEdit={setEditingLedger} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingLedger && (
        <LedgerEditModal
          clientId={clientId}
          ledger={editingLedger}
          onClose={() => setEditingLedger(null)}
          onSaved={(updated) => {
            setLedgers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setEditingLedger(null);
          }}
        />
      )}
    </div>
  );
}
