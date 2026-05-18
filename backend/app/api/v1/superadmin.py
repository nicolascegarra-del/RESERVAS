"""
Router de super admin — gestión global de empresas y usuarios.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.core.security import hash_password
from app.models.role_permission import PERMISSION_DEFAULTS, PERMISSION_LABELS, RolePermission
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.superadmin import (
    AdminUserCreate,
    AdminUserRead,
    AdminUserUpdate,
    PasswordReset,
    RolePermissionRead,
    RolePermissionUpdate,
    TenantConfigRead,
    TenantConfigUpdate,
    TenantCreate,
    TenantRead,
    TenantUpdate,
)

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

    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_tenant(tenant_id: UUID, _: SuperAdminDep, session: SessionDep) -> None:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})
    tenant.is_active = False
    session.add(tenant)
    await session.commit()


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
    )


@router.patch("/tenants/{tenant_id}/config", response_model=TenantConfigRead)
async def update_tenant_config(tenant_id: UUID, data: TenantConfigUpdate, _: SuperAdminDep, session: SessionDep) -> TenantConfigRead:
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}})

    if data.stripe_enabled is not None:
        tenant.stripe_enabled = data.stripe_enabled
    if data.stripe_secret_key is not None:
        tenant.stripe_secret_key = data.stripe_secret_key or None
    if data.stripe_webhook_secret is not None:
        tenant.stripe_webhook_secret = data.stripe_webhook_secret or None
    if data.stripe_currency is not None:
        tenant.stripe_currency = data.stripe_currency
    if data.smtp_enabled is not None:
        tenant.smtp_enabled = data.smtp_enabled
    if data.smtp_host is not None:
        tenant.smtp_host = data.smtp_host or None
    if data.smtp_port is not None:
        tenant.smtp_port = data.smtp_port
    if data.smtp_user is not None:
        tenant.smtp_user = data.smtp_user or None
    if data.smtp_password is not None:
        tenant.smtp_password = data.smtp_password or None
    if data.smtp_from is not None:
        tenant.smtp_from = data.smtp_from or None

    session.add(tenant)
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
    )


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
    query = select(User).order_by(User.full_name)
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
