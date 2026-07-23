"""Business logic for the invoice upload module.

Every function here is scoped to a single client_id, so one client's
invoices are never visible or reachable from another client's context —
including via a guessed invoice id, which is treated as not-found rather
than forbidden (the caller shouldn't be able to tell the invoice exists).

Keeps the API layer (app/api/v1/endpoints/invoices.py) thin: endpoints parse
the HTTP request, call into this module, and translate the result/exceptions
into responses.
"""
import logging
import uuid

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import InvoiceNotFoundError, UnsupportedFileTypeError
from app.models.invoice import Invoice, InvoiceStatus
from app.services import file_storage
from app.services.file_processing import extract_metadata

logger = logging.getLogger(__name__)


async def create_invoice_from_upload(
    db: Session, settings: Settings, client_id: str, upload_file: UploadFile
) -> Invoice:
    original_filename = upload_file.filename or "unnamed"
    extension = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""

    if extension not in settings.ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(extension, settings.ALLOWED_EXTENSIONS)

    invoice_id = uuid.uuid4().hex
    stored_filename = f"{invoice_id}.{extension}"

    file_storage.ensure_client_storage_dirs(settings, client_id)
    original_path = settings.client_originals_dir(client_id) / stored_filename
    file_size_bytes = await file_storage.save_upload_stream(
        upload_file, original_path, settings.max_upload_size_bytes
    )

    result = extract_metadata(original_path, extension, settings.THUMBNAIL_MAX_DIM)

    has_thumbnail = False
    if result.thumbnail_bytes is not None:
        thumbnail_path = settings.client_thumbnails_dir(client_id) / f"{invoice_id}.jpg"
        thumbnail_path.write_bytes(result.thumbnail_bytes)
        has_thumbnail = True

    invoice = Invoice(
        id=invoice_id,
        client_id=client_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_extension=extension,
        content_type=upload_file.content_type or "application/octet-stream",
        file_size_bytes=file_size_bytes,
        page_count=result.page_count,
        has_thumbnail=has_thumbnail,
        status=InvoiceStatus.UPLOADED if result.succeeded else InvoiceStatus.ERROR,
        error_message=result.error_message,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    logger.info("Uploaded invoice %s (%s, %s) for client %s", invoice.id, original_filename, invoice.status.value, client_id)
    return invoice


def get_invoice_or_404(db: Session, client_id: str, invoice_id: str) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None or invoice.client_id != client_id:
        raise InvoiceNotFoundError(invoice_id)
    return invoice


def list_invoices(
    db: Session, client_id: str, skip: int = 0, limit: int = 1000, status_filter: InvoiceStatus | None = None
) -> tuple[list[Invoice], int]:
    query = select(Invoice).where(Invoice.client_id == client_id)
    count_query = select(func.count()).select_from(Invoice).where(Invoice.client_id == client_id)
    if status_filter is not None:
        query = query.where(Invoice.status == status_filter)
        count_query = count_query.where(Invoice.status == status_filter)

    total = db.scalar(count_query) or 0
    items = list(
        db.scalars(query.order_by(Invoice.uploaded_at.desc()).offset(skip).limit(limit))
    )
    return items, total


def get_summary_counts(db: Session, client_id: str) -> dict:
    base = select(func.count()).select_from(Invoice).where(Invoice.client_id == client_id)
    total = db.scalar(base) or 0
    uploaded_count = db.scalar(base.where(Invoice.status == InvoiceStatus.UPLOADED)) or 0
    error_count = db.scalar(base.where(Invoice.status == InvoiceStatus.ERROR)) or 0
    total_size_bytes = (
        db.scalar(
            select(func.coalesce(func.sum(Invoice.file_size_bytes), 0)).where(Invoice.client_id == client_id)
        )
        or 0
    )
    total_pages = (
        db.scalar(select(func.coalesce(func.sum(Invoice.page_count), 0)).where(Invoice.client_id == client_id))
        or 0
    )
    return {
        "total": total,
        "uploaded_count": uploaded_count,
        "error_count": error_count,
        "total_size_bytes": total_size_bytes,
        "total_pages": total_pages,
    }


def delete_invoice(db: Session, settings: Settings, invoice: Invoice) -> None:
    file_storage.delete_file_if_exists(
        settings.client_originals_dir(invoice.client_id) / invoice.stored_filename
    )
    if invoice.has_thumbnail:
        file_storage.delete_file_if_exists(settings.client_thumbnails_dir(invoice.client_id) / f"{invoice.id}.jpg")
    db.delete(invoice)
    db.commit()


def reprocess_invoice(db: Session, settings: Settings, invoice: Invoice) -> Invoice:
    original_path = settings.client_originals_dir(invoice.client_id) / invoice.stored_filename
    if not original_path.exists():
        invoice.status = InvoiceStatus.ERROR
        invoice.error_message = "Original file is missing from storage; please delete and re-upload."
        db.commit()
        db.refresh(invoice)
        return invoice

    result = extract_metadata(original_path, invoice.file_extension, settings.THUMBNAIL_MAX_DIM)

    if result.thumbnail_bytes is not None:
        thumbnail_path = settings.client_thumbnails_dir(invoice.client_id) / f"{invoice.id}.jpg"
        thumbnail_path.write_bytes(result.thumbnail_bytes)
        invoice.has_thumbnail = True
    else:
        invoice.has_thumbnail = False

    invoice.page_count = result.page_count
    invoice.status = InvoiceStatus.UPLOADED if result.succeeded else InvoiceStatus.ERROR
    invoice.error_message = result.error_message
    db.commit()
    db.refresh(invoice)
    logger.info("Reprocessed invoice %s -> %s", invoice.id, invoice.status.value)
    return invoice
