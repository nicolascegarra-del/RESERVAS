"""
Router de super admin — gestión global de empresas y usuarios.
"""

import asyncio
import logging
import os
import smtplib
import ssl
import uuid as uuid_lib
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.database import get_session
from app.core.dependencies import require_role
from app.core.security import hash_password, verify_password
from app.models.billing import PaymentMethod, PaymentMethodType
from app.models.role_permission import PERMISSION_DEFAULTS, PERMISSION_LABELS, RolePermission
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.superadmin import (
    AdminUserCreate,
    AdminUserRead,
    AdminUserUpdate,
    PasswordReset,
    RolePermissionRead,
    RolePermissionUpdate,
    SuperAdminUserCreate,
    SuperAdminUserUpdate,
    SystemSMTPRead,
    SystemSMTPUpdate,
    TenantConfigRead,
    TenantConfigUpdate,
    TenantCreate,
    TenantHardDelete,
    TenantRead,
    TenantUpdate,
)

LOGO_DIR = "/app/media/logos"
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

SuperAdminDep = Annotated[User, Depends(require_role(UserRole.super_admin))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ─── Tenants ──────────────────────────────────────────────────────────────────


@router.get("/tenants", response_model=list[TenantRead])
async def list_tenants(_: SuperAdminDep, session: SessionDep) -> list[TenantRead]:
    result = await session.exec(select(Tenant).order_by(Tenant.name))
    return [TenantRead.model_validate(t) for t in result.all()]


@router.post("/tenants", response_model=TenantRead, status_code=status.HTTP_201_CREATED)
async def create_tenant(data: TenantCreate, _: SuperAdminDep, session: SessionDep) -> TenantRead:
    existing = await session.exec(select(Tenant).where(Tenant.slug == data.slug))
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "SLUG_TAKEN", "message": f"El slug '{data.slug}' ya existe."}},
        )
    tenant = Tenant(
        name=data.name,
        slug=data.slug,
        legal_name=data.legal_name,
        cif=data.cif,
        address=data.address,
        postal_code=data.postal_code,
        municipality=data.municipality,
        province=data.province,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        bank_account=data.bank_account,
        max_company_admins=data.max_company_admins,
        max_reception_users=data.max_reception_users,
    )
    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.get("/tenants/{tenant_id}", response_model=TenantRead)
async def get_tenant(tenant_id: UUID, _: SuperAdminDep, session: SessionDep) -> TenantRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    return TenantRead.model_validate(tenant)


@router.patch("/tenants/{tenant_id}", response_model=TenantRead)
async def update_tenant(tenant_id: UUID, data: TenantUpdate, _: SuperAdminDep, session: SessionDep) -> TenantRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})

    if data.name is not None:
        tenant.name = data.name
    if data.slug is not None:
        existing = await session.exec(select(Tenant).where(Tenant.slug == data.slug, Tenant.id != tenant_id))
        if existing.first():
            raise HTTPException(status_code=409, detail={"error": {"code": "SLUG_TAKEN", "message": f"El slug '{data.slug}' ya existe."}})
        tenant.slug = data.slug
    if data.is_active is not None:
        tenant.is_active = data.is_active

    for field in ("legal_name", "cif", "address", "postal_code", "municipality", "province", "contact_email", "contact_phone", "bank_account"):
        value = getattr(data, field)
        if value is not None:
            setattr(tenant, field, value or None)
    if data.max_company_admins is not None:
        tenant.max_company_admins = data.max_company_admins
    if data.max_reception_users is not None:
        tenant.max_reception_users = data.max_reception_users

    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.patch("/tenants/{tenant_id}/suspend", response_model=TenantRead)
