"""Tests for the Ledger Master module: Tally XML import and classification."""
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_XML = (FIXTURES_DIR / "sample_tally_master.xml").read_bytes()


@pytest.fixture()
def client_id(client) -> str:
    response = client.post("/api/v1/clients", json={"company_name": "Ledger Test Co"})
    assert response.status_code == 201
    return response.json()["id"]


def _import_sample(client, client_id: str):
    files = {"file": ("tally_masters.xml", SAMPLE_XML, "text/xml")}
    return client.post(f"/api/v1/clients/{client_id}/ledger-master/import", files=files)


def _find_ledger(client, client_id: str, name: str) -> dict:
    response = client.get(f"/api/v1/clients/{client_id}/ledger-master/ledgers", params={"search": name})
    items = response.json()["items"]
    matches = [i for i in items if i["name"] == name]
    assert matches, f"Ledger '{name}' not found in {[i['name'] for i in items]}"
    return matches[0]


def test_import_reports_correct_counts(client, client_id):
    response = _import_sample(client, client_id)
    assert response.status_code == 201
    body = response.json()
    assert body["group_count"] == 1
    assert body["ledger_count"] == 13
    assert body["cost_centre_count"] == 1
    assert body["filename"] == "tally_masters.xml"


def test_import_rejects_non_tally_xml(client, client_id):
    files = {"file": ("empty.xml", b"<root><foo>bar</foo></root>", "text/xml")}
    response = client.post(f"/api/v1/clients/{client_id}/ledger-master/import", files=files)
    assert response.status_code == 400


def test_import_rejects_malformed_xml(client, client_id):
    files = {"file": ("broken.xml", b"<ENVELOPE><BODY unclosed", "text/xml")}
    response = client.post(f"/api/v1/clients/{client_id}/ledger-master/import", files=files)
    assert response.status_code == 400


def test_summary_counts_by_category(client, client_id):
    _import_sample(client, client_id)
    summary = client.get(f"/api/v1/clients/{client_id}/ledger-master/summary").json()

    assert summary["total_ledgers"] == 13
    assert summary["total_groups"] == 1
    assert summary["total_cost_centres"] == 1
    assert summary["vendor_count"] == 1
    assert summary["customer_count"] == 1
    assert summary["bank_count"] == 1
    assert summary["cash_count"] == 1
    assert summary["gst_ledger_count"] == 3
    assert summary["tds_ledger_count"] == 1
    assert summary["expense_ledger_count"] == 3
    assert summary["income_ledger_count"] == 1
    assert summary["asset_ledger_count"] == 1
    assert summary["last_import"]["ledger_count"] == 13


def test_vendor_ledger_classified_with_gstin_and_pan(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "ABC Traders")
    assert ledger["ledger_type"] == "vendor"
    assert ledger["nature"] == "liability"
    assert ledger["gstin"] == "27ABCDE1234F1Z5"
    assert ledger["pan"] == "ABCDE1234F"


def test_customer_ledger_classified(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "XYZ Corp")
    assert ledger["ledger_type"] == "customer"
    assert ledger["nature"] == "asset"


def test_bank_and_cash_ledgers_classified(client, client_id):
    _import_sample(client, client_id)
    bank = _find_ledger(client, client_id, "HDFC Bank Current Account")
    assert bank["ledger_type"] == "bank"
    cash = _find_ledger(client, client_id, "Cash")
    assert cash["ledger_type"] == "cash"


def test_gst_duty_ledgers_classified_by_component(client, client_id):
    _import_sample(client, client_id)
    for name, component in [("CGST", "CGST"), ("SGST", "SGST"), ("IGST", "IGST")]:
        ledger = _find_ledger(client, client_id, name)
        assert ledger["ledger_type"] == "gst_duty"
        assert ledger["is_gst_ledger"] is True
        assert ledger["gst_component"] == component


def test_tds_duty_ledger_classified(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "TDS on Professional Charges")
    assert ledger["ledger_type"] == "tds_duty"
    assert ledger["is_tds_ledger"] is True


def test_expense_ledger_under_custom_group_chain_resolves_and_gets_keywords(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "Office Expenses")
    assert ledger["nature"] == "expense"
    assert ledger["capital_or_revenue"] == "revenue"
    assert ledger["expense_category"] == "Office Expenses"
    assert "stationery" in ledger["suggested_keywords"]
    assert ledger["accounting_purpose"]


def test_professional_charges_ledger_gets_matching_keywords(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "Professional Charges")
    assert ledger["expense_category"] == "Professional Service"
    assert "consultancy" in ledger["suggested_keywords"]


def test_blocked_credit_expense_flagged_for_review(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "Motor Car Insurance")
    assert ledger["nature"] == "expense"
    assert ledger["gst_itc_eligibility"] == "review"


def test_eligible_expense_not_flagged(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "Professional Charges")
    assert ledger["gst_itc_eligibility"] == "eligible"


def test_income_and_asset_ledgers_classified(client, client_id):
    _import_sample(client, client_id)
    sales = _find_ledger(client, client_id, "Domestic Sales")
    assert sales["nature"] == "income"
    building = _find_ledger(client, client_id, "Office Building")
    assert building["nature"] == "asset"
    assert building["capital_or_revenue"] == "capital"


def test_cost_centre_imported(client, client_id):
    _import_sample(client, client_id)
    response = client.get(f"/api/v1/clients/{client_id}/ledger-master/cost-centres")
    assert response.status_code == 200
    names = [cc["name"] for cc in response.json()]
    assert "Mumbai Branch" in names


def test_edit_ledger_is_preserved_across_reimport(client, client_id):
    _import_sample(client, client_id)
    ledger = _find_ledger(client, client_id, "Office Expenses")

    patch_resp = client.patch(
        f"/api/v1/clients/{client_id}/ledger-master/ledgers/{ledger['id']}",
        json={"accounting_purpose": "My custom note", "expense_category": "My Category"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_manually_edited"] is True

    # Re-importing the same file must not clobber the manual edit.
    _import_sample(client, client_id)
    refreshed = _find_ledger(client, client_id, "Office Expenses")
    assert refreshed["accounting_purpose"] == "My custom note"
    assert refreshed["expense_category"] == "My Category"
    assert refreshed["is_manually_edited"] is True


def test_ledgers_are_isolated_between_clients(client):
    client_a = client.post("/api/v1/clients", json={"company_name": "Ledger Client A"}).json()["id"]
    client_b = client.post("/api/v1/clients", json={"company_name": "Ledger Client B"}).json()["id"]

    _import_sample(client, client_a)

    list_b = client.get(f"/api/v1/clients/{client_b}/ledger-master/ledgers").json()
    assert list_b["total"] == 0

    summary_b = client.get(f"/api/v1/clients/{client_b}/ledger-master/summary").json()
    assert summary_b["total_ledgers"] == 0
    assert summary_b["last_import"] is None
