import { useCallback, useEffect, useRef } from "react";
import { extractErrorMessage } from "@/api/client";
import { deleteInvoice, listInvoices, reprocessInvoice, uploadInvoice } from "@/api/invoices";
import { ALLOWED_EXTENSIONS, MAX_BATCH_FILES, MAX_FILE_SIZE_BYTES, UPLOAD_CONCURRENCY } from "@/lib/constants";
import { useUploadQueueStore } from "@/store/uploadQueueStore";
import type { QueueItem } from "@/types/invoice";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

function isImageExtension(extension: string): boolean {
  return extension === "jpg" || extension === "jpeg" || extension === "png";
}

function createQueueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildQueueItem(file: File): QueueItem {
  const extension = getExtension(file.name);
  const isValidType = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  const isValidSize = file.size <= MAX_FILE_SIZE_BYTES;
  const localPreviewUrl = isImageExtension(extension) ? URL.createObjectURL(file) : null;

  if (!isValidType) {
    return {
      queueId: createQueueId(),
      file,
      localPreviewUrl,
      status: "error",
      progress: 0,
      errorKind: "validation",
      errorMessage: `Unsupported file type ".${extension || "unknown"}". Allowed: PDF, JPG, JPEG, PNG.`,
      invoice: null,
    };
  }

  if (!isValidSize) {
    return {
      queueId: createQueueId(),
      file,
      localPreviewUrl,
      status: "error",
      progress: 0,
      errorKind: "validation",
      errorMessage: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB size limit.`,
      invoice: null,
    };
  }

  return {
    queueId: createQueueId(),
    file,
    localPreviewUrl,
    status: "queued",
    progress: 0,
    errorKind: null,
    errorMessage: null,
    invoice: null,
  };
}

/** Drives the invoice upload queue for a single client (company). Every
 * upload/list/delete/reprocess call is scoped to `clientId` — the queue is
 * cleared and re-hydrated from the server whenever the client changes. */
export function useUploadQueue(clientId: string) {
  const items = useUploadQueueStore((state) => state.items);
  const addItems = useUploadQueueStore((state) => state.addItems);
  const updateItem = useUploadQueueStore((state) => state.updateItem);
  const removeFromStore = useUploadQueueStore((state) => state.removeItem);
  const hydrateFromInvoices = useUploadQueueStore((state) => state.hydrateFromInvoices);
  const clearAll = useUploadQueueStore((state) => state.clearAll);

  const controllersRef = useRef(new Map<string, AbortController>());
  const activeUploadsRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Load this client's previously uploaded invoices on mount, and whenever
  // the selected client changes, so the queue never leaks data between
  // clients and survives page reloads (everything is persisted server-side).
  useEffect(() => {
    clearAll();
    listInvoices(clientId)
      .then((response) => hydrateFromInvoices(response.items))
      .catch((error) => console.error("Failed to load existing invoices", error));
  }, [clientId, clearAll, hydrateFromInvoices]);

  const runUpload = useCallback(
    async (item: QueueItem) => {
      if (!item.file) return;
      activeUploadsRef.current += 1;
      updateItem(item.queueId, { status: "uploading", progress: 0, errorKind: null, errorMessage: null });

      const controller = new AbortController();
      controllersRef.current.set(item.queueId, controller);

      try {
        const invoice = await uploadInvoice(clientId, item.file, {
          signal: controller.signal,
          onProgress: (percent) => updateItem(item.queueId, { progress: percent }),
        });
        updateItem(item.queueId, {
          status: invoice.status === "uploaded" ? "success" : "error",
          progress: 100,
          invoice,
          errorKind: invoice.status === "error" ? "processing_error" : null,
          errorMessage: invoice.error_message,
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          updateItem(item.queueId, {
            status: "error",
            errorKind: "upload_failed",
            errorMessage: extractErrorMessage(error, "Upload failed. Please retry."),
          });
        }
      } finally {
        controllersRef.current.delete(item.queueId);
        activeUploadsRef.current -= 1;
      }
    },
    [clientId, updateItem]
  );

  // Concurrency-limited runner: whenever the queue changes, top up active
  // uploads to UPLOAD_CONCURRENCY so up to ~1000 files upload smoothly
  // without saturating the browser or the server.
  useEffect(() => {
    const queued = items.filter((item) => item.status === "queued");
    const availableSlots = UPLOAD_CONCURRENCY - activeUploadsRef.current;
    queued.slice(0, Math.max(0, availableSlots)).forEach((item) => {
      runUpload(item);
    });
  }, [items, runUpload]);

  const addFiles = useCallback(
    (files: File[]) => {
      const currentCount = itemsRef.current.length;
      const remainingSlots = Math.max(0, MAX_BATCH_FILES - currentCount);
      const accepted = files.slice(0, remainingSlots);
      const skipped = files.length - accepted.length;

      if (accepted.length > 0) {
        addItems(accepted.map(buildQueueItem));
      }
      return { added: accepted.length, skipped };
    },
    [addItems]
  );

  const retry = useCallback(
    (queueId: string) => {
      const item = itemsRef.current.find((candidate) => candidate.queueId === queueId);
      if (!item) return;

      if (item.file) {
        updateItem(queueId, { status: "queued", errorKind: null, errorMessage: null, progress: 0 });
        return;
      }

      if (item.invoice) {
        updateItem(queueId, { status: "uploading", errorKind: null, errorMessage: null });
        reprocessInvoice(clientId, item.invoice.id)
          .then((invoice) => {
            updateItem(queueId, {
              status: invoice.status === "uploaded" ? "success" : "error",
              invoice,
              errorKind: invoice.status === "error" ? "processing_error" : null,
              errorMessage: invoice.error_message,
            });
          })
          .catch((error) => {
            updateItem(queueId, {
              status: "error",
              errorKind: "processing_error",
              errorMessage: extractErrorMessage(error, "Reprocessing failed. Please try again."),
            });
          });
      }
    },
    [clientId, updateItem]
  );

  const remove = useCallback(
    (queueId: string) => {
      const item = itemsRef.current.find((candidate) => candidate.queueId === queueId);
      if (!item) return;

      const controller = controllersRef.current.get(queueId);
      controller?.abort();

      if (item.localPreviewUrl) {
        URL.revokeObjectURL(item.localPreviewUrl);
      }

      removeFromStore(queueId);

      if (item.invoice) {
        deleteInvoice(clientId, item.invoice.id).catch((error) =>
          console.error(`Failed to delete invoice ${item.invoice?.id} on server`, error)
        );
      }
    },
    [clientId, removeFromStore]
  );

  return { items, addFiles, retry, remove };
}