async def toggle_tenant_suspend(tenant_id: UUID, _: SuperAdminDep, session: SessionDep) -> TenantRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    tenant.is_active = not tenant.is_active
    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.post("/tenants/{tenant_id}/hard-delete", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_tenant(
    tenant_id: UUID,
    data: TenantHardDelete,
    current_user: SuperAdminDep,
    session: SessionDep,
) -> None:
    db_user = await session.get(User, current_user.id)
    if not db_user or not verify_password(data.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INVALID_PASSWORD", "message": "Contraseña incorrecta."}},
        )
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})

    tid = str(tenant_id)
    # Cascade delete en orden de dependencias FK
    for stmt in [
        "DELETE FROM refund_orders WHERE tenant_id = :tid",
        "DELETE FROM reservation_change_requests WHERE tenant_id = :tid",
        "DELETE FROM reservations WHERE tenant_id = :tid",
        "DELETE FROM extra_prices WHERE tenant_id = :tid",
        "DELETE FROM seasons WHERE tenant_id = :tid",
        "DELETE FROM pricing_models WHERE tenant_id = :tid",
        "DELETE FROM field_definitions WHERE tenant_id = :tid",
        "DELETE FROM accommodation_units WHERE tenant_id = :tid",
        "DELETE FROM cancellation_policies WHERE tenant_id = :tid",
        "DELETE FROM extras WHERE tenant_id = :tid",
        "DELETE FROM accommodation_types WHERE tenant_id = :tid",
        "DELETE FROM users WHERE tenant_id = :tid",
        "DELETE FROM tenants WHERE id = :tid",
    ]:
        await session.execute(text(stmt), {"tid": tid})

    # Eliminar logo si existe
    if tenant.logo_url:
        logo_path = f"/app{tenant.logo_url}"
        if os.path.exists(logo_path):
            os.remove(logo_path)

    await session.commit()


@router.post("/tenants/{tenant_id}/logo", response_model=TenantRead)
async def upload_tenant_logo(
    tenant_id: UUID,
    _: SuperAdminDep,
    session: SessionDep,
    file: UploadFile = File(...),
) -> TenantRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_FILE_TYPE", "message": "Solo se permiten PNG, JPEG, WebP o SVG."}},
        )

    ext = (file.filename or "logo").rsplit(".", 1)[-1].lower()
    filename = f"{uuid_lib.uuid4()}.{ext}"
    os.makedirs(LOGO_DIR, exist_ok=True)

    # Eliminar logo anterior si existe
    if tenant.logo_url:
        old_path = f"/app{tenant.logo_url}"
        if os.path.exists(old_path):
            os.remove(old_path)

    contents = await file.read()
    with open(f"{LOGO_DIR}/{filename}", "wb") as f:
        f.write(contents)

    tenant.logo_url = f"/media/logos/{filename}"
    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


# ─── Helper SMTP ──────────────────────────────────────────────────────────────


logger = logging.getLogger(__name__)


class TestEmailPayload(BaseModel):
    to_email: str


def _test_smtp_connection(host: str, port: int, user: str, password: str | None) -> None:
    use_ssl = port == 465
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, context=ssl_context, timeout=8) as server:
                server.ehlo()
                if password:
                    server.login(user, password)
                server.noop()
        else:
            with smtplib.SMTP(host, port, timeout=8) as server:
                server.ehlo()
                server.starttls(context=ssl_context)
                server.ehlo()
                if password:
                    server.login(user, password)
                server.noop()
    except Exception as exc:
        logger.error("SMTP test failed (%s:%d): %s", host, port, exc)
        raise


# ─── Configuración por empresa (Stripe + SMTP) ────────────────────────────────


