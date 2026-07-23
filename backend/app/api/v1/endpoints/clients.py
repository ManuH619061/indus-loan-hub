"""Client (company) module endpoints.

This is the entry point of the application: the desktop user works with
many client companies but is the sole user, so there is no auth — just a
list of clients to create, open, edit, archive, or delete.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_db
from app.core.config import Settings
from app.models.client import ClientStatus
from app.schemas.client import ClientCreate, ClientListResponse, ClientOut, ClientUpdate, ClientWithStatsOut
from app.services import client_service

router = APIRouter(prefix="/clients", tags=["clients"])


def _to_stats_out(client, summaries: dict) -> ClientWithStatsOut:
    summary = summaries.get(client.id, {"invoice_count": 0, "total_size_bytes": 0})
    return ClientWithStatsOut.model_validate({**ClientOut.model_validate(client).model_dump(), **summary})


@router.post("", response_model=ClientOut, status_code=201)
def create_client(
    payload: ClientCreate, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> ClientOut:
    client = client_service.create_client(db, settings, payload)
    return ClientOut.model_validate(client)


@router.get("", response_model=ClientListResponse)
def list_clients(
    search: str | None = Query(None),
    status_filter: ClientStatus | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> ClientListResponse:
    clients, total = client_service.list_clients(db, search=search, status_filter=status_filter, skip=skip, limit=limit)
    summaries = client_service.get_invoice_summaries(db, [c.id for c in clients])
    return ClientListResponse(items=[_to_stats_out(c, summaries) for c in clients], total=total)


@router.get("/{client_id}", response_model=ClientWithStatsOut)
def get_client(client_id: str, db: Session = Depends(get_db)) -> ClientWithStatsOut:
    client = client_service.get_client_or_404(db, client_id)
    summaries = client_service.get_invoice_summaries(db, [client_id])
    return _to_stats_out(client, summaries)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: str, payload: ClientUpdate, db: Session = Depends(get_db)) -> ClientOut:
    client = client_service.get_client_or_404(db, client_id)
    client = client_service.update_client(db, client, payload)
    return ClientOut.model_validate(client)


@router.post("/{client_id}/archive", response_model=ClientOut)
def archive_client(client_id: str, db: Session = Depends(get_db)) -> ClientOut:
    client = client_service.get_client_or_404(db, client_id)
    client = client_service.set_client_status(db, client, ClientStatus.ARCHIVED)
    return ClientOut.model_validate(client)


@router.post("/{client_id}/unarchive", response_model=ClientOut)
def unarchive_client(client_id: str, db: Session = Depends(get_db)) -> ClientOut:
    client = client_service.get_client_or_404(db, client_id)
    client = client_service.set_client_status(db, client, ClientStatus.ACTIVE)
    return ClientOut.model_validate(client)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_app_settings)
) -> None:
    client = client_service.get_client_or_404(db, client_id)
    client_service.delete_client(db, settings, client)
