"""ORM model for a client (company). Every other module's data — invoices,
masters, ledger memory, processed reports — is scoped to a client_id so one
person can run this application for many companies while keeping their data
completely separate.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClientStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


def _generate_id() -> str:
    return uuid.uuid4().hex


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_generate_id)

    company_name: Mapped[str] = mapped_column(String(256), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    financial_year: Mapped[str | None] = mapped_column(String(9), nullable=True)
    address: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(256), nullable=True)

    status: Mapped[ClientStatus] = mapped_column(
        Enum(ClientStatus, native_enum=False, length=16),
        default=ClientStatus.ACTIVE,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