@router.get("/tenants/{tenant_id}/config", response_model=TenantConfigRead)
async def get_tenant_config(tenant_id: UUID, _: SuperAdminDep, session: SessionDep) -> TenantConfigRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    return TenantConfigRead(
        stripe_enabled=tenant.stripe_enabled,
        stripe_secret_key_set=bool(tenant.stripe_secret_key),
        stripe_webhook_secret_set=bool(tenant.stripe_webhook_secret),
        stripe_currency=tenant.stripe_currency,
        smtp_enabled=tenant.smtp_enabled,
        smtp_host=tenant.smtp_host,
        smtp_port=tenant.smtp_port,
        smtp_user=tenant.smtp_user,
        smtp_password_set=bool(tenant.smtp_password),
        smtp_from=tenant.smtp_from,
        smtp_verified_at=tenant.smtp_verified_at,
        redsys_enabled=tenant.redsys_enabled,
        redsys_merchant_code=tenant.redsys_merchant_code,
        redsys_terminal=tenant.redsys_terminal,
        redsys_secret_key_set=bool(tenant.redsys_secret_key),
        redsys_currency=tenant.redsys_currency,
        redsys_environment=tenant.redsys_environment,
    )


@router.patch("/tenants/{tenant_id}/config", response_model=TenantConfigRead)
async def update_tenant_config(tenant_id: UUID, data: TenantConfigUpdate, _: SuperAdminDep, session: SessionDep) -> TenantConfigRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})

    if data.stripe_enabled is not None:
        tenant.stripe_enabled = data.stripe_enabled
    if data.stripe_secret_key is not None:
        tenant.stripe_secret_key = encrypt_secret(data.stripe_secret_key) if data.stripe_secret_key else None
    if data.stripe_webhook_secret is not None:
        tenant.stripe_webhook_secret = encrypt_secret(data.stripe_webhook_secret) if data.stripe_webhook_secret else None
    if data.stripe_currency is not None:
        tenant.stripe_currency = data.stripe_currency

    smtp_changed = any([
        data.smtp_host is not None,
        data.smtp_port is not None,
        data.smtp_user is not None,
        data.smtp_password is not None,
        data.smtp_from is not None,
    ])
    if data.smtp_enabled is not None:
        tenant.smtp_enabled = data.smtp_enabled
    if data.smtp_host is not None:
        tenant.smtp_host = data.smtp_host or None
    if data.smtp_port is not None:
        tenant.smtp_port = data.smtp_port
    if data.smtp_user is not None:
        tenant.smtp_user = data.smtp_user or None
    if data.smtp_password is not None:
        tenant.smtp_password = encrypt_secret(data.smtp_password) if data.smtp_password else None
    if data.smtp_from is not None:
        tenant.smtp_from = data.smtp_from or None
    if smtp_changed:
        tenant.smtp_verified_at = None

    # Redsys
    if data.redsys_enabled is not None:
        tenant.redsys_enabled = data.redsys_enabled
    if data.redsys_merchant_code is not None:
        tenant.redsys_merchant_code = data.redsys_merchant_code or None
    if data.redsys_terminal is not None:
        tenant.redsys_terminal = data.redsys_terminal or None
    if data.redsys_secret_key is not None:
        tenant.redsys_secret_key = encrypt_secret(data.redsys_secret_key) if data.redsys_secret_key else None
        # Si cambia la clave, deshabilitar hasta que se reverifique
        if data.redsys_secret_key:
            tenant.redsys_enabled = False
    if data.redsys_currency is not None:
        tenant.redsys_currency = data.redsys_currency
    if data.redsys_environment is not None:
        tenant.redsys_environment = data.redsys_environment

    session.add(tenant)

    # Auto-crear método de pago Redsys si se activa y aún no existe
    if tenant.redsys_enabled:
        existing_pm = await session.exec(
            select(PaymentMethod).where(
                PaymentMethod.tenant_id == tenant_id,
                PaymentMethod.method_type == PaymentMethodType.redsys,
            )
        )
        if not existing_pm.first():
            session.add(PaymentMethod(
                tenant_id=tenant_id,
                name="Redsys TPV Virtual",
                method_type=PaymentMethodType.redsys,
                is_active=True,
                is_default=False,
                sort_order=10,
                created_at=datetime.utcnow(),
            ))

    await session.commit()
    await session.refresh(tenant)
    return TenantConfigRead(
        stripe_enabled=tenant.stripe_enabled,
        stripe_secret_key_set=bool(tenant.stripe_secret_key),
        stripe_webhook_secret_set=bool(tenant.stripe_webhook_secret),
        stripe_currency=tenant.stripe_currency,
        smtp_enabled=tenant.smtp_enabled,
        smtp_host=tenant.smtp_host,
        smtp_port=tenant.smtp_port,
        smtp_user=tenant.smtp_user,
        smtp_password_set=bool(tenant.smtp_password),
        smtp_from=tenant.smtp_from,
        smtp_verified_at=tenant.smtp_verified_at,
        redsys_enabled=tenant.redsys_enabled,
        redsys_merchant_code=tenant.redsys_merchant_code,
        redsys_terminal=tenant.redsys_terminal,
        redsys_secret_key_set=bool(tenant.redsys_secret_key),
        redsys_currency=tenant.redsys_currency,
        redsys_environment=tenant.redsys_environment,
    )


