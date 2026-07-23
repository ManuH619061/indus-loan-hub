"""Invoice Upload module endpoints, scoped to a single client.

Scope: accept invoice files (PDF/JPG/JPEG/PNG), validate + store them,
extract page count and a preview thumbnail, and let the client list/delete/
retry them before the (future) processing pipeline runs. No OCR or
accounting logic lives here.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_db
from app.core.config import Settings
from app.models.invoice import InvoiceStatus
from app.schemas.invoice import InvoiceListResponse, InvoiceOut, InvoiceStatsResponse
from app.services import client_service, invoice_service

router = APIRouter(prefix="/clients/{client_id}/invoices", tags=["invoices"])


@router.post("/upload", response_model=InvoiceOut, status_code=201)
async def upload_invoice(
    client_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> InvoiceOut:
    client_service.get_client_or_404(db, client_id)
    invoice = await invoice_service.create_invoice_from_upload(db, settings, client_id, file)
    return InvoiceOut.model_validate(invoice)


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    client_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> InvoiceListResponse:
    client_service.get_client_or_404(db, client_id)
    items, total = invoice_service.list_invoices(db, client_id, skip=skip, limit=limit, status_filter=status_filter)
    summary = invoice_service.get_summary_counts(db, client_id)
    return InvoiceListResponse(
        items=[InvoiceOut.model_validate(i) for i in items],
        total=total,
        uploaded_count=summary["uploaded_count"],
        error_count=summary["error_count"],
        total_size_bytes=summary["total_size_bytes"],
    )


@router.get("/stats", response_model=InvoiceStatsResponse)
def get_stats(client_id: str, db: Session = Depends(get_db)) -> InvoiceStatsResponse:
    client_service.get_client_or_404(db, client_id)
    return InvoiceStatsResponse(**invoice_service.get_summary_counts(db, client_id))


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(client_id: str, invoice_id: str, db: Session = Depends(get_db)) -> InvoiceOut:
    invoice = invoice_service.get_invoice_or_404(db, client_id, invoice_id)
    return InvoiceOut.model_validate(invoice)


@router.get("/{invoice_id}/thumbnail")
def get_invoice_thumbnail(
    client_id: str, invoice_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> FileResponse:
    invoice = invoice_service.get_invoice_or_404(db, client_id, invoice_id)
    if not invoice.has_thumbnail:
        raise HTTPException(status_code=404, detail="No thumbnail available for this invoice.")
    thumbnail_path = settings.client_thumbnails_dir(client_id) / f"{invoice.id}.jpg"
    return FileResponse(thumbnail_path, media_type="image/jpeg")


@router.get("/{invoice_id}/file")
def get_invoice_file(
    client_id: str, invoice_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> FileResponse:
    invoice = invoice_service.get_invoice_or_404(db, client_id, invoice_id)
    original_path = settings.client_originals_dir(client_id) / invoice.stored_filename
    return FileResponse(
        original_path, media_type=invoice.content_type, filename=invoice.original_filename
    )


@router.post("/{invoice_id}/reprocess", response_model=InvoiceOut)
def reprocess_invoice(
    client_id: str, invoice_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> InvoiceOut:
    invoice = invoice_service.get_invoice_or_404(db, client_id, invoice_id)
    invoice = invoice_service.reprocess_invoice(db, settings, invoice)
    return InvoiceOut.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    client_id: str, invoice_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> None:
    invoice = invoice_service.get_invoice_or_404(db, client_id, invoice_id)
    invoice_service.delete_invoice(db, settings, invoice)
