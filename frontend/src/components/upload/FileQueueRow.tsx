import { FileText, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { ProgressBar } from "@/components/common/ProgressBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatBytes } from "@/lib/formatBytes";
import { cn } from "@/lib/cn";
import type { QueueItem } from "@/types/invoice";

interface FileQueueRowProps {
  item: QueueItem;
  onRetry: (queueId: string) => void;
  onRemove: (queueId: string) => void;
  onPreview: (item: QueueItem) => void;
}

export function FileQueueRow({ item, onRetry, onRemove, onPreview }: FileQueueRowProps) {
  const filename = item.file?.name ?? item.invoice?.original_filename ?? "Unknown file";
  const size = item.file?.size ?? item.invoice?.file_size_bytes ?? 0;
  const pageCount = item.invoice?.page_count ?? null;
  const thumbnailSrc = item.invoice?.thumbnail_url ?? item.localPreviewUrl;
  const canPreview = item.status === "success" || (item.status === "error" && item.invoice);

  return (
    <div
      className={cn(
        "grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800/80",
        item.status === "error" && "bg-red-50/50 dark:bg-red-950/10"
      )}
    >
      <button
        type="button"
        onClick={() => canPreview && onPreview(item)}
        disabled={!canPreview}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
          canPreview && "cursor-zoom-in hover:ring-2 hover:ring-blue-400"
        )}
        aria-label="Preview invoice"
      >
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-slate-400" />
        )}
      </button>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={filename}>
          {filename}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>{formatBytes(size)}</span>
          {pageCount !== null && (
            <>
              <span aria-hidden>&middot;</span>
              <span>
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          <StatusBadge status={item.status} />
        </div>
        {item.status === "uploading" && (
          <div className="mt-1.5 max-w-xs">
            <ProgressBar value={item.progress} />
          </div>
        )}
        {item.status === "error" && item.errorMessage && (
          <p className="mt-1 truncate text-xs text-red-600 dark:text-red-400" title={item.errorMessage}>
            {item.errorMessage}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canPreview && (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Preview"
            title="Preview"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        )}
        {item.status === "error" && (
          <button
            type="button"
            onClick={() => onRetry(item.queueId)}
            className="rounded-md p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950"
            aria-label="Retry upload"
            title={item.errorKind === "processing_error" ? "Retry processing" : "Retry upload"}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.queueId)}
          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          aria-label="Delete file"
          title="Delete file"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
