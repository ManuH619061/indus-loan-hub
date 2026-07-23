import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { extractErrorMessage } from "@/api/client";
import { updateLedger } from "@/api/ledgerMaster";
import { LedgerTypeBadge } from "@/components/ledger-master/LedgerTypeBadge";
import type { Ledger } from "@/types/ledger";

interface LedgerEditModalProps {
  clientId: string;
  ledger: Ledger;
  onClose: () => void;
  onSaved: (ledger: Ledger) => void;
}

export function LedgerEditModal({ clientId, ledger, onClose, onSaved }: LedgerEditModalProps) {
  const [expenseCategory, setExpenseCategory] = useState(ledger.expense_category ?? "");
  const [purpose, setPurpose] = useState(ledger.accounting_purpose ?? "");
  const [keywordsText, setKeywordsText] = useState((ledger.suggested_keywords ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const keywords = keywordsText
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean);
      const saved = await updateLedger(clientId, ledger.id, {
        expense_category: expenseCategory.trim() || null,
        accounting_purpose: purpose.trim() || null,
        suggested_keywords: keywords.length > 0 ? keywords : null,
      });
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save this ledger. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={ledger.name} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <LedgerTypeBadge ledgerType={ledger.ledger_type} />
        {ledger.parent_group_name && <span>Parent: {ledger.parent_group_name}</span>}
        {ledger.gstin && <span>GSTIN: {ledger.gstin}</span>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Expense Category
          </span>
          <input
            type="text"
            value={expenseCategory}
            onChange={(event) => setExpenseCategory(event.target.value)}
            placeholder="e.g. Office Expenses"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Accounting Purpose
          </span>
          <textarea
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            rows={3}
            placeholder="What does this ledger represent, for future invoice matching?"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Common Invoice Keywords (comma-separated)
          </span>
          <textarea
            value={keywordsText}
            onChange={(event) => setKeywordsText(event.target.value)}
            rows={2}
            placeholder="stationery, printing, office supplies, pens"
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
