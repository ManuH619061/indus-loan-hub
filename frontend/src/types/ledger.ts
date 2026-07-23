export type LedgerNature = "asset" | "liability" | "income" | "expense" | "unknown";

export type LedgerType =
  | "vendor"
  | "customer"
  | "bank"
  | "cash"
  | "gst_duty"
  | "tds_duty"
  | "expense"
  | "income"
  | "asset"
  | "liability"
  | "other";

export type CapitalOrRevenue = "capital" | "revenue" | "not_applicable";

export type ItcEligibility = "eligible" | "blocked" | "review" | "not_applicable";

export interface Ledger {
  id: string;
  name: string;
  parent_group_name: string | null;
  nature: LedgerNature;
  ledger_type: LedgerType;
  gstin: string | null;
  pan: string | null;
  opening_balance: string | null;
  is_gst_ledger: boolean;
  gst_component: string | null;
  is_tds_ledger: boolean;
  capital_or_revenue: CapitalOrRevenue;
  gst_itc_eligibility: ItcEligibility;
  expense_category: string | null;
  accounting_purpose: string | null;
  suggested_keywords: string[] | null;
  is_manually_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface LedgerListResponse {
  items: Ledger[];
  total: number;
}

export interface LedgerUpdatePayload {
  expense_category?: string | null;
  accounting_purpose?: string | null;
  suggested_keywords?: string[] | null;
}

export interface CostCentre {
  id: string;
  name: string;
  parent_cost_centre_name: string | null;
  category: string | null;
}

export interface LedgerMasterImportRecord {
  id: string;
  filename: string;
  group_count: number;
  ledger_count: number;
  cost_centre_count: number;
  warnings: string[] | null;
  imported_at: string;
}

export interface LedgerMasterSummary {
  total_ledgers: number;
  total_groups: number;
  total_cost_centres: number;
  vendor_count: number;
  customer_count: number;
  bank_count: number;
  cash_count: number;
  gst_ledger_count: number;
  tds_ledger_count: number;
  expense_ledger_count: number;
  income_ledger_count: number;
  asset_ledger_count: number;
  liability_ledger_count: number;
  last_import: LedgerMasterImportRecord | null;
}
