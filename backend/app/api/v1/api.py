from fastapi import APIRouter

from app.api.v1.endpoints import clients, invoices, ledger_master

api_router = APIRouter()
api_router.include_router(clients.router)
api_router.include_router(invoices.router)
api_router.include_router(ledger_master.router)
