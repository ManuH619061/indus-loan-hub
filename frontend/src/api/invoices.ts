import { API_ORIGIN, apiClient } from "@/api/client";
import type { Invoice, InvoiceListResponse, InvoiceStatsResponse } from "@/types/invoice";

interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadInvoice(clientId: string, file: File, options: UploadOptions = {}): Promise<Invoice> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<Invoice>(`/clients/${clientId}/invoices/upload`, formData, {
    signal: options.signal,
    onUploadProgress: (event) => {
      if (!options.onProgress || !event.total) return;
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
}

export async function listInvoices(
  clientId: string,
  params: { status?: "uploaded" | "error" } = {}
): Promise<InvoiceListResponse> {
  const response = await apiClient.get<InvoiceListResponse>(`/clients/${clientId}/invoices`, { params });
  return response.data;
}

export async function getInvoiceStats(clientId: string): Promise<InvoiceStatsResponse> {
  const response = await apiClient.get<InvoiceStatsResponse>(`/clients/${clientId}/invoices/stats`);
  return response.data;
}

export async function deleteInvoice(clientId: string, invoiceId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/invoices/${invoiceId}`);
}

export async function reprocessInvoice(clientId: string, invoiceId: string): Promise<Invoice> {
  const response = await apiClient.post<Invoice>(`/clients/${clientId}/invoices/${invoiceId}/reprocess`);
  return response.data;
}

/** Resolves a server-provided path (e.g. invoice.thumbnail_url, already
 * prefixed with /api/v1/...) against the API's origin, for use directly in
 * <img src> / <iframe src> / href attributes. */
export function resolveApiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}
