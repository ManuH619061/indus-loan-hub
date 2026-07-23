import { LEDGER_TYPE_COLORS, LEDGER_TYPE_LABELS } from "@/lib/ledgerDisplay";
import { cn } from "@/lib/cn";
import type { LedgerType } from "@/types/ledger";

export function LedgerTypeBadge({ ledgerType }: { ledgerType: LedgerType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        LEDGER_TYPE_COLORS[ledgerType]
      )}
    >
      {LEDGER_TYPE_LABELS[ledgerType]}
    </span>
  );
}
