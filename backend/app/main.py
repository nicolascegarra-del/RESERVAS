"""
Punto de entrada de la aplicación FastAPI.
Configura CORS, registra routers y eventos de ciclo de vida.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.rate_limit import limiter

from app.api.v1.access_logs import router as access_logs_router
from app.api.v1.billing import router as billing_router
from app.api.v1.accommodations import router as accommodations_router
from app.api.v1.reservation_access import router as reservation_access_router
from app.api.v1.mail_logs import router as mail_logs_router
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.cancellations import router as cancellations_router
from app.api.v1.company_users import router as company_users_router
from app.api.v1.change_requests import router as change_requests_router
from app.api.v1.guest_docs import router as guest_docs_router
from app.api.v1.guest_upload import router as guest_upload_router
from app.api.v1.pricing import router as pricing_router
from app.api.v1.public import router as public_router
from app.api.v1.reservations import router as reservations_router
from app.api.v1.settings import router as settings_router
from app.api.v1.superadmin import router as superadmin_router
from app.api.v1.users import router as users_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.redsys import router as redsys_router
from app.api.v1.preferences import router as preferences_router
from app.api.v1.blockings import router as blockings_router
from app.core.config import settings


_is_dev = settings.app_env == "development"

app = FastAPI(
    title="Klyp RESERVAS v4.0",
    description="Motor de reservas multi-tenant para alojamientos heterogéneos.",
    version="4.0.0",
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS estricto — solo dominios autorizados
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next: Any) -> Response:
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not _is_dev:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(accommodations_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")
app.include_router(public_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(reservations_router, prefix="/api/v1")
app.include_router(reservation_access_router, prefix="/api/v1")
app.include_router(guest_docs_router, prefix="/api/v1")
app.include_router(guest_upload_router, prefix="/api/v1")
app.include_router(cancellations_router, prefix="/api/v1")
app.include_router(company_users_router, prefix="/api/v1")
app.include_router(change_requests_router, prefix="/api/v1")
app.include_router(superadmin_router, prefix="/api/v1")
app.include_router(mail_logs_router, prefix="/api/v1")
app.include_router(access_logs_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(redsys_router, prefix="/api/v1")
app.include_router(preferences_router, prefix="/api/v1")
app.include_router(blockings_router, prefix="/api/v1")


app.mount("/media", StaticFiles(directory="/app/media"), name="media")


@app.get("/health", tags=["Sistema"], summary="Health check")
async def health_check() -> dict[str, str]:
    """Endpoint de salud para el balanceador de carga y Docker healthcheck."""
    return {"status": "ok"}
