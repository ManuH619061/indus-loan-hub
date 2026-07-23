"""Parses a Tally "Masters" XML export into groups, ledgers, and cost
centres.

Tally's export structure varies across versions (nesting under
ENVELOPE/BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE, or a flatter structure
depending on the export report used), so rather than assuming one exact
shape, this walks the whole tree with `.iter()` looking for <GROUP>,
<LEDGER>, and <COSTCENTRE> elements wherever they appear.
"""
import re
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

# Common tag-name variants Tally has used for the same concept across
# versions/localisations.
_GSTIN_TAGS = {"partygstin", "gstin", "gstregistrationnumber", "gstinuin"}
_PAN_TAGS = {"incometaxnumber", "pan", "pannumber"}


class TallyXmlParseError(Exception):
    pass


@dataclass
class ParsedGroup:
    name: str
    parent_name: str | None


@dataclass
class ParsedLedger:
    name: str
    parent_name: str | None
    gstin: str | None
    pan: str | None
    opening_balance: str | None
    raw_fields: dict[str, str] = field(default_factory=dict)


@dataclass
class ParsedCostCentre:
    name: str
    parent_name: str | None
    category: str | None


@dataclass
class ParsedTallyMaster:
    groups: list[ParsedGroup]
    ledgers: list[ParsedLedger]
    cost_centres: list[ParsedCostCentre]
    warnings: list[str]


def _decode_xml_bytes(raw: bytes) -> str:
    for encoding in ("utf-8", "windows-1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", errors="replace")
    # Tally exports occasionally contain stray control characters that are
    # not valid XML and make ElementTree choke; strip them rather than fail.
    return _CONTROL_CHARS_RE.sub("", text)


def _element_name(element: ET.Element) -> str | None:
    name = element.get("NAME") or element.get("Name")
    if name:
        return name.strip()
    name_child = element.find("NAME")
    if name_child is not None and name_child.text:
        return name_child.text.strip()
    return None


def _child_text(element: ET.Element, tag: str) -> str | None:
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return None


def _local_tag(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def parse_tally_master_xml(raw: bytes) -> ParsedTallyMaster:
    text = _decode_xml_bytes(raw)
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise TallyXmlParseError(f"Could not parse this file as Tally XML: {exc}") from exc

    groups: dict[str, ParsedGroup] = {}
    ledgers: dict[str, ParsedLedger] = {}
    cost_centres: dict[str, ParsedCostCentre] = {}
    warnings: list[str] = []

    for element in root.iter():
        tag = _local_tag(element.tag).upper()

        if tag == "GROUP":
            name = _element_name(element)
            if not name:
                warnings.append("Found a <GROUP> element with no NAME; skipped.")
                continue
            parent = _child_text(element, "PARENT")
            groups[name] = ParsedGroup(name=name, parent_name=parent)

        elif tag == "LEDGER":
            name = _element_name(element)
            if not name:
                warnings.append("Found a <LEDGER> element with no NAME; skipped.")
                continue
            parent = _child_text(element, "PARENT")

            raw_fields: dict[str, str] = {}
            gstin = None
            pan = None
            opening_balance = _child_text(element, "OPENINGBALANCE")
            for child in element:
                child_tag = _local_tag(child.tag)
                if child_tag in ("PARENT",) or not child.text or not child.text.strip():
                    continue
                value = child.text.strip()
                raw_fields[child_tag] = value
                if child_tag.lower() in _GSTIN_TAGS and not gstin:
                    gstin = value
                if child_tag.lower() in _PAN_TAGS and not pan:
                    pan = value

            ledgers[name] = ParsedLedger(
                name=name,
                parent_name=parent,
                gstin=gstin,
                pan=pan,
                opening_balance=opening_balance,
                raw_fields=raw_fields,
            )

        elif tag == "COSTCENTRE":
            name = _element_name(element)
            if not name:
                warnings.append("Found a <COSTCENTRE> element with no NAME; skipped.")
                continue
            parent = _child_text(element, "PARENT")
            category = _child_text(element, "CATEGORY")
            cost_centres[name] = ParsedCostCentre(name=name, parent_name=parent, category=category)

    if not groups and not ledgers and not cost_centres:
        raise TallyXmlParseError(
            "No <GROUP>, <LEDGER>, or <COSTCENTRE> elements were found. "
            "Export a 'Masters' XML from Tally (Gateway of Tally > Display > List of Accounts, "
            "or Chart of Accounts), not a day book / voucher export."
        )

    return ParsedTallyMaster(
        groups=list(groups.values()),
        ledgers=list(ledgers.values()),
        cost_centres=list(cost_centres.values()),
        warnings=warnings,
    )
