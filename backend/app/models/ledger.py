"""ORM models for the Ledger Master module.

A Tally "Masters" XML export is parsed into LedgerGroup / Ledger /
CostCentre rows, each scoped to a client_id exactly like invoices — one
client's chart of accounts and vendor-ledger mappings must never be visible
to, or influence, another client's.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LedgerNature(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    INCOME = "income"
    EXPENSE = "expense"
    UNKNOWN = "unknown"


class LedgerType(str, enum.Enum):
    VENDOR = "vendor"  # Sundry Creditor
    CUSTOMER = "customer"  # Sundry Debtor
    BANK = "bank"
    CASH = "cash"
    GST_DUTY = "gst_duty"
    TDS_DUTY = "tds_duty"
    EXPENSE = "expense"
    INCOME = "income"
    ASSET = "asset"
    LIABILITY = "liability"
    OTHER = "other"


class CapitalOrRevenue(str, enum.Enum):
    CAPITAL = "capital"
    REVENUE = "revenue"
    NOT_APPLICABLE = "not_applicable"


class ItcEligibility(str, enum.Enum):
    ELIGIBLE = "eligible"
    BLOCKED = "blocked"
    REVIEW = "review"
    NOT_APPLICABLE = "not_applicable"


def _generate_id() -> str:
    return uuid.uuid4().hex


class LedgerMasterImport(Base):
    """One record per Tally XML file imported for a client — an audit trail
    of what was imported and when, shown in the UI as "last synced"."""

    __tablename__ = "ledger_master_imports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    group_count: Mapped[int] = mapped_column(Integer, default=0)
    ledger_count: Mapped[int] = mapped_column(Integer, default=0)
    cost_centre_count: Mapped[int] = mapped_column(Integer, default=0)
    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)

    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LedgerGroup(Base):
    __tablename__ = "ledger_groups"
    __table_args__ = (
        UniqueConstraint("client_id", "name", name="uq_ledger_group_client_name"),
        Index("ix_ledger_groups_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    parent_group_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_standard: Mapped[bool] = mapped_column(default=False)
    resolved_nature: Mapped[LedgerNature] = mapped_column(
        Enum(LedgerNature, native_enum=False, length=16), default=LedgerNature.UNKNOWN
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Ledger(Base):
    __tablename__ = "ledgers"
    __table_args__ = (
        UniqueConstraint("client_id", "name", name="uq_ledger_client_name"),
        Index("ix_ledgers_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    parent_group_name: Mapped[str | None] = mapped_column(String(256), nullable=True)

    nature: Mapped[LedgerNature] = mapped_column(
        Enum(LedgerNature, native_enum=False, length=16), default=LedgerNature.UNKNOWN
    )
    ledger_type: Mapped[LedgerType] = mapped_column(
        Enum(LedgerType, native_enum=False, length=16), default=LedgerType.OTHER
    )

    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    opening_balance: Mapped[str | None] = mapped_column(String(32), nullable=True)

    is_gst_ledger: Mapped[bool] = mapped_column(default=False)
    gst_component: Mapped[str | None] = mapped_column(String(16), nullable=True)  # CGST/SGST/IGST/CESS/UTGST
    is_tds_ledger: Mapped[bool] = mapped_column(default=False)

    capital_or_revenue: Mapped[CapitalOrRevenue] = mapped_column(
        Enum(CapitalOrRevenue, native_enum=False, length=16), default=CapitalOrRevenue.NOT_APPLICABLE
    )
    gst_itc_eligibility: Mapped[ItcEligibility] = mapped_column(
        Enum(ItcEligibility, native_enum=False, length=16), default=ItcEligibility.NOT_APPLICABLE
    )

    expense_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    accounting_purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Once the user edits category/purpose/keywords, re-importing the Tally
    # XML must not clobber their correction — only auto-fill when blank.
    is_manually_edited: Mapped[bool] = mapped_column(default=False)

    # Every other Tally XML field we captured but don't have a dedicated
    # column for, kept for transparency/debugging rather than discarded.
    raw_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CostCentre(Base):
    __tablename__ = "cost_centres"
    __table_args__ = (
        UniqueConstraint("client_id", "name", name="uq_cost_centre_client_name"),
        Index("ix_cost_centres_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    parent_cost_centre_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    category: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
