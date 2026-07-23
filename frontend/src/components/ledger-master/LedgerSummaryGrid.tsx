import type { LedgerMasterSummary } from "@/types/ledger";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function LedgerSummaryGrid({ summary }: { summary: LedgerMasterSummary }) {
  return (
    <div className="space-y-3">
      {summary.last_import && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last synced {new Date(summary.last_import.imported_at).toLocaleString()} from{" "}
          <span className="font-medium">{summary.last_import.filename}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Tile label="Total Ledgers" value={summary.total_ledgers} />
        <Tile label="Groups" value={summary.total_groups} />
        <Tile label="Vendors" value={summary.vendor_count} />
        <Tile label="Customers" value={summary.customer_count} />
        <Tile label="Bank" value={summary.bank_count} />
        <Tile label="Cash" value={summary.cash_count} />
        <Tile label="GST Ledgers" value={summary.gst_ledger_count} />
        <Tile label="TDS Ledgers" value={summary.tds_ledger_count} />
        <Tile label="Expense" value={summary.expense_ledger_count} />
        <Tile label="Income" value={summary.income_ledger_count} />
        <Tile label="Asset" value={summary.asset_ledger_count} />
        <Tile label="Liability" value={summary.liability_ledger_count} />
      </div>
    </div>
  );
}
