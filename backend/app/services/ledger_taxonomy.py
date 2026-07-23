"""Tally's standard chart-of-accounts taxonomy, plus a curated starter
keyword/purpose library for common Indian accounting ledger names.

This is deliberately NOT keyword-guessing in isolation: ledger *nature*
(asset/liability/income/expense) is resolved by walking the ledger's actual
parent-group chain up to one of Tally's ~20 built-in reserved groups, which
is the authoritative signal Tally itself uses — every ledger in a valid
Tally company ultimately rolls up to one of these. Keyword/purpose hints are
a separate, best-effort seed for common ledger names, always user-editable,
and never presented as more certain than they are.
"""
import re

from app.models.ledger import CapitalOrRevenue, ItcEligibility, LedgerNature, LedgerType

# Tally's reserved primary/sub groups -> (nature, ledger_type, capital_or_revenue).
# Names are exactly as Tally ships them (case-insensitive match on import).
TALLY_STANDARD_GROUPS: dict[str, dict] = {
    "capital account": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "reserves & surplus": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "loans (liability)": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "secured loans": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "unsecured loans": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "current liabilities": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "sundry creditors": {"nature": LedgerNature.LIABILITY, "type": LedgerType.VENDOR, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "duties & taxes": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "provisions": {"nature": LedgerNature.LIABILITY, "type": LedgerType.LIABILITY, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "fixed assets": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.CAPITAL},
    "investments": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.CAPITAL},
    "current assets": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "sundry debtors": {"nature": LedgerNature.ASSET, "type": LedgerType.CUSTOMER, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "bank accounts": {"nature": LedgerNature.ASSET, "type": LedgerType.BANK, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "bank occ a/c": {"nature": LedgerNature.ASSET, "type": LedgerType.BANK, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "bank od a/c": {"nature": LedgerNature.LIABILITY, "type": LedgerType.BANK, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "cash-in-hand": {"nature": LedgerNature.ASSET, "type": LedgerType.CASH, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "deposits (asset)": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "loans & advances (asset)": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "stock-in-hand": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "misc. expenses (asset)": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "suspense a/c": {"nature": LedgerNature.ASSET, "type": LedgerType.ASSET, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "branch / divisions": {"nature": LedgerNature.ASSET, "type": LedgerType.OTHER, "cap_rev": CapitalOrRevenue.NOT_APPLICABLE},
    "sales accounts": {"nature": LedgerNature.INCOME, "type": LedgerType.INCOME, "cap_rev": CapitalOrRevenue.REVENUE},
    "purchase accounts": {"nature": LedgerNature.EXPENSE, "type": LedgerType.EXPENSE, "cap_rev": CapitalOrRevenue.REVENUE},
    "direct incomes": {"nature": LedgerNature.INCOME, "type": LedgerType.INCOME, "cap_rev": CapitalOrRevenue.REVENUE},
    "indirect incomes": {"nature": LedgerNature.INCOME, "type": LedgerType.INCOME, "cap_rev": CapitalOrRevenue.REVENUE},
    "direct expenses": {"nature": LedgerNature.EXPENSE, "type": LedgerType.EXPENSE, "cap_rev": CapitalOrRevenue.REVENUE},
    "indirect expenses": {"nature": LedgerNature.EXPENSE, "type": LedgerType.EXPENSE, "cap_rev": CapitalOrRevenue.REVENUE},
}

# GST duty ledger name patterns (checked only when the ledger's parent chain
# resolves to "Duties & Taxes" — the group placement is the authoritative
# signal; the name pattern just identifies which GST component it is).
GST_COMPONENT_PATTERNS: list[tuple[str, str]] = [
    ("igst", "IGST"),
    ("cgst", "CGST"),
    ("sgst", "SGST"),
    ("utgst", "UTGST"),
    ("cess", "CESS"),
    ("gst", "GST"),  # fallback if no specific component matched
]

# Section 17(5) CGST Act blocked-credit categories — flagged for review
# rather than asserted outright, since eligibility often depends on the
# specific use case (e.g. motor vehicles used for further supply ARE
# eligible). This is a starting point for the accountant's own judgement.
BLOCKED_CREDIT_KEYWORDS = [
    "motor vehicle", "motor car", "car repair", "car insurance", "car hire",
    "rent-a-cab", "rent a cab", "cab hire",
    "food and beverage", "food & beverage", "catering", "outdoor catering",
    "health insurance", "life insurance", "medical insurance",
    "club membership", "club fees",
    "employee welfare", "staff welfare",
    "gift", "free sample",
    "personal", "leave travel allowance", "lta",
]

# Curated seed library: substrings matched against the ledger name
# (case-insensitive) -> (expense_category, keywords, purpose). The FIRST
# matching entry wins; order matters, more specific patterns are listed
# before generic ones. This never claims certainty beyond "a starting
# point" — every field it produces is editable in the UI.
LEDGER_KEYWORD_LIBRARY: list[tuple[str, dict]] = [
    ("professional", {
        "category": "Professional Service",
        "keywords": ["consultancy", "ca fees", "chartered accountant", "advocate", "legal fees",
                     "audit fees", "software consulting", "professional fees", "retainer"],
        "purpose": "Fees paid to professionals — consultants, CAs, advocates, auditors — for advisory or compliance services.",
    }),
    ("legal", {
        "category": "Legal Fees",
        "keywords": ["advocate", "lawyer", "legal fees", "litigation", "court fees", "notary"],
        "purpose": "Legal fees paid to advocates or law firms.",
    }),
    ("consult", {
        "category": "Consultancy",
        "keywords": ["consultancy", "consulting", "advisory", "retainer"],
        "purpose": "Consultancy or advisory service charges.",
    }),
    ("audit", {
        "category": "Professional Service",
        "keywords": ["audit fees", "statutory audit", "tax audit", "internal audit"],
        "purpose": "Audit fees paid to chartered accountants / audit firms.",
    }),
    ("freight", {
        "category": "Freight",
        "keywords": ["transport", "logistics", "courier", "freight", "loading", "unloading", "cartage", "lorry"],
        "purpose": "Freight, transport, or logistics charges for movement of goods.",
    }),
    ("transport", {
        "category": "Freight",
        "keywords": ["transport", "logistics", "courier", "freight", "loading", "unloading", "cartage"],
        "purpose": "Transport / logistics charges.",
    }),
    ("courier", {
        "category": "Freight",
        "keywords": ["courier", "parcel", "speed post", "shipment"],
        "purpose": "Courier and parcel delivery charges.",
    }),
    ("rent", {
        "category": "Rent",
        "keywords": ["office rent", "premises rent", "godown rent", "warehouse rent", "lease rent"],
        "purpose": "Rent paid for office, godown, or other premises.",
    }),
    ("hotel", {
        "category": "Hotel",
        "keywords": ["hotel", "lodging", "accommodation", "guest house", "stay"],
        "purpose": "Hotel and lodging expenses, typically for business travel.",
    }),
    ("travel", {
        "category": "Travel",
        "keywords": ["air ticket", "flight", "railway", "cab fare", "taxi", "conveyance", "travel"],
        "purpose": "Business travel expenses — flights, rail, cabs, conveyance.",
    }),
    ("conveyance", {
        "category": "Travel",
        "keywords": ["cab fare", "taxi", "auto fare", "local conveyance", "fuel"],
        "purpose": "Local conveyance and travel within the city.",
    }),
    ("repair", {
        "category": "Repairs",
        "keywords": ["repair", "maintenance", "amc", "servicing", "spare parts"],
        "purpose": "Repairs and maintenance of assets, equipment, or premises.",
    }),
    ("maintenance", {
        "category": "Repairs",
        "keywords": ["repair", "maintenance", "amc", "servicing"],
        "purpose": "Repairs and maintenance charges, including AMC contracts.",
    }),
    ("stationery", {
        "category": "Stationery",
        "keywords": ["stationery", "printing", "office supplies", "files", "pens", "photocopy", "paper", "toner"],
        "purpose": "Stationery, printing, and general office supplies.",
    }),
    ("printing", {
        "category": "Stationery",
        "keywords": ["printing", "stationery", "photocopy", "toner", "cartridge"],
        "purpose": "Printing and photocopying expenses.",
    }),
    ("office expense", {
        "category": "Office Expenses",
        "keywords": ["stationery", "printing", "office supplies", "files", "pens", "photocopy", "pantry", "housekeeping"],
        "purpose": "General office running expenses — stationery, supplies, pantry, housekeeping.",
    }),
    ("software", {
        "category": "Software",
        "keywords": ["software license", "saas", "subscription", "cloud", "hosting", "domain", "api"],
        "purpose": "Software licenses, SaaS tools, and related technology subscriptions.",
    }),
    ("subscription", {
        "category": "Subscription",
        "keywords": ["subscription", "membership", "annual fee", "renewal"],
        "purpose": "Recurring subscriptions or membership fees.",
    }),
    ("marketing", {
        "category": "Marketing",
        "keywords": ["advertisement", "marketing", "promotion", "social media", "campaign", "hoarding"],
        "purpose": "Marketing, advertising, and promotional expenses.",
    }),
    ("advertis", {
        "category": "Marketing",
        "keywords": ["advertisement", "marketing", "promotion", "campaign", "hoarding", "banner"],
        "purpose": "Advertising and promotional expenses.",
    }),
    ("telephone", {
        "category": "Telephone",
        "keywords": ["mobile bill", "telephone bill", "landline", "sim", "airtime"],
        "purpose": "Telephone and mobile communication charges.",
    }),
    ("electricity", {
        "category": "Electricity",
        "keywords": ["electricity bill", "power bill", "energy charges", "discom"],
        "purpose": "Electricity / power consumption charges.",
    }),
    ("power", {
        "category": "Electricity",
        "keywords": ["electricity bill", "power bill", "energy charges", "generator", "diesel"],
        "purpose": "Power and electricity related charges.",
    }),
    ("internet", {
        "category": "Internet",
        "keywords": ["internet bill", "broadband", "wifi", "leased line", "data plan"],
        "purpose": "Internet and broadband connectivity charges.",
    }),
    ("insurance", {
        "category": "Insurance",
        "keywords": ["insurance premium", "policy", "mediclaim", "fire insurance", "marine insurance"],
        "purpose": "Insurance premium payments.",
    }),
    ("bank charge", {
        "category": "Bank Charges",
        "keywords": ["bank charges", "processing fee", "neft charges", "rtgs charges", "swift charges"],
        "purpose": "Bank charges, transaction fees, and processing charges.",
    }),
    ("interest", {
        "category": "Interest",
        "keywords": ["interest paid", "loan interest", "overdraft interest", "late payment interest"],
        "purpose": "Interest expense on loans, overdrafts, or delayed payments.",
    }),
    ("salary", {
        "category": "Salary & Wages",
        "keywords": ["salary", "wages", "payroll", "bonus", "incentive"],
        "purpose": "Employee salary, wages, and payroll-related payments.",
    }),
    ("commission", {
        "category": "Commission",
        "keywords": ["commission", "brokerage", "referral fee"],
        "purpose": "Commission or brokerage paid.",
    }),
    ("security", {
        "category": "Security Charges",
        "keywords": ["security services", "guard", "surveillance", "cctv"],
        "purpose": "Security service charges.",
    }),
    ("housekeeping", {
        "category": "Housekeeping",
        "keywords": ["housekeeping", "cleaning", "sanitation", "pest control"],
        "purpose": "Housekeeping and cleaning service charges.",
    }),
    ("donation", {
        "category": "Donation",
        "keywords": ["donation", "charity", "csr contribution"],
        "purpose": "Donations and charitable contributions.",
    }),
]


def match_keyword_library(ledger_name: str) -> dict | None:
    lowered = ledger_name.lower()
    for pattern, entry in LEDGER_KEYWORD_LIBRARY:
        if pattern in lowered:
            return entry
    return None


def is_blocked_credit_candidate(ledger_name: str) -> bool:
    """Checked only against the ledger's own name — not against the seed
    keyword library, whose example terms (e.g. "consultancy") can contain
    unrelated blocked-credit substrings ("lta") by coincidence."""
    lowered = ledger_name.lower()
    return any(re.search(rf"\b{re.escape(term)}\b", lowered) for term in BLOCKED_CREDIT_KEYWORDS)
