import { useCallback, useEffect, useState } from "react";
import { getLedgerMasterSummary } from "@/api/ledgerMaster";
import { LedgerSummaryGrid } from "@/components/ledger-master/LedgerSummaryGrid";
import { LedgerTable } from "@/components/ledger-master/LedgerTable";
import { TallyImportPanel } from "@/components/ledger-master/TallyImportPanel";
import { useCurrentClient } from "@/context/ClientContext";
import type { LedgerMasterSummary } from "@/types/ledger";

export function UploadLedgerMasterPage() {
  const { client } = useCurrentClient();
  const [summary, setSummary] = useState<LedgerMasterSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchSummary = useCallback(() => {
    getLedgerMasterSummary(client.id)
      .then(setSummary)
      .catch((error) => console.error("Failed to load ledger master summary", error));
  }, [client.id]);

  useEffect(fetchSummary, [fetchSummary]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upload Ledger Master</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Import your Tally chart of accounts so invoices can be matched to the right ledger. Ledger nature, GST/TDS
          applicability, and vendor/customer mapping are resolved from your actual group structure — not guessed
          from names alone.
        </p>
      </div>

      <TallyImportPanel
        clientId={client.id}
        onImported={() => {
          fetchSummary();
          setRefreshKey((key) => key + 1);
        }}
      />

      {summary && summary.total_ledgers > 0 && (
        <div className="mt-6">
          <LedgerSummaryGrid summary={summary} />
        </div>
      )}

      {summary && summary.total_ledgers > 0 && (
        <div className="mt-6">
          <LedgerTable clientId={client.id} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}