@router.post("/tenants/{tenant_id}/test-smtp", status_code=200)
async def test_tenant_smtp(tenant_id: UUID, _: SuperAdminDep, session: SessionDep) -> dict:
    from app.services.email_service import send_smtp_test_email
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    if not (tenant.smtp_host and tenant.smtp_user and tenant.smtp_from):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_NOT_CONFIGURED", "message": "Guarda primero el host, usuario y remitente SMTP antes de probar."}},
        )
    password = decrypt_secret(tenant.smtp_password) if tenant.smtp_password else None
    loop = asyncio.get_running_loop()
    try:
        status, error = await asyncio.wait_for(
            loop.run_in_executor(
                None, send_smtp_test_email,
                tenant.smtp_from, tenant.smtp_host, tenant.smtp_port,
                tenant.smtp_user, password, tenant.smtp_from, "tenant", tenant_id,
            ),
            timeout=20.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_TIMEOUT", "message": "Tiempo de conexión agotado. Revisa el host y puerto."}},
        )
    if status == "failed":
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_CONNECTION_FAILED", "message": f"Error de conexión: {error}"}},
        )
    tenant.smtp_verified_at = datetime.utcnow()
    session.add(tenant)
    await session.commit()
    return {"verified_at": tenant.smtp_verified_at.isoformat()}


@router.post("/tenants/{tenant_id}/send-test-email", status_code=200)
async def send_tenant_test_email(
    tenant_id: UUID, data: TestEmailPayload, _: SuperAdminDep, session: SessionDep
) -> dict:
    from app.services.email_service import send_smtp_test_email
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    if not (tenant.smtp_host and tenant.smtp_user and tenant.smtp_from):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_NOT_CONFIGURED", "message": "Configura host, usuario y remitente SMTP antes de enviar."}},
        )
    password = decrypt_secret(tenant.smtp_password) if tenant.smtp_password else None
    loop = asyncio.get_running_loop()
    status, error = await loop.run_in_executor(
        None, send_smtp_test_email,
        data.to_email, tenant.smtp_host, tenant.smtp_port,
        tenant.smtp_user, password, tenant.smtp_from, "tenant", tenant_id,
    )
    if status == "failed":
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SEND_FAILED", "message": f"Error al enviar: {error}"}},
        )
    return {"status": "sent", "to": data.to_email}


# ─── SMTP global del sistema ──────────────────────────────────────────────────


async def _get_or_create_system_settings(session: AsyncSession) -> SystemSettings:
    settings = await session.get(SystemSettings, 1)
    if not settings:
        settings = SystemSettings()
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    return settings


@router.get("/system-smtp", response_model=SystemSMTPRead)
async def get_system_smtp(_: SuperAdminDep, session: SessionDep) -> SystemSMTPRead:
    s = await _get_or_create_system_settings(session)
    return SystemSMTPRead(
        smtp_enabled=s.smtp_enabled,
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_user=s.smtp_user,
        smtp_password_set=bool(s.smtp_password),
        smtp_from=s.smtp_from,
        smtp_verified_at=s.smtp_verified_at,
    )


