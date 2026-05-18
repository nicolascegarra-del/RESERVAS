"""
Modelo Tenant — representa una empresa en el sistema multi-tenant.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=255, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    # ─── Branding personalizable por empresa ─────────────────────────────────
    brand_name: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    primary_color: str | None = Field(default=None, max_length=7)
    accent_color: str | None = Field(default=None, max_length=7)
    tagline: str | None = Field(default=None, max_length=500)

    # ─── Configuración Stripe (por empresa) ──────────────────────────────────
    stripe_secret_key: str | None = Field(default=None, max_length=500)
    stripe_webhook_secret: str | None = Field(default=None, max_length=500)
    stripe_currency: str = Field(default="eur", max_length=3)
    stripe_enabled: bool = Field(default=False)

    # ─── Configuración SMTP (por empresa) ────────────────────────────────────
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int = Field(default=587)
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=500)
    smtp_from: str | None = Field(default=None, max_length=255)
    smtp_enabled: bool = Field(default=False)

    # ─── Datos fiscales y de contacto ────────────────────────────────────────
    legal_name: str | None = Field(default=None, max_length=255)
    cif: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    postal_code: str | None = Field(default=None, max_length=10)
    municipality: str | None = Field(default=None, max_length=255)
    province: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    bank_account: str | None = Field(default=None, max_length=50)

    # ─── Límites de usuarios por empresa ─────────────────────────────────────
    max_company_admins: int = Field(default=5)
    max_reception_users: int = Field(default=20)
