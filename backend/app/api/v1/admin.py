"""
Router de administración global — solo accesible por super_admin.
Proporciona endpoints para gestionar tenants desde el panel de super_admin.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.models.tenant import Tenant
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin", tags=["Administración"])

SuperAdminDep = Annotated[User, Depends(require_role(UserRole.super_admin))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get(
    "/tenants",
    summary="Listar tenants",
    description="Lista todos los tenants del sistema. Solo accesible por super_admin.",
)
async def list_tenants(
    _current_user: SuperAdminDep,
    session: SessionDep,
) -> list[dict]:
    """Devuelve todos los tenants activos para que el super_admin pueda seleccionar uno."""
    result = await session.exec(
        select(Tenant).where(Tenant.is_active == True).order_by(Tenant.name)  # noqa: E712
    )
    tenants = result.all()
    return [
        {"id": str(t.id), "name": t.name, "slug": t.slug}
        for t in tenants
    ]
