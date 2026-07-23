from fastapi import APIRouter

from app.api.v1.endpoints import clients, invoices

api_router = APIRouter()
api_router.include_router(clients.router)
api_router.include_router(invoices.router)
