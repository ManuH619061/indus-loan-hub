"""Business logic for the Client (company) module."""
import logging

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import ClientNotFoundError
from app.models.client import Client, ClientStatus
from app.models.invoice import Invoice
from app.schemas.client import ClientCreate, ClientUpdate
from app.services import file_storage

logger = logging.getLogger(__name__)


def create_client(db: Session, settings: Settings, payload: ClientCreate) -> Client:
    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    file_storage.ensure_client_storage_dirs(settings, client.id)
    logger.info("Created client %s (%s)", client.id, client.company_name)
    return client


def get_client_or_404(db: Session, client_id: str) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise ClientNotFoundError(client_id)
    return client


def list_clients(
    db: Session,
    search: str | None = None,
    status_filter: ClientStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[Client], int]:
    query = select(Client)
    count_query = select(func.count()).select_from(Client)

    if status_filter is not None:
        query = query.where(Client.status == status_filter)
        count_query = count_query.where(Client.status == status_filter)

    if search:
        like_pattern = f"%{search.strip()}%"
        search_filter = or_(
            Client.company_name.ilike(like_pattern),
            Client.gstin.ilike(like_pattern),
            Client.pan.ilike(like_pattern),
            Client.contact_person.ilike(like_pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = db.scalar(count_query) or 0
    items = list(db.scalars(query.order_by(Client.company_name.asc()).offset(skip).limit(limit)))
    return items, total


def update_client(db: Session, client: Client, payload: ClientUpdate) -> Client:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


def set_client_status(db: Session, client: Client, status: ClientStatus) -> Client:
    client.status = status
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, settings: Settings, client: Client) -> None:
    # Explicit cleanup (rather than relying only on DB-level FK cascade) so
    # invoice files on disk are removed too, and behaviour stays identical
    # after a future move to PostgreSQL.
    db.query(Invoice).filter(Invoice.client_id == client.id).delete(synchronize_session=False)
    db.delete(client)
    db.commit()
    file_storage.delete_client_storage_dir(settings, client.id)
    logger.info("Deleted client %s (%s)", client.id, client.company_name)


def get_client_invoice_summary(db: Session, client_id: str) -> dict:
    total = db.scalar(select(func.count()).select_from(Invoice).where(Invoice.client_id == client_id)) or 0
    total_size_bytes = (
        db.scalar(
            select(func.coalesce(func.sum(Invoice.file_size_bytes), 0)).where(Invoice.client_id == client_id)
        )
        or 0
    )
    return {"invoice_count": total, "total_size_bytes": total_size_bytes}


def get_invoice_summaries(db: Session, client_ids: list[str]) -> dict[str, dict]:
    """One aggregate query for invoice counts/sizes across many clients, so
    listing 100+ clients doesn't cost 100+ round trips."""
    if not client_ids:
        return {}
    rows = db.execute(
        select(
            Invoice.client_id,
            func.count().label("invoice_count"),
            func.coalesce(func.sum(Invoice.file_size_bytes), 0).label("total_size_bytes"),
        )
        .where(Invoice.client_id.in_(client_ids))
        .group_by(Invoice.client_id)
    ).all()
    return {row.client_id: {"invoice_count": row.invoice_count, "total_size_bytes": row.total_size_bytes} for row in rows}
