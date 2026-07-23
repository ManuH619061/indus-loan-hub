"""FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.exceptions import (
    ClientNotFoundError,
    FileTooLargeError,
    InvoiceNotFoundError,
    LedgerNotFoundError,
    UnsupportedFileTypeError,
)
from app.core.logging_config import configure_logging
from app.db.base import Base
from app.db.session import engine
from app.models import Client, CostCentre, Invoice, Ledger, LedgerGroup, LedgerMasterImport  # noqa: F401 - ensure models are registered on Base.metadata
from app.services.file_storage import ensure_root_storage_dir
from app.services.tally_xml_parser import TallyXmlParseError

configure_logging()
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _ensure_data_dir()
    ensure_root_storage_dir(settings)
    # SQLite dev convenience: create tables if they don't exist yet.
    # A future Postgres deployment should use Alembic migrations instead.
    Base.metadata.create_all(bind=engine)
    logger.info("%s started (env=%s)", settings.APP_NAME, settings.ENVIRONMENT)
    yield


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_data_dir() -> None:
    if settings.DATABASE_URL.startswith("sqlite"):
        db_path = settings.DATABASE_URL.split("///")[-1]
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)


@app.exception_handler(UnsupportedFileTypeError)
def handle_unsupported_file_type(request: Request, exc: UnsupportedFileTypeError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(FileTooLargeError)
def handle_file_too_large(request: Request, exc: FileTooLargeError) -> JSONResponse:
    return JSONResponse(status_code=413, content={"detail": str(exc)})


@app.exception_handler(InvoiceNotFoundError)
def handle_invoice_not_found(request: Request, exc: InvoiceNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ClientNotFoundError)
def handle_client_not_found(request: Request, exc: ClientNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(LedgerNotFoundError)
def handle_ledger_not_found(request: Request, exc: LedgerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(TallyXmlParseError)
def handle_tally_xml_parse_error(request: Request, exc: TallyXmlParseError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
