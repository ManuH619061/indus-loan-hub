"""ORM model for an uploaded invoice file.

This module intentionally only carries the fields needed by the Upload
module (Module 1). Extraction fields (vendor, GSTIN, tax amounts, ledger
suggestions, etc.) belong to later modules and will be added as new nullable
columns / related tables when those modules are built, so this table is not
pre-built with speculative columns.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InvoiceStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    ERROR = "error"


def _generate_id() -> str:
    return uuid.uuid4().hex


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (Index("ix_invoices_client_id", "client_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    file_extension: Mapped[str] = mapped_column(String(8), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_thumbnail: Mapped[bool] = mapped_column(default=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, native_enum=False, length=16),
        default=InvoiceStatus.UPLOADED,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(String(512), nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