@router.patch("/system-smtp", response_model=SystemSMTPRead)
async def update_system_smtp(data: SystemSMTPUpdate, _: SuperAdminDep, session: SessionDep) -> SystemSMTPRead:
    s = await _get_or_create_system_settings(session)
    smtp_changed = any([
        data.smtp_host is not None,
        data.smtp_port is not None,
        data.smtp_user is not None,
        data.smtp_password is not None,
        data.smtp_from is not None,
    ])
    if data.smtp_enabled is not None:
        s.smtp_enabled = data.smtp_enabled
    if data.smtp_host is not None:
        s.smtp_host = data.smtp_host or None
    if data.smtp_port is not None:
        s.smtp_port = data.smtp_port
    if data.smtp_user is not None:
        s.smtp_user = data.smtp_user or None
    if data.smtp_password is not None:
        s.smtp_password = encrypt_secret(data.smtp_password) if data.smtp_password else None
    if data.smtp_from is not None:
        s.smtp_from = data.smtp_from or None
    if smtp_changed:
        s.smtp_verified_at = None
    session.add(s)
    await session.commit()
    await session.refresh(s)
    return SystemSMTPRead(
        smtp_enabled=s.smtp_enabled,
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_user=s.smtp_user,
        smtp_password_set=bool(s.smtp_password),
        smtp_from=s.smtp_from,
        smtp_verified_at=s.smtp_verified_at,
    )


@router.post("/system-smtp/test", status_code=200)
async def test_system_smtp(_: SuperAdminDep, session: SessionDep) -> dict:
    from app.services.email_service import send_smtp_test_email
    from uuid import UUID as _UUID
    s = await _get_or_create_system_settings(session)
    if not (s.smtp_host and s.smtp_user and s.smtp_from):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_NOT_CONFIGURED", "message": "Guarda primero el host, usuario y remitente SMTP antes de probar."}},
        )
    password = decrypt_secret(s.smtp_password) if s.smtp_password else None
    loop = asyncio.get_running_loop()
    try:
        status, error = await asyncio.wait_for(
            loop.run_in_executor(
                None, send_smtp_test_email,
                s.smtp_from, s.smtp_host, s.smtp_port,
                s.smtp_user, password, s.smtp_from, "system", _UUID(int=0),
            ),
            timeout=20.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_TIMEOUT", "message": "Tiempo de conexión agotado. Revisa el host y puerto."}},
        )
    if status == "failed":
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_CONNECTION_FAILED", "message": f"Error de conexión: {error}"}},
        )
    s.smtp_verified_at = datetime.utcnow()
    session.add(s)
    await session.commit()
    return {"verified_at": s.smtp_verified_at.isoformat()}


@router.post("/system-smtp/send-test-email", status_code=200)
async def send_system_test_email(
    data: TestEmailPayload, _: SuperAdminDep, session: SessionDep
) -> dict:
    from app.services.email_service import send_smtp_test_email
    from uuid import UUID as _UUID
    s = await _get_or_create_system_settings(session)
    if not (s.smtp_host and s.smtp_user and s.smtp_from):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_NOT_CONFIGURED", "message": "Configura host, usuario y remitente SMTP antes de enviar."}},
        )
    password = decrypt_secret(s.smtp_password) if s.smtp_password else None
    loop = asyncio.get_running_loop()
    status, error = await loop.run_in_executor(
        None, send_smtp_test_email,
        data.to_email, s.smtp_host, s.smtp_port,
        s.smtp_user, password, s.smtp_from, "system", _UUID(int=0),
    )
    if status == "failed":
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SEND_FAILED", "message": f"Error al enviar: {error}"}},
        )
    return {"status": "sent", "to": data.to_email}


