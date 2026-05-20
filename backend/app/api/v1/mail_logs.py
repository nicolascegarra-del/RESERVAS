"""
Router de logs de email.

  GET    /superadmin/mail-logs   → todos los tenants (super_admin)
  GET    /mail-logs              → solo el tenant del usuario (company_admin + reception)
  DELETE /superadmin/mail-logs   → vacía todos los logs (super_admin)
  DELETE /mail-logs              → vacía los logs del tenant (company_admin)
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
from app.models.mail_log import MailLog
from app.models.user import User, UserRole

router = APIRouter(tags=["Mail Logs"])

SuperAdminDep = Annotated[User, Depends(require_role(UserRole.super_admin))]
TenantUserDep = Annotated[User, Depends(require_role(UserRole.company_admin, UserRole.reception))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class MailLogRead(BaseModel):
    id: UUID
    tenant_id: UUID
    reservation_id: UUID | None
    to_email: str
    subject: str
    email_type: str
    status: str
    smtp_source: str
    error_message: str | None
    sent_at: datetime

    model_config = {"from_attributes": True}


class PaginatedMailLogs(BaseModel):
    items: list[MailLogRead]
    total: int
    page: int
    pages: int


async def _query_logs(
    session: AsyncSession,
    tenant_id_filter: UUID | None,
    status_filter: str | None,
    email_type_filter: str | None,
    page: int,
    page_size: int,
) -> PaginatedMailLogs:
    query = select(MailLog)
    if tenant_id_filter:
        query = query.where(MailLog.tenant_id == tenant_id_filter)
    if status_filter:
        query = query.where(MailLog.status == status_filter)
    if email_type_filter:
        query = query.where(MailLog.email_type == email_type_filter)

    count_result = await session.exec(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.one()

    items_result = await session.exec(
        query.order_by(MailLog.sent_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.all()

    return PaginatedMailLogs(
        items=[MailLogRead.model_validate(i) for i in items],
        total=total,
        page=page,
        pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/superadmin/mail-logs", response_model=PaginatedMailLogs)
async def list_all_mail_logs(
    _: SuperAdminDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    email_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> PaginatedMailLogs:
    return await _query_logs(session, tenant_id, status, email_type, page, page_size)


@router.get("/mail-logs", response_model=PaginatedMailLogs)
async def list_tenant_mail_logs(
    current_user: TenantUserDep,
    session: SessionDep,
    status: str | None = Query(default=None),
    email_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> PaginatedMailLogs:
    if not current_user.tenant_id:
        return PaginatedMailLogs(items=[], total=0, page=1, pages=1)
    return await _query_logs(session, current_user.tenant_id, status, email_type, page, page_size)


class DeletedCount(BaseModel):
    deleted: int


@router.delete(
    "/superadmin/mail-logs",
    response_model=DeletedCount,
    status_code=status.HTTP_200_OK,
    summary="Vaciar todos los logs de email",
)
async def delete_all_mail_logs(_: SuperAdminDep, session: SessionDep) -> DeletedCount:
    count_result = await session.exec(select(func.count()).select_from(MailLog))
    deleted = count_result.one()
    await session.exec(delete(MailLog))
    await session.commit()
    return DeletedCount(deleted=deleted)


@router.delete(
    "/mail-logs",
    response_model=DeletedCount,
    status_code=status.HTTP_200_OK,
    summary="Vaciar logs de email del tenant",
)
async def delete_tenant_mail_logs(
    current_user: TenantUserDep, session: SessionDep
) -> DeletedCount:
    if not current_user.tenant_id:
        return DeletedCount(deleted=0)
    count_result = await session.exec(
        select(func.count()).select_from(MailLog).where(MailLog.tenant_id == current_user.tenant_id)
    )
    deleted = count_result.one()
    await session.exec(delete(MailLog).where(MailLog.tenant_id == current_user.tenant_id))
    await session.commit()
    return DeletedCount(deleted=deleted)
