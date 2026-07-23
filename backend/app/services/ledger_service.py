"""Querying and editing ledgers already imported into a client's knowledge
base (as opposed to ledger_master_service, which handles the XML import
itself).
"""
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import LedgerNotFoundError
from app.models.ledger import CostCentre, Ledger, LedgerType


def list_ledgers(
    db: Session,
    client_id: str,
    search: str | None = None,
    ledger_type: LedgerType | None = None,
    skip: int = 0,
    limit: int = 200,
) -> tuple[list[Ledger], int]:
    query = select(Ledger).where(Ledger.client_id == client_id)
    count_query = select(func.count()).select_from(Ledger).where(Ledger.client_id == client_id)

    if ledger_type is not None:
        query = query.where(Ledger.ledger_type == ledger_type)
        count_query = count_query.where(Ledger.ledger_type == ledger_type)

    if search:
        like_pattern = f"%{search.strip()}%"
        search_filter = or_(Ledger.name.ilike(like_pattern), Ledger.parent_group_name.ilike(like_pattern))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = db.scalar(count_query) or 0
    items = list(db.scalars(query.order_by(Ledger.name.asc()).offset(skip).limit(limit)))
    return items, total


def get_ledger_or_404(db: Session, client_id: str, ledger_id: str) -> Ledger:
    ledger = db.get(Ledger, ledger_id)
    if ledger is None or ledger.client_id != client_id:
        raise LedgerNotFoundError(ledger_id)
    return ledger


def update_ledger(db: Session, ledger: Ledger, updates: dict) -> Ledger:
    """Applies a user correction to a ledger's knowledge-base fields. Once
    edited, future Tally re-imports will not overwrite these fields."""
    editable_fields = {"expense_category", "accounting_purpose", "suggested_keywords"}
    touched = False
    for field, value in updates.items():
        if field in editable_fields:
            setattr(ledger, field, value)
            touched = True
    if touched:
        ledger.is_manually_edited = True
    db.commit()
    db.refresh(ledger)
    return ledger


def list_cost_centres(db: Session, client_id: str) -> list[CostCentre]:
    return list(
        db.scalars(select(CostCentre).where(CostCentre.client_id == client_id).order_by(CostCentre.name.asc()))
    )