# ─── Usuarios ─────────────────────────────────────────────────────────────────


async def _enrich_user(user: User, session: AsyncSession) -> AdminUserRead:
    tenant_name: str | None = None
    if user.tenant_id:
        tenant = await session.get(Tenant, user.tenant_id)
        tenant_name = tenant.name if tenant else None
    return AdminUserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("/users", response_model=list[AdminUserRead])
async def list_users(_: SuperAdminDep, session: SessionDep, tenant_id: UUID | None = None) -> list[AdminUserRead]:
    query = select(User).where(User.role != UserRole.super_admin).order_by(User.full_name)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    result = await session.exec(query)
    return [await _enrich_user(u, session) for u in result.all()]


@router.post("/users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_user(data: AdminUserCreate, _: SuperAdminDep, session: SessionDep) -> AdminUserRead:
    existing = await session.exec(select(User).where(User.email == str(data.email)))
    if existing.first():
        raise HTTPException(status_code=409, detail={"error": {"code": "EMAIL_TAKEN", "message": "El email ya está registrado."}})
    if data.role != UserRole.super_admin and not data.tenant_id:
        raise HTTPException(status_code=422, detail={"error": {"code": "TENANT_REQUIRED", "message": "Los roles company_admin y reception requieren tenant_id."}})

    # Verificar límites de usuarios por empresa
    if data.tenant_id and data.role in (UserRole.company_admin, UserRole.reception):
        tenant = await session.get(Tenant, data.tenant_id)
        if tenant:
            count_result = await session.exec(
                select(User).where(User.tenant_id == data.tenant_id, User.role == data.role, User.is_active == True)  # noqa: E712
            )
            current_count = len(count_result.all())
            if data.role == UserRole.company_admin and current_count >= tenant.max_company_admins:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error": {"code": "USER_LIMIT_REACHED", "message": f"Esta empresa ha alcanzado el límite de {tenant.max_company_admins} admin(s) de empresa."}},
                )
            if data.role == UserRole.reception and current_count >= tenant.max_reception_users:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error": {"code": "USER_LIMIT_REACHED", "message": f"Esta empresa ha alcanzado el límite de {tenant.max_reception_users} usuario(s) de gestión."}},
                )

    user = User(
        email=str(data.email),
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
        tenant_id=data.tenant_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _enrich_user(user, session)


@router.get("/users/{user_id}", response_model=AdminUserRead)
async def get_user(user_id: UUID, _: SuperAdminDep, session: SessionDep) -> AdminUserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    return await _enrich_user(user, session)


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def update_user(user_id: UUID, data: AdminUserUpdate, _: SuperAdminDep, session: SessionDep) -> AdminUserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.tenant_id is not None:
        user.tenant_id = data.tenant_id
    if data.is_active is not None:
        user.is_active = data.is_active
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _enrich_user(user, session)


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(user_id: UUID, data: PasswordReset, _: SuperAdminDep, session: SessionDep) -> None:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    user.hashed_password = hash_password(data.new_password)
    session.add(user)
    await session.commit()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(user_id: UUID, _: SuperAdminDep, session: SessionDep) -> None:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    user.is_active = False
    session.add(user)
    await session.commit()


# ─── Usuarios Super Admin ─────────────────────────────────────────────────────


@router.get("/superadmin-users", response_model=list[AdminUserRead])
async def list_superadmin_users(_: SuperAdminDep, session: SessionDep) -> list[AdminUserRead]:
    result = await session.exec(select(User).where(User.role == UserRole.super_admin).order_by(User.full_name))
    return [await _enrich_user(u, session) for u in result.all()]


@router.post("/superadmin-users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_superadmin_user(data: SuperAdminUserCreate, _: SuperAdminDep, session: SessionDep) -> AdminUserRead:
    existing = await session.exec(select(User).where(User.email == str(data.email)))
    if existing.first():
        raise HTTPException(status_code=409, detail={"error": {"code": "EMAIL_TAKEN", "message": "El email ya está registrado."}})
    user = User(
        email=str(data.email),
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.super_admin,
        tenant_id=None,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _enrich_user(user, session)


@router.patch("/superadmin-users/{user_id}", response_model=AdminUserRead)
async def update_superadmin_user(user_id: UUID, data: SuperAdminUserUpdate, current_user: SuperAdminDep, session: SessionDep) -> AdminUserRead:
    user = await session.get(User, user_id)
    if not user or user.role != UserRole.super_admin:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    if user_id == current_user.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "CANNOT_MODIFY_SELF", "message": "No puedes modificar tu propia cuenta desde aquí."}})
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.is_active is not None:
        user.is_active = data.is_active
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _enrich_user(user, session)


