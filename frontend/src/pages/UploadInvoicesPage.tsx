import { useState } from "react";
import { Inbox } from "lucide-react";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { UploadSummaryBar } from "@/components/upload/UploadSummaryBar";
import { FileQueueList } from "@/components/upload/FileQueueList";
import { InvoicePreviewModal } from "@/components/upload/InvoicePreviewModal";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { useCurrentClient } from "@/context/ClientContext";
import type { QueueItem } from "@/types/invoice";

export function UploadInvoicesPage() {
  const { client } = useCurrentClient();
  const { items, addFiles, retry, remove } = useUploadQueue(client.id);
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    const { added, skipped } = addFiles(files);
    if (skipped > 0) {
      setNotice(
        `Added ${added} file${added === 1 ? "" : "s"}. ${skipped} file${skipped === 1 ? "" : "s"} were skipped — the 1,000 file limit was reached.`
      );
    } else {
      setNotice(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upload Invoices</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload scanned purchase invoices (PDF, JPG, JPEG, PNG) as single files, multiple files, or an entire
          folder.
        </p>
      </div>

      <UploadDropzone onFilesSelected={handleFilesSelected} />

      {notice && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {notice}
        </div>
      )}

      <div className="mt-6">
        <UploadSummaryBar items={items} />

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
            <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No invoices uploaded yet.</p>
          </div>
        ) : (
          <FileQueueList items={items} onRetry={retry} onRemove={remove} onPreview={setPreviewItem} />
        )}
      </div>

      {previewItem && <InvoicePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
    </div>
  );
}
