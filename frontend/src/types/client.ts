export type ClientStatus = "active" | "archived";

export interface Client {
  id: string;
  company_name: string;
  gstin: string | null;
  pan: string | null;
  financial_year: string | null;
  address: string | null;
  contact_person: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
  invoice_count: number;
  total_size_bytes: number;
}

export interface ClientListResponse {
  items: Client[];
  total: number;
}

export interface ClientPayload {
  company_name: string;
  gstin?: string | null;
  pan?: string | null;
  financial_year?: string | null;
  address?: string | null;
  contact_person?: string | null;
}
