"""
Punto de entrada de la aplicación FastAPI.
Configura CORS, registra routers y eventos de ciclo de vida.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.accommodations import router as accommodations_router
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.cancellations import router as cancellations_router
from app.api.v1.change_requests import router as change_requests_router
from app.api.v1.pricing import router as pricing_router
from app.api.v1.public import router as public_router
from app.api.v1.reservations import router as reservations_router
from app.api.v1.settings import router as settings_router
from app.api.v1.superadmin import router as superadmin_router
from app.api.v1.users import router as users_router
from app.api.v1.webhooks import router as webhooks_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Inicializa la BD al arrancar y limpia recursos al parar."""
    await init_db()
    yield


app = FastAPI(
    title="Klyp RESERVAS v4.0",
    description="Motor de reservas multi-tenant para alojamientos heterogéneos.",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS estricto — solo dominios autorizados
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(accommodations_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")
app.include_router(public_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(reservations_router, prefix="/api/v1")
app.include_router(cancellations_router, prefix="/api/v1")
app.include_router(change_requests_router, prefix="/api/v1")
app.include_router(superadmin_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")


@app.get("/health", tags=["Sistema"], summary="Health check")
async def health_check() -> dict[str, str]:
    """Endpoint de salud para el balanceador de carga y Docker healthcheck."""
    return {"status": "ok", "service": settings.app_name}
