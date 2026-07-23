export type InvoiceStatus = "uploaded" | "error";

/** Shape returned by the FastAPI backend for a persisted invoice. */
export interface Invoice {
  id: string;
  original_filename: string;
  file_extension: string;
  content_type: string;
  file_size_bytes: number;
  page_count: number | null;
  has_thumbnail: boolean;
  status: InvoiceStatus;
  error_message: string | null;
  uploaded_at: string;
  updated_at: string;
  thumbnail_url: string | null;
  file_url: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  uploaded_count: number;
  error_count: number;
  total_size_bytes: number;
}

export interface InvoiceStatsResponse {
  total: number;
  uploaded_count: number;
  error_count: number;
  total_size_bytes: number;
  total_pages: number;
}

/** Client-side lifecycle status of a queue row, before/after the server record exists. */
export type QueueItemStatus = "queued" | "uploading" | "success" | "error";

/** Why a queue item is in the "error" state — determines which recovery action to offer. */
export type QueueErrorKind = "validation" | "upload_failed" | "processing_error";

export interface QueueItem {
  queueId: string;
  /** Absent for items hydrated from the server on page load (no local File object). */
  file: File | null;
  localPreviewUrl: string | null;
  status: QueueItemStatus;
  progress: number;
  errorKind: QueueErrorKind | null;
  errorMessage: string | null;
  invoice: Invoice | null;
}
