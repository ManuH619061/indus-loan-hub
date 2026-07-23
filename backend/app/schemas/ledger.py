"""Pydantic schemas for the Ledger Master module."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.ledger import CapitalOrRevenue, ItcEligibility, LedgerNature, LedgerType


class LedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    parent_group_name: str | None
    nature: LedgerNature
    ledger_type: LedgerType
    gstin: str | None
    pan: str | None
    opening_balance: str | None
    is_gst_ledger: bool
    gst_component: str | None
    is_tds_ledger: bool
    capital_or_revenue: CapitalOrRevenue
    gst_itc_eligibility: ItcEligibility
    expense_category: str | None
    accounting_purpose: str | None
    suggested_keywords: list[str] | None
    is_manually_edited: bool
    created_at: datetime
    updated_at: datetime


class LedgerListResponse(BaseModel):
    items: list[LedgerOut]
    total: int


class LedgerUpdate(BaseModel):
    expense_category: str | None = None
    accounting_purpose: str | None = None
    suggested_keywords: list[str] | None = None


class CostCentreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    parent_cost_centre_name: str | None
    category: str | None


class LedgerMasterImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    group_count: int
    ledger_count: int
    cost_centre_count: int
    warnings: list[str] | None
    imported_at: datetime


class LedgerMasterSummaryResponse(BaseModel):
    total_ledgers: int
    total_groups: int
    total_cost_centres: int
    vendor_count: int
    customer_count: int
    bank_count: int
    cash_count: int
    gst_ledger_count: int
    tds_ledger_count: int
    expense_ledger_count: int
    income_ledger_count: int
    asset_ledger_count: int
    liability_ledger_count: int
    last_import: LedgerMasterImportOut | None
