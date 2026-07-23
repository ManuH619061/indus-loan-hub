import { Pencil, PenLine } from "lucide-react";
import { LedgerTypeBadge } from "@/components/ledger-master/LedgerTypeBadge";
import { CAPITAL_REVENUE_LABELS, ITC_ELIGIBILITY_COLORS, ITC_ELIGIBILITY_LABELS } from "@/lib/ledgerDisplay";
import { cn } from "@/lib/cn";
import type { Ledger } from "@/types/ledger";

export function LedgerRow({ ledger, onEdit }: { ledger: Ledger; onEdit: (ledger: Ledger) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800/80">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{ledger.name}</p>
          <LedgerTypeBadge ledgerType={ledger.ledger_type} />
          {ledger.is_manually_edited && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <PenLine className="h-3 w-3" />
              Edited
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {ledger.parent_group_name && <span>Parent: {ledger.parent_group_name}</span>}
          {ledger.gstin && <span>GSTIN: {ledger.gstin}</span>}
          {ledger.pan && <span>PAN: {ledger.pan}</span>}
          {ledger.capital_or_revenue !== "not_applicable" && (
            <span>{CAPITAL_REVENUE_LABELS[ledger.capital_or_revenue]}</span>
          )}
          {ledger.gst_itc_eligibility !== "not_applicable" && (
            <span className={cn("font-medium", ITC_ELIGIBILITY_COLORS[ledger.gst_itc_eligibility])}>
              {ITC_ELIGIBILITY_LABELS[ledger.gst_itc_eligibility]}
            </span>
          )}
        </div>
        {(ledger.expense_category || ledger.accounting_purpose) && (
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
            {ledger.expense_category && <span className="font-medium">{ledger.expense_category}: </span>}
            {ledger.accounting_purpose}
          </p>
        )}
        {ledger.suggested_keywords && ledger.suggested_keywords.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ledger.suggested_keywords.slice(0, 8).map((keyword) => (
              <span
                key={keyword}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onEdit(ledger)}
        className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label="Edit ledger"
        title="Edit ledger"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
