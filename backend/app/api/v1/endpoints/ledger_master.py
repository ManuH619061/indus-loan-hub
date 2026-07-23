"""Ledger Master module endpoints: Tally XML import and the resulting
per-client ledger knowledge base.
"""
from fastapi import APIRouter, Depends, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.ledger import LedgerType
from app.schemas.ledger import (
    CostCentreOut,
    LedgerListResponse,
    LedgerMasterImportOut,
    LedgerMasterSummaryResponse,
    LedgerOut,
    LedgerUpdate,
)
from app.services import client_service, ledger_master_service, ledger_service

router = APIRouter(prefix="/clients/{client_id}/ledger-master", tags=["ledger-master"])


@router.post("/import", response_model=LedgerMasterImportOut, status_code=201)
async def import_tally_master(client_id: str, file: UploadFile, db: Session = Depends(get_db)) -> LedgerMasterImportOut:
    client = client_service.get_client_or_404(db, client_id)
    raw = await file.read()
    import_record = ledger_master_service.import_tally_master(db, client, file.filename or "import.xml", raw)
    return LedgerMasterImportOut.model_validate(import_record)


@router.get("/summary", response_model=LedgerMasterSummaryResponse)
def get_summary(client_id: str, db: Session = Depends(get_db)) -> LedgerMasterSummaryResponse:
    client_service.get_client_or_404(db, client_id)
    return LedgerMasterSummaryResponse(**ledger_master_service.get_summary(db, client_id))


@router.get("/ledgers", response_model=LedgerListResponse)
def list_ledgers(
    client_id: str,
    search: str | None = Query(None),
    ledger_type: LedgerType | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> LedgerListResponse:
    client_service.get_client_or_404(db, client_id)
    items, total = ledger_service.list_ledgers(
        db, client_id, search=search, ledger_type=ledger_type, skip=skip, limit=limit
    )
    return LedgerListResponse(items=[LedgerOut.model_validate(i) for i in items], total=total)


@router.get("/ledgers/{ledger_id}", response_model=LedgerOut)
def get_ledger(client_id: str, ledger_id: str, db: Session = Depends(get_db)) -> LedgerOut:
    ledger = ledger_service.get_ledger_or_404(db, client_id, ledger_id)
    return LedgerOut.model_validate(ledger)


@router.patch("/ledgers/{ledger_id}", response_model=LedgerOut)
def update_ledger(client_id: str, ledger_id: str, payload: LedgerUpdate, db: Session = Depends(get_db)) -> LedgerOut:
    ledger = ledger_service.get_ledger_or_404(db, client_id, ledger_id)
    ledger = ledger_service.update_ledger(db, ledger, payload.model_dump(exclude_unset=True))
    return LedgerOut.model_validate(ledger)


@router.get("/cost-centres", response_model=list[CostCentreOut])
def list_cost_centres(client_id: str, db: Session = Depends(get_db)) -> list[CostCentreOut]:
    client_service.get_client_or_404(db, client_id)
    return [CostCentreOut.model_validate(cc) for cc in ledger_service.list_cost_centres(db, client_id)]
