import type { CapitalOrRevenue, ItcEligibility, LedgerNature, LedgerType } from "@/types/ledger";

export const LEDGER_TYPE_LABELS: Record<LedgerType, string> = {
  vendor: "Vendor",
  customer: "Customer",
  bank: "Bank",
  cash: "Cash",
  gst_duty: "GST Ledger",
  tds_duty: "TDS Ledger",
  expense: "Expense",
  income: "Income",
  asset: "Asset",
  liability: "Liability",
  other: "Other",
};

export const LEDGER_TYPE_COLORS: Record<LedgerType, string> = {
  vendor: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  customer: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  bank: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cash: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  gst_duty: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  tds_duty: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  expense: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  income: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  asset: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  liability: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const LEDGER_NATURE_LABELS: Record<LedgerNature, string> = {
  asset: "Asset",
  liability: "Liability",
  income: "Income",
  expense: "Expense",
  unknown: "Unknown",
};

export const CAPITAL_REVENUE_LABELS: Record<CapitalOrRevenue, string> = {
  capital: "Capital",
  revenue: "Revenue",
  not_applicable: "—",
};

export const ITC_ELIGIBILITY_LABELS: Record<ItcEligibility, string> = {
  eligible: "ITC Eligible",
  blocked: "ITC Blocked",
  review: "Review ITC",
  not_applicable: "—",
};

export const ITC_ELIGIBILITY_COLORS: Record<ItcEligibility, string> = {
  eligible: "text-emerald-600 dark:text-emerald-400",
  blocked: "text-red-600 dark:text-red-400",
  review: "text-amber-600 dark:text-amber-400",
  not_applicable: "text-slate-400 dark:text-slate-500",
};
