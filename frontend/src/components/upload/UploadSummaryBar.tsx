import { useMemo } from "react";
import { formatBytes } from "@/lib/formatBytes";
import { ProgressBar } from "@/components/common/ProgressBar";
import type { QueueItem } from "@/types/invoice";

function statTile(label: string, value: string, tone?: string) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-lg font-semibold ${tone ?? "text-slate-900 dark:text-slate-100"}`}>{value}</span>
    </div>
  );
}

export function UploadSummaryBar({ items }: { items: QueueItem[] }) {
  const summary = useMemo(() => {
    const total = items.length;
    const uploaded = items.filter((item) => item.status === "success").length;
    const errors = items.filter((item) => item.status === "error").length;
    const inProgress = items.filter((item) => item.status === "queued" || item.status === "uploading").length;
    const totalBytes = items.reduce((sum, item) => sum + (item.file?.size ?? item.invoice?.file_size_bytes ?? 0), 0);

    const uploadedOrInFlightBytes = items.reduce((sum, item) => {
      const size = item.file?.size ?? item.invoice?.file_size_bytes ?? 0;
      if (item.status === "success" || item.status === "error") return sum + size;
      if (item.status === "uploading") return sum + size * (item.progress / 100);
      return sum;
    }, 0);

    const overallProgress = totalBytes === 0 ? 0 : Math.round((uploadedOrInFlightBytes / totalBytes) * 100);

    return { total, uploaded, errors, inProgress, totalBytes, overallProgress };
  }, [items]);

  if (summary.total === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTile("Total Files", `${summary.total}`)}
        {statTile("Uploaded", `${summary.uploaded}`, "text-emerald-600 dark:text-emerald-400")}
        {statTile("In Progress", `${summary.inProgress}`, "text-blue-600 dark:text-blue-400")}
        {statTile("Errors", `${summary.errors}`, summary.errors > 0 ? "text-red-600 dark:text-red-400" : undefined)}
        {statTile("Total Size", formatBytes(summary.totalBytes))}
      </div>
      {summary.inProgress > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Upload Progress</span>
            <span>{summary.overallProgress}%</span>
          </div>
          <ProgressBar value={summary.overallProgress} />
        </div>
      )}
    </div>
  );
}