@router.post("/superadmin-users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_superadmin_password(user_id: UUID, data: PasswordReset, _: SuperAdminDep, session: SessionDep) -> None:
    user = await session.get(User, user_id)
    if not user or user.role != UserRole.super_admin:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    user.hashed_password = hash_password(data.new_password)
    session.add(user)
    await session.commit()


@router.delete("/superadmin-users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_superadmin_user(user_id: UUID, current_user: SuperAdminDep, session: SessionDep) -> None:
    user = await session.get(User, user_id)
    if not user or user.role != UserRole.super_admin:
        raise HTTPException(status_code=404, detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}})
    if user_id == current_user.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "CANNOT_DELETE_SELF", "message": "No puedes eliminar tu propia cuenta."}})
    count_result = await session.exec(select(User).where(User.role == UserRole.super_admin, User.is_active == True))  # noqa: E712
    if len(count_result.all()) <= 1:
        raise HTTPException(status_code=409, detail={"error": {"code": "LAST_SUPERADMIN", "message": "No puedes eliminar el único Super Admin activo."}})
    await session.delete(user)
    await session.commit()


# ─── Permisos por rol ─────────────────────────────────────────────────────────


async def _seed_permissions(role: str, session: AsyncSession) -> None:
    for key, enabled in PERMISSION_DEFAULTS.get(role, {}).items():
        existing = await session.exec(
            select(RolePermission).where(RolePermission.role == role, RolePermission.permission_key == key)
        )
        if not existing.first():
            session.add(RolePermission(role=role, permission_key=key, is_enabled=enabled))
    await session.commit()


@router.get("/role-permissions", response_model=list[RolePermissionRead])
async def list_role_permissions(_: SuperAdminDep, session: SessionDep) -> list[RolePermissionRead]:
    for role in ("company_admin", "reception"):
        await _seed_permissions(role, session)
    result = await session.exec(select(RolePermission).order_by(RolePermission.role, RolePermission.permission_key))
    return [
        RolePermissionRead(
            role=p.role,
            permission_key=p.permission_key,
            label=PERMISSION_LABELS.get(p.permission_key, p.permission_key),
            is_enabled=p.is_enabled,
        )
        for p in result.all()
    ]


@router.patch("/role-permissions", response_model=RolePermissionRead)
async def update_role_permission(data: RolePermissionUpdate, _: SuperAdminDep, session: SessionDep) -> RolePermissionRead:
    result = await session.exec(
        select(RolePermission).where(RolePermission.role == data.role, RolePermission.permission_key == data.permission_key)
    )
    perm = result.first()
    if not perm:
        raise HTTPException(status_code=404, detail={"error": {"code": "PERMISSION_NOT_FOUND", "message": "Permiso no encontrado."}})
    perm.is_enabled = data.is_enabled
    session.add(perm)
    await session.commit()
    await session.refresh(perm)
    return RolePermissionRead(
        role=perm.role,
        permission_key=perm.permission_key,
        label=PERMISSION_LABELS.get(perm.permission_key, perm.permission_key),
        is_enabled=perm.is_enabled,
    )
