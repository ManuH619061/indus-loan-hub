"""Orchestrates a Tally Masters XML import: parse -> classify -> upsert,
all scoped to one client. Re-importing is idempotent and safe to run
repeatedly (e.g. after every Tally backup) — it updates structural fields
from Tally but never overwrites a ledger's manually-edited knowledge-base
fields.
"""
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.ledger import CostCentre, Ledger, LedgerGroup, LedgerMasterImport, LedgerType
from app.services.ledger_classification import classify_ledger, resolve_group_chain
from app.services.ledger_taxonomy import TALLY_STANDARD_GROUPS
from app.services.tally_xml_parser import ParsedTallyMaster, TallyXmlParseError, parse_tally_master_xml

logger = logging.getLogger(__name__)

MAX_XML_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB — generous for a masters export


def import_tally_master(db: Session, client: Client, filename: str, raw: bytes) -> LedgerMasterImport:
    if len(raw) > MAX_XML_SIZE_BYTES:
        raise TallyXmlParseError(f"File exceeds the {MAX_XML_SIZE_BYTES // (1024 * 1024)} MB import limit.")

    parsed = parse_tally_master_xml(raw)
    _upsert_groups(db, client.id, parsed)
    _upsert_ledgers(db, client.id, parsed)
    _upsert_cost_centres(db, client.id, parsed)

    import_record = LedgerMasterImport(
        client_id=client.id,
        filename=filename,
        group_count=len(parsed.groups),
        ledger_count=len(parsed.ledgers),
        cost_centre_count=len(parsed.cost_centres),
        warnings=parsed.warnings or None,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    logger.info(
        "Imported Tally master for client %s: %d groups, %d ledgers, %d cost centres",
        client.id,
        len(parsed.groups),
        len(parsed.ledgers),
        len(parsed.cost_centres),
    )
    return import_record


def _upsert_groups(db: Session, client_id: str, parsed: ParsedTallyMaster) -> None:
    existing = {g.name: g for g in db.scalars(select(LedgerGroup).where(LedgerGroup.client_id == client_id))}
    groups_by_name = {g.name: g for g in parsed.groups}

    for parsed_group in parsed.groups:
        resolution = resolve_group_chain(parsed_group.parent_name, groups_by_name)
        row = existing.get(parsed_group.name)
        if row is None:
            row = LedgerGroup(client_id=client_id, name=parsed_group.name)
            db.add(row)
        row.parent_group_name = parsed_group.parent_name
        row.resolved_nature = resolution.nature
        row.is_standard = parsed_group.parent_name is not None and (
            parsed_group.parent_name.strip().lower() in TALLY_STANDARD_GROUPS
        )
    db.commit()


def _upsert_ledgers(db: Session, client_id: str, parsed: ParsedTallyMaster) -> None:
    existing = {le.name: le for le in db.scalars(select(Ledger).where(Ledger.client_id == client_id))}
    groups_by_name = {g.name: g for g in parsed.groups}

    for parsed_ledger in parsed.ledgers:
        resolution = resolve_group_chain(parsed_ledger.parent_name, groups_by_name)
        classification = classify_ledger(parsed_ledger, resolution)

        row = existing.get(parsed_ledger.name)
        if row is None:
            row = Ledger(client_id=client_id, name=parsed_ledger.name)
            db.add(row)

        row.parent_group_name = parsed_ledger.parent_name
        row.gstin = parsed_ledger.gstin
        row.pan = parsed_ledger.pan
        row.opening_balance = parsed_ledger.opening_balance
        row.raw_fields = parsed_ledger.raw_fields or None
        row.nature = classification["nature"]
        row.ledger_type = classification["ledger_type"]
        row.capital_or_revenue = classification["capital_or_revenue"]
        row.is_gst_ledger = classification["is_gst_ledger"]
        row.gst_component = classification["gst_component"]
        row.is_tds_ledger = classification["is_tds_ledger"]
        row.gst_itc_eligibility = classification["gst_itc_eligibility"]

        if not row.is_manually_edited:
            row.expense_category = classification["expense_category"]
            row.accounting_purpose = classification["accounting_purpose"]
            row.suggested_keywords = classification["suggested_keywords"]
    db.commit()


def _upsert_cost_centres(db: Session, client_id: str, parsed: ParsedTallyMaster) -> None:
    existing = {cc.name: cc for cc in db.scalars(select(CostCentre).where(CostCentre.client_id == client_id))}
    for parsed_cc in parsed.cost_centres:
        row = existing.get(parsed_cc.name)
        if row is None:
            row = CostCentre(client_id=client_id, name=parsed_cc.name)
            db.add(row)
        row.parent_cost_centre_name = parsed_cc.parent_name
        row.category = parsed_cc.category
    db.commit()


def get_summary(db: Session, client_id: str) -> dict:
    def count(ledger_type: LedgerType) -> int:
        return (
            db.scalar(
                select(func.count())
                .select_from(Ledger)
                .where(Ledger.client_id == client_id, Ledger.ledger_type == ledger_type)
            )
            or 0
        )

    total_ledgers = db.scalar(select(func.count()).select_from(Ledger).where(Ledger.client_id == client_id)) or 0
    total_groups = db.scalar(select(func.count()).select_from(LedgerGroup).where(LedgerGroup.client_id == client_id)) or 0
    total_cost_centres = (
        db.scalar(select(func.count()).select_from(CostCentre).where(CostCentre.client_id == client_id)) or 0
    )
    last_import = db.scalar(
        select(LedgerMasterImport)
        .where(LedgerMasterImport.client_id == client_id)
        .order_by(LedgerMasterImport.imported_at.desc())
        .limit(1)
    )

    return {
        "total_ledgers": total_ledgers,
        "total_groups": total_groups,
        "total_cost_centres": total_cost_centres,
        "vendor_count": count(LedgerType.VENDOR),
        "customer_count": count(LedgerType.CUSTOMER),
        "bank_count": count(LedgerType.BANK),
        "cash_count": count(LedgerType.CASH),
        "gst_ledger_count": count(LedgerType.GST_DUTY),
        "tds_ledger_count": count(LedgerType.TDS_DUTY),
        "expense_ledger_count": count(LedgerType.EXPENSE),
        "income_ledger_count": count(LedgerType.INCOME),
        "asset_ledger_count": count(LedgerType.ASSET),
        "liability_ledger_count": count(LedgerType.LIABILITY),
        "last_import": last_import,
    }
