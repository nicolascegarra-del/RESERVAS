"""
Router de logs de acceso (super_admin only).

  GET    /superadmin/access-logs  → todos los registros de login
  DELETE /superadmin/access-logs  → vacía todos los registros (super_admin)
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import func, delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.models.access_log import AccessLog
from app.models.user import User, UserRole

router = APIRouter(tags=["Access Logs"])

SuperAdminDep = Annotated[User, Depends(require_role(UserRole.super_admin))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class AccessLogRead(BaseModel):
    id: UUID
    user_id: UUID | None
    user_email: str
    user_role: str | None
    tenant_id: UUID | None
    ip_address: str | None
    event_type: str
    detail: str | None
    accessed_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAccessLogs(BaseModel):
    items: list[AccessLogRead]
    total: int
    page: int
    pages: int


@router.get("/superadmin/access-logs", response_model=PaginatedAccessLogs)
async def list_access_logs(
    _: SuperAdminDep,
    session: SessionDep,
    event_type: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    tenant_id: UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> PaginatedAccessLogs:
    query = select(AccessLog)
    if event_type:
        query = query.where(AccessLog.event_type == event_type)
    if user_email:
        query = query.where(AccessLog.user_email.ilike(f"%{user_email}%"))
    if tenant_id:
        query = query.where(AccessLog.tenant_id == tenant_id)

    count_result = await session.exec(select(func.count()).select_from(query.subquery()))
    total = count_result.one()

    items_result = await session.exec(
        query.order_by(AccessLog.accessed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.all()

    return PaginatedAccessLogs(
        items=[AccessLogRead.model_validate(i) for i in items],
        total=total,
        page=page,
        pages=max(1, (total + page_size - 1) // page_size),
    )


class DeletedCount(BaseModel):
    deleted: int


@router.delete(
    "/superadmin/access-logs",
    response_model=DeletedCount,
    status_code=status.HTTP_200_OK,
    summary="Vaciar todos los logs de acceso",
)
async def delete_all_access_logs(_: SuperAdminDep, session: SessionDep) -> DeletedCount:
    count_result = await session.exec(select(func.count()).select_from(AccessLog))
    deleted = count_result.one()
    await session.exec(delete(AccessLog))
    await session.commit()
    return DeletedCount(deleted=deleted)
