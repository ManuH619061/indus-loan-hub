"""Classifies a parsed Tally ledger using its actual parent-group chain
(the authoritative signal) plus the keyword seed library (a best-effort,
always-editable enrichment) — never keyword-guessing alone.
"""
from dataclasses import dataclass

from app.models.ledger import CapitalOrRevenue, ItcEligibility, LedgerNature, LedgerType
from app.services.ledger_taxonomy import (
    GST_COMPONENT_PATTERNS,
    TALLY_STANDARD_GROUPS,
    is_blocked_credit_candidate,
    match_keyword_library,
)
from app.services.tally_xml_parser import ParsedGroup, ParsedLedger

_MAX_CHAIN_DEPTH = 25


@dataclass
class GroupResolution:
    nature: LedgerNature
    base_type: LedgerType
    capital_or_revenue: CapitalOrRevenue
    is_standard_root: bool
    chain: list[str]


def resolve_group_chain(parent_name: str | None, groups_by_name: dict[str, ParsedGroup]) -> GroupResolution:
    """Walks PARENT references up from `parent_name` until hitting one of
    Tally's reserved standard groups (or running out of chain / hitting a
    cycle), returning the resolved nature/type for that root."""
    chain: list[str] = []
    seen: set[str] = set()
    current = parent_name

    while current and current not in seen and len(chain) < _MAX_CHAIN_DEPTH:
        seen.add(current)
        chain.append(current)

        standard = TALLY_STANDARD_GROUPS.get(current.strip().lower())
        if standard:
            return GroupResolution(
                nature=standard["nature"],
                base_type=standard["type"],
                capital_or_revenue=standard["cap_rev"],
                is_standard_root=True,
                chain=chain,
            )

        group = groups_by_name.get(current)
        current = group.parent_name if group else None

    return GroupResolution(
        nature=LedgerNature.UNKNOWN,
        base_type=LedgerType.OTHER,
        capital_or_revenue=CapitalOrRevenue.NOT_APPLICABLE,
        is_standard_root=False,
        chain=chain,
    )


def _detect_gst_component(ledger_name: str) -> str | None:
    lowered = ledger_name.lower()
    for pattern, component in GST_COMPONENT_PATTERNS:
        if pattern in lowered:
            return component
    return None


def classify_ledger(ledger: ParsedLedger, resolution: GroupResolution) -> dict:
    """Returns the full set of enrichment fields to store on the Ledger row."""
    chain_has_duties_and_taxes = any(name.strip().lower() == "duties & taxes" for name in resolution.chain)

    ledger_type = resolution.base_type
    is_gst_ledger = False
    gst_component = None
    is_tds_ledger = False

    if chain_has_duties_and_taxes:
        lowered = ledger.name.lower()
        if "tds" in lowered or "tax deducted" in lowered:
            is_tds_ledger = True
            ledger_type = LedgerType.TDS_DUTY
        elif "tcs" in lowered:
            ledger_type = LedgerType.OTHER
        else:
            component = _detect_gst_component(ledger.name)
            if component:
                is_gst_ledger = True
                gst_component = component
                ledger_type = LedgerType.GST_DUTY

    keyword_entry = match_keyword_library(ledger.name)
    expense_category = None
    accounting_purpose = None
    suggested_keywords = None
    gst_itc_eligibility = ItcEligibility.NOT_APPLICABLE

    if resolution.nature == LedgerNature.EXPENSE:
        ledger_type = ledger_type if ledger_type != LedgerType.OTHER else LedgerType.EXPENSE
        if keyword_entry:
            expense_category = keyword_entry["category"]
            accounting_purpose = keyword_entry["purpose"]
            suggested_keywords = keyword_entry["keywords"]
        if is_blocked_credit_candidate(ledger.name):
            gst_itc_eligibility = ItcEligibility.REVIEW
        else:
            gst_itc_eligibility = ItcEligibility.ELIGIBLE
    elif resolution.nature == LedgerNature.INCOME and ledger_type == LedgerType.OTHER:
        ledger_type = LedgerType.INCOME
    elif resolution.nature == LedgerNature.ASSET and ledger_type == LedgerType.OTHER:
        ledger_type = LedgerType.ASSET
    elif resolution.nature == LedgerNature.LIABILITY and ledger_type == LedgerType.OTHER:
        ledger_type = LedgerType.LIABILITY

    return {
        "nature": resolution.nature,
        "ledger_type": ledger_type,
        "capital_or_revenue": resolution.capital_or_revenue,
        "is_gst_ledger": is_gst_ledger,
        "gst_component": gst_component,
        "is_tds_ledger": is_tds_ledger,
        "gst_itc_eligibility": gst_itc_eligibility,
        "expense_category": expense_category,
        "accounting_purpose": accounting_purpose,
        "suggested_keywords": suggested_keywords,
    }
