"""Pydantic schemas for the invoice upload API."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.core.config import get_settings
from app.models.invoice import InvoiceStatus

settings = get_settings()


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    original_filename: str
    file_extension: str
    content_type: str
    file_size_bytes: int
    page_count: int | None
    has_thumbnail: bool
    status: InvoiceStatus
    error_message: str | None
    uploaded_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if not self.has_thumbnail:
            return None
        return f"{settings.API_V1_PREFIX}/clients/{self.client_id}/invoices/{self.id}/thumbnail"

    @computed_field
    @property
    def file_url(self) -> str:
        return f"{settings.API_V1_PREFIX}/clients/{self.client_id}/invoices/{self.id}/file"


class InvoiceListResponse(BaseModel):
    items: list[InvoiceOut]
    total: int
    uploaded_count: int
    error_count: int
    total_size_bytes: int


class InvoiceStatsResponse(BaseModel):
    total: int
    uploaded_count: int
    error_count: int
    total_size_bytes: int
    total_pages: int
