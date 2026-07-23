# AI Invoice Accounting

A production-grade, single-user accounting application for processing scanned purchase invoices across
multiple client companies — OCR extraction, AI ledger/GST/TDS suggestions, and Tally-ready Excel exports.

There is no login, registration, or multi-user support by design: this is a personal accounting tool for one
user managing many client companies, each with completely separate data (invoices, masters, ledger memory,
processed reports).

The application is being built module by module. **Completed so far:**

- **Client Management** — create, open, edit, archive, and delete client companies; search across all clients.
  Every client's data (files, database rows) is fully isolated by `client_id`.
- **Invoice Upload** — drag-and-drop or folder upload of up to 1,000 invoices per client (PDF/JPG/JPEG/PNG),
  with live progress, thumbnails, page counts, duplicate-safe storage, retry/reprocess, and delete.

Not yet built: ledger master upload, OCR extraction, AI accounting suggestions, GST/TDS validation,
duplicate detection, narration generation, the review grid, the full dashboard, and Excel/Tally export.

## Architecture

```
backend/    FastAPI + SQLAlchemy + SQLite (Postgres-ready — every query is ORM-based)
frontend/   React + TypeScript + Vite + Tailwind CSS v4
```

Each client's uploaded files live under `backend/storage/clients/<client_id>/`, kept separate from every
other client. The database uses a single SQLite file with all tables scoped by `client_id`, which keeps
cross-client queries impossible while remaining a straightforward `DATABASE_URL` swap to PostgreSQL later.

## Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Runs the API at `http://localhost:8000` (docs at `/docs`). Run tests with:

```bash
pytest
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Runs the app at `http://localhost:5173`.
