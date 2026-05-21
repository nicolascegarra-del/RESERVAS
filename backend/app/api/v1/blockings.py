"""API endpoints para gestión de bloqueos de unidades de alojamiento."""

from datetime import date as date_type
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.dependencies import get_current_user, get_session, require_role
from app.models.user import User, UserRole
from app.schemas.blocking import BlockingCreate, BlockingRead
from app.services import blocking_service

router = APIRouter(tags=["Bloqueos"])


def _resolve_tenant_id(current_user: User, tenant_id: UUID | None) -> UUID:
    """Resuelve el tenant_id efectivo según el rol del usuario."""
    if current_user.role == UserRole.super_admin and tenant_id:
        return tenant_id
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


@router.get(
    "/blockings",
    response_model=list[BlockingRead],
    summary="Listar bloqueos",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def list_blockings(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    unit_id: UUID | None = Query(default=None),
    from_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    to_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[BlockingRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    from_d = date_type.fromisoformat(from_date) if from_date else None
    to_d = date_type.fromisoformat(to_date) if to_date else None
    return await blocking_service.list_blockings(session, effective_tenant_id, unit_id, from_d, to_d)


@router.post(
    "/blockings",
    response_model=list[BlockingRead],
    status_code=status.HTTP_201_CREATED,
    summary="Crear bloqueos",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def create_blockings(
    data: BlockingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[BlockingRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await blocking_service.create_blockings(session, data, effective_tenant_id)


@router.delete(
    "/blockings/{blocking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar bloqueo",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def delete_blocking(
    blocking_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await blocking_service.delete_blocking(session, blocking_id, effective_tenant_id)
