"""Pydantic schemas for the Client (company) module."""
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.client import ClientStatus

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}-\d{2}$")


def _validate_gstin(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    value = value.strip().upper()
    if not GSTIN_PATTERN.match(value):
        raise ValueError("GSTIN must be a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).")
    return value


def _validate_pan(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    value = value.strip().upper()
    if not PAN_PATTERN.match(value):
        raise ValueError("PAN must be a valid 10-character PAN (e.g. ABCDE1234F).")
    return value


def _validate_financial_year(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    value = value.strip()
    if not FINANCIAL_YEAR_PATTERN.match(value):
        raise ValueError("Financial year must be in the format YYYY-YY (e.g. 2026-27).")
    return value


class ClientBase(BaseModel):
    company_name: str
    gstin: str | None = None
    pan: str | None = None
    financial_year: str | None = None
    address: str | None = None
    contact_person: str | None = None

    _validate_gstin = field_validator("gstin")(_validate_gstin)
    _validate_pan = field_validator("pan")(_validate_pan)
    _validate_financial_year = field_validator("financial_year")(_validate_financial_year)

    @field_validator("company_name")
    @classmethod
    def _validate_company_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Company name is required.")
        return value


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    company_name: str | None = None
    gstin: str | None = None
    pan: str | None = None
    financial_year: str | None = None
    address: str | None = None
    contact_person: str | None = None

    _validate_gstin = field_validator("gstin")(_validate_gstin)
    _validate_pan = field_validator("pan")(_validate_pan)
    _validate_financial_year = field_validator("financial_year")(_validate_financial_year)

    @field_validator("company_name")
    @classmethod
    def _validate_company_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Company name cannot be empty.")
        return value


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: ClientStatus
    created_at: datetime
    updated_at: datetime


class ClientWithStatsOut(ClientOut):
    invoice_count: int = 0
    total_size_bytes: int = 0


class ClientListResponse(BaseModel):
    items: list[ClientWithStatsOut]
    total: int
