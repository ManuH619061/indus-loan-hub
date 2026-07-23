import { create } from "zustand";
import type { Invoice, QueueItem } from "@/types/invoice";

interface UploadQueueState {
  items: QueueItem[];
  addItems: (items: QueueItem[]) => void;
  updateItem: (queueId: string, patch: Partial<QueueItem>) => void;
  removeItem: (queueId: string) => void;
  hydrateFromInvoices: (invoices: Invoice[]) => void;
  clearFinished: () => void;
  clearAll: () => void;
}

export const useUploadQueueStore = create<UploadQueueState>((set) => ({
  items: [],

  addItems: (newItems) => set((state) => ({ items: [...state.items, ...newItems] })),

  updateItem: (queueId, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.queueId === queueId ? { ...item, ...patch } : item)),
    })),

  removeItem: (queueId) =>
    set((state) => ({ items: state.items.filter((item) => item.queueId !== queueId) })),

  hydrateFromInvoices: (invoices) =>
    set((state) => {
      const knownInvoiceIds = new Set(state.items.map((item) => item.invoice?.id).filter(Boolean));
      const hydrated: QueueItem[] = invoices
        .filter((invoice) => !knownInvoiceIds.has(invoice.id))
        .map((invoice) => ({
          queueId: `server-${invoice.id}`,
          file: null,
          localPreviewUrl: null,
          status: invoice.status === "uploaded" ? "success" : "error",
          progress: 100,
          errorKind: invoice.status === "error" ? "processing_error" : null,
          errorMessage: invoice.error_message,
          invoice,
        }));
      return { items: [...hydrated, ...state.items] };
    }),

  clearFinished: () =>
    set((state) => ({ items: state.items.filter((item) => item.status === "queued" || item.status === "uploading") })),

  clearAll: () => set({ items: [] }),
}));
