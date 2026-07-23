import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { resolveApiUrl } from "@/api/invoices";
import { formatBytes } from "@/lib/formatBytes";
import type { QueueItem } from "@/types/invoice";

export function InvoicePreviewModal({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const invoice = item.invoice;
  const filename = invoice?.original_filename ?? item.file?.name ?? "Invoice";
  const fileUrl = invoice ? resolveApiUrl(invoice.file_url) : null;
  const isPdf = (invoice?.file_extension ?? item.file?.name.split(".").pop())?.toLowerCase() === "pdf";

  return (
    <Modal title={filename} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{formatBytes(invoice?.file_size_bytes ?? item.file?.size ?? 0)}</span>
          {invoice?.page_count != null && (
            <span>
              {invoice.page_count} page{invoice.page_count === 1 ? "" : "s"}
            </span>
          )}
          {invoice?.status === "error" && invoice.error_message && (
            <span className="text-red-600 dark:text-red-400">{invoice.error_message}</span>
          )}
        </div>

        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          {fileUrl && isPdf && (
            <iframe title={filename} src={fileUrl} className="h-[70vh] w-full" />
          )}
          {fileUrl && !isPdf && <img src={fileUrl} alt={filename} className="max-h-[70vh] w-auto object-contain" />}
          {!fileUrl && item.localPreviewUrl && (
            <img src={item.localPreviewUrl} alt={filename} className="max-h-[70vh] w-auto object-contain" />
          )}
          {!fileUrl && !item.localPreviewUrl && (
            <p className="p-8 text-sm text-slate-400">No preview available yet.</p>
          )}
        </div>

        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Open original in new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </Modal>
  );
}
