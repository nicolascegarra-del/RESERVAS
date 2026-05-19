"""
Schemas Pydantic para el panel de super admin.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# ─── Tenants ──────────────────────────────────────────────────────────────────


class TenantCreate(BaseModel):
    name: str = Field(max_length=255)
    slug: str = Field(max_length=100, pattern=r"^[a-z0-9-]+$")
    legal_name: str | None = Field(default=None, max_length=255)
    cif: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    postal_code: str | None = Field(default=None, max_length=10)
    municipality: str | None = Field(default=None, max_length=255)
    province: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    bank_account: str | None = Field(default=None, max_length=50)
    max_company_admins: int = Field(default=5, ge=1, le=100)
    max_reception_users: int = Field(default=20, ge=1, le=500)


class TenantUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=100, pattern=r"^[a-z0-9-]+$")
    is_active: bool | None = None
    legal_name: str | None = Field(default=None, max_length=255)
    cif: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    postal_code: str | None = Field(default=None, max_length=10)
    municipality: str | None = Field(default=None, max_length=255)
    province: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    bank_account: str | None = Field(default=None, max_length=50)
    max_company_admins: int | None = Field(default=None, ge=1, le=100)
    max_reception_users: int | None = Field(default=None, ge=1, le=500)


class TenantRead(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    stripe_enabled: bool
    smtp_enabled: bool
    created_at: datetime
    logo_url: str | None
    legal_name: str | None
    cif: str | None
    address: str | None
    postal_code: str | None
    municipality: str | None
    province: str | None
    contact_email: str | None
    contact_phone: str | None
    bank_account: str | None
    max_company_admins: int
    max_reception_users: int

    model_config = {"from_attributes": True}


# ─── Configuración por empresa (Stripe + SMTP) ────────────────────────────────


class TenantConfigRead(BaseModel):
    stripe_enabled: bool
    stripe_secret_key_set: bool
    stripe_webhook_secret_set: bool
    stripe_currency: str
    smtp_enabled: bool
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password_set: bool
    smtp_from: str | None

    model_config = {"from_attributes": True}


class TenantConfigUpdate(BaseModel):
    stripe_enabled: bool | None = None
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_currency: str | None = Field(default=None, max_length=3)
    smtp_enabled: bool | None = None
    smtp_host: str | None = None
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None


# ─── Usuarios ─────────────────────────────────────────────────────────────────


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(max_length=255)
    password: str = Field(min_length=8)
    role: UserRole
    tenant_id: UUID | None = None


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    role: UserRole | None = None
    tenant_id: UUID | None = None
    is_active: bool | None = None


class AdminUserRead(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    tenant_id: UUID | None
    tenant_name: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8)


class SuperAdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(max_length=255)
    password: str = Field(min_length=8)


class SuperAdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


# ─── Permisos por rol ─────────────────────────────────────────────────────────


class RolePermissionRead(BaseModel):
    role: str
    permission_key: str
    label: str
    is_enabled: bool

    model_config = {"from_attributes": True}


class RolePermissionUpdate(BaseModel):
    role: str = Field(pattern=r"^(company_admin|reception)$")
    permission_key: str = Field(max_length=100)
    is_enabled: bool


class TenantHardDelete(BaseModel):
    password: str


# ─── SMTP global del sistema ──────────────────────────────────────────────────


class SystemSMTPRead(BaseModel):
    smtp_enabled: bool
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password_set: bool
    smtp_from: str | None

    model_config = {"from_attributes": True}


class SystemSMTPUpdate(BaseModel):
    smtp_enabled: bool | None = None
    smtp_host: str | None = None
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
