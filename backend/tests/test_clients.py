"""Tests for the Client (company) module API."""


def test_create_client_with_valid_details(client):
    response = client.post(
        "/api/v1/clients",
        json={
            "company_name": "Sunrise Textiles Pvt Ltd",
            "gstin": "27abcde1234f1z5",
            "pan": "abcde1234f",
            "financial_year": "2026-27",
            "address": "123 MG Road, Mumbai",
            "contact_person": "Rahul Sharma",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["company_name"] == "Sunrise Textiles Pvt Ltd"
    # GSTIN/PAN are normalised to uppercase.
    assert body["gstin"] == "27ABCDE1234F1Z5"
    assert body["pan"] == "ABCDE1234F"
    assert body["status"] == "active"


def test_create_client_rejects_invalid_gstin(client):
    response = client.post("/api/v1/clients", json={"company_name": "Bad GSTIN Co", "gstin": "not-a-gstin"})
    assert response.status_code == 422


def test_create_client_rejects_invalid_pan(client):
    response = client.post("/api/v1/clients", json={"company_name": "Bad PAN Co", "pan": "12345"})
    assert response.status_code == 422


def test_create_client_requires_company_name(client):
    response = client.post("/api/v1/clients", json={"company_name": "   "})
    assert response.status_code == 422


def test_list_clients_search_by_company_name(client):
    client.post("/api/v1/clients", json={"company_name": "Alpha Traders"})
    client.post("/api/v1/clients", json={"company_name": "Beta Industries"})

    response = client.get("/api/v1/clients", params={"search": "Alpha"})
    assert response.status_code == 200
    names = [item["company_name"] for item in response.json()["items"]]
    assert "Alpha Traders" in names
    assert "Beta Industries" not in names


def test_update_client(client):
    created = client.post("/api/v1/clients", json={"company_name": "Old Name"}).json()
    response = client.patch(f"/api/v1/clients/{created['id']}", json={"company_name": "New Name"})
    assert response.status_code == 200
    assert response.json()["company_name"] == "New Name"


def test_archive_and_unarchive_client(client):
    created = client.post("/api/v1/clients", json={"company_name": "Archivable Co"}).json()

    archive_resp = client.post(f"/api/v1/clients/{created['id']}/archive")
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    active_list = client.get("/api/v1/clients", params={"status": "active"}).json()
    assert created["id"] not in [item["id"] for item in active_list["items"]]

    unarchive_resp = client.post(f"/api/v1/clients/{created['id']}/unarchive")
    assert unarchive_resp.status_code == 200
    assert unarchive_resp.json()["status"] == "active"


def test_delete_client_removes_it_and_its_invoices(client):
    created = client.post("/api/v1/clients", json={"company_name": "Deletable Co"}).json()
    client_id = created["id"]

    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (40, 40), (5, 5, 5)).save(buffer, format="PNG")
    files = {"file": ("invoice.png", buffer.getvalue(), "image/png")}
    upload_resp = client.post(f"/api/v1/clients/{client_id}/invoices/upload", files=files)
    invoice_id = upload_resp.json()["id"]

    delete_resp = client.delete(f"/api/v1/clients/{client_id}")
    assert delete_resp.status_code == 204

    assert client.get(f"/api/v1/clients/{client_id}").status_code == 404
    assert client.get(f"/api/v1/clients/{client_id}/invoices/{invoice_id}").status_code == 404


def test_get_missing_client_returns_404(client):
    response = client.get("/api/v1/clients/does-not-exist")
    assert response.status_code == 404
