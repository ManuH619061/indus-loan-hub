import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/** Extracts a human-readable message from a FastAPI error response. */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.code === "ERR_CANCELED") return "Upload cancelled.";
    if (!error.response) return "Could not reach the server. Check your connection and retry.";
  }
  return fallback;
}
