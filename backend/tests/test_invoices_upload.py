"""Tests for the Invoice Upload module API (scoped to a client)."""
from io import BytesIO

import fitz
import pytest
from PIL import Image


def _make_png_bytes(color=(200, 30, 30)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (60, 60), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _make_pdf_bytes(pages: int = 2) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture()
def client_id(client) -> str:
    response = client.post("/api/v1/clients", json={"company_name": "Acme Traders"})
    assert response.status_code == 201
    return response.json()["id"]


def test_upload_image_invoice_succeeds(client, client_id):
    files = {"file": ("receipt.png", _make_png_bytes(), "image/png")}
    response = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["page_count"] == 1
    assert body["has_thumbnail"] is True
    assert body["thumbnail_url"] is not None
    assert body["original_filename"] == "receipt.png"

    thumb_resp = client.get(body["thumbnail_url"])
    assert thumb_resp.status_code == 200
    assert thumb_resp.headers["content-type"] == "image/jpeg"


def test_upload_pdf_invoice_reports_page_count(client, client_id):
    files = {"file": ("invoice.pdf", _make_pdf_bytes(pages=3), "application/pdf")}
    response = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["page_count"] == 3
    assert body["has_thumbnail"] is True


def test_upload_rejects_unsupported_extension(client, client_id):
    files = {"file": ("notes.txt", b"hello world", "text/plain")}
    response = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)

    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_to_unknown_client_returns_404(client):
    files = {"file": ("receipt.png", _make_png_bytes(), "image/png")}
    response = client.post("/api/v1/clients/does-not-exist/invoices/upload", files=files)
    assert response.status_code == 404


def test_upload_rejects_oversized_file(client, client_id):
    from app.api.deps import get_app_settings
    from app.core.config import get_settings
    from app.main import app as fastapi_app

    tiny_settings = get_settings().model_copy(update={"MAX_UPLOAD_SIZE_MB": 0})
    fastapi_app.dependency_overrides[get_app_settings] = lambda: tiny_settings
    try:
        files = {"file": ("invoice.png", _make_png_bytes(), "image/png")}
        response = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)
        assert response.status_code == 413
    finally:
        fastapi_app.dependency_overrides.pop(get_app_settings, None)


def test_list_and_delete_invoice(client, client_id):
    files = {"file": ("to_delete.png", _make_png_bytes(color=(10, 200, 10)), "image/png")}
    upload_resp = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)
    invoice_id = upload_resp.json()["id"]

    list_resp = client.get(f"/api/v1/clients/{client_id}/invoices", params={"status": "uploaded"})
    assert list_resp.status_code == 200
    ids = [item["id"] for item in list_resp.json()["items"]]
    assert invoice_id in ids

    delete_resp = client.delete(f"/api/v1/clients/{client_id}/invoices/{invoice_id}")
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/v1/clients/{client_id}/invoices/{invoice_id}")
    assert get_resp.status_code == 404


def test_delete_missing_invoice_returns_404(client, client_id):
    response = client.delete(f"/api/v1/clients/{client_id}/invoices/does-not-exist")
    assert response.status_code == 404


def test_upload_corrupted_pdf_flags_error_and_reprocess_stays_error(client, client_id):
    files = {"file": ("broken.pdf", b"%PDF-1.4 not really a pdf", "application/pdf")}
    response = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "error"
    assert "Unreadable scan" in body["error_message"]
    assert body["thumbnail_url"] is None

    reprocess_resp = client.post(f"/api/v1/clients/{client_id}/invoices/{body['id']}/reprocess")
    assert reprocess_resp.status_code == 200
    assert reprocess_resp.json()["status"] == "error"


def test_stats_reflect_uploaded_invoice(client, client_id):
    before = client.get(f"/api/v1/clients/{client_id}/invoices/stats").json()
    files = {"file": ("stats.png", _make_png_bytes(color=(1, 2, 3)), "image/png")}
    client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)
    after = client.get(f"/api/v1/clients/{client_id}/invoices/stats").json()

    assert after["total"] == before["total"] + 1
    assert after["uploaded_count"] == before["uploaded_count"] + 1


def test_invoices_are_isolated_between_clients(client):
    client_a = client.post("/api/v1/clients", json={"company_name": "Client A"}).json()["id"]
    client_b = client.post("/api/v1/clients", json={"company_name": "Client B"}).json()["id"]

    files = {"file": ("a_invoice.png", _make_png_bytes(), "image/png")}
    upload_resp = client.post(f"/api/v1/clients/{client_a}/invoices/upload", files=files)
    invoice_id = upload_resp.json()["id"]

    # Client B must not see Client A's invoice, either in its list or by direct id lookup.
    list_resp = client.get(f"/api/v1/clients/{client_b}/invoices")
    assert invoice_id not in [item["id"] for item in list_resp.json()["items"]]

    get_resp = client.get(f"/api/v1/clients/{client_b}/invoices/{invoice_id}")
    assert get_resp.status_code == 404
