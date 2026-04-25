"""
Router de configuración del tenant.

Endpoints:
  GET   /settings/branding  → leer branding (cualquier rol autenticado del tenant)
  PATCH /settings/branding  → actualizar branding (company_admin y super_admin)

El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.tenant import TenantBrandingRead, TenantBrandingUpdate

router = APIRouter(tags=["Configuración"])


def _resolve_tenant_id(current_user: User, tenant_id_override: UUID | None) -> UUID:
    """
    Resuelve el tenant_id efectivo.
    El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
    """
    if current_user.role == UserRole.super_admin and tenant_id_override:
        return tenant_id_override
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "NO_TENANT",
                    "message": "El usuario no tiene tenant asignado. Use ?tenant_id=<uuid> si es super_admin.",
                }
            },
        )
    return current_user.tenant_id


async def _get_tenant(session: AsyncSession, tenant_id: UUID) -> Tenant:
    result = await session.exec(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant no encontrado."}},
        )
    return tenant


@router.get(
    "/settings/branding",
    response_model=TenantBrandingRead,
    summary="Obtener branding del tenant",
    description="Devuelve la configuración de branding del tenant autenticado.",
)
async def get_branding(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> TenantBrandingRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    tenant = await _get_tenant(session, effective_tenant_id)
    return TenantBrandingRead(
        brand_name=tenant.brand_name,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        accent_color=tenant.accent_color,
        tagline=tenant.tagline,
    )


@router.patch(
    "/settings/branding",
    response_model=TenantBrandingRead,
    summary="Actualizar branding del tenant",
    description=(
        "Actualiza la configuración de branding (logo, colores, nombre visible, tagline). "
        "Solo company_admin y super_admin pueden modificar el branding."
    ),
)
async def update_branding(
    data: TenantBrandingUpdate,
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> TenantBrandingRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    tenant = await _get_tenant(session, effective_tenant_id)

    # Actualizar solo los campos enviados en el payload
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)

    return TenantBrandingRead(
        brand_name=tenant.brand_name,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        accent_color=tenant.accent_color,
        tagline=tenant.tagline,
    )
