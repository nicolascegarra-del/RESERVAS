"""
Solicitudes de cambio de estado o precio.

- reception: puede crear solicitudes (POST).
- company_admin / super_admin: puede listar, aprobar y rechazar.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.change_request import (
    ChangeRequestStatus,
    ChangeRequestType,
    ReservationChangeRequest,
)
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole

router = APIRouter(tags=["Solicitudes de cambio"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AnyAuthDep = Annotated[User, Depends(get_current_user)]
AdminDep = Annotated[User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))]


def _resolve_tenant(user: User, tenant_id_override: UUID | None) -> UUID:
    if user.role == UserRole.super_admin and tenant_id_override:
        return tenant_id_override
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail={"error": {"code": "NO_TENANT", "message": "Sin tenant asignado."}})
    return user.tenant_id


# ─── Schemas inline ───────────────────────────────────────────────────────────

class ChangeRequestCreate(BaseModel):
    reservation_id: UUID
    type: ChangeRequestType
    requested_status: str | None = None
    requested_price: Decimal | None = None
    comment: str = Field(min_length=5, max_length=1000)


class ChangeRequestReview(BaseModel):
    review_comment: str | None = Field(default=None, max_length=1000)


class ChangeRequestRead(BaseModel):
    id: UUID
    reservation_id: UUID
    requested_by_name: str
    type: ChangeRequestType
    requested_status: str | None
    requested_price: float | None
    comment: str
    status: ChangeRequestStatus
    reviewed_by_name: str | None
    review_comment: str | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


def _to_read(r: ReservationChangeRequest) -> ChangeRequestRead:
    return ChangeRequestRead(
        id=r.id,
        reservation_id=r.reservation_id,
        requested_by_name=r.requested_by_name,
        type=r.type,
        requested_status=r.requested_status,
        requested_price=float(r.requested_price) if r.requested_price is not None else None,
        comment=r.comment,
        status=r.status,
        reviewed_by_name=r.reviewed_by_name,
        review_comment=r.review_comment,
        reviewed_at=r.reviewed_at,
        created_at=r.created_at,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/change-requests", status_code=status.HTTP_201_CREATED, response_model=ChangeRequestRead)
async def create_change_request(
    data: ChangeRequestCreate,
    current_user: AnyAuthDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None),
) -> ChangeRequestRead:
    """Recepcionista (o admin) crea una solicitud de cambio sobre una reserva."""
    effective_tenant_id = _resolve_tenant(current_user, tenant_id)

    # Verificar que la reserva existe y pertenece al tenant
    reservation = await session.get(Reservation, data.reservation_id)
    if not reservation or reservation.tenant_id != effective_tenant_id:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Reserva no encontrada."}})

    # Validar coherencia según tipo
    if data.type == ChangeRequestType.status_change and not data.requested_status:
        raise HTTPException(status_code=422, detail={"error": {"code": "MISSING_FIELD", "message": "Indica el estado solicitado."}})
    if data.type == ChangeRequestType.price_change and data.requested_price is None:
        raise HTTPException(status_code=422, detail={"error": {"code": "MISSING_FIELD", "message": "Indica el precio solicitado."}})

    cr = ReservationChangeRequest(
        tenant_id=effective_tenant_id,
        reservation_id=data.reservation_id,
        requested_by=current_user.id,
        requested_by_name=current_user.full_name,
        type=data.type,
        requested_status=data.requested_status,
        requested_price=data.requested_price,
        comment=data.comment,
        status=ChangeRequestStatus.pending,
    )
    session.add(cr)
    await session.commit()
    await session.refresh(cr)
    return _to_read(cr)


@router.get("/change-requests", response_model=list[ChangeRequestRead])
async def list_change_requests(
    current_user: AdminDep,
    session: SessionDep,
    pending_only: bool = Query(default=True),
    tenant_id: UUID | None = Query(default=None),
) -> list[ChangeRequestRead]:
    """Admin lista solicitudes pendientes (o todas)."""
    effective_tenant_id = _resolve_tenant(current_user, tenant_id)

    q = select(ReservationChangeRequest).where(
        ReservationChangeRequest.tenant_id == effective_tenant_id
    )
    if pending_only:
        q = q.where(ReservationChangeRequest.status == ChangeRequestStatus.pending)
    q = q.order_by(ReservationChangeRequest.created_at.desc())  # type: ignore[attr-defined]

    result = await session.exec(q)
    return [_to_read(r) for r in result.all()]


@router.get("/change-requests/count", response_model=dict)
async def count_pending(
    current_user: AdminDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None),
) -> dict:
    """Devuelve el número de solicitudes pendientes — para el badge del sidebar."""
    effective_tenant_id = _resolve_tenant(current_user, tenant_id)
    result = await session.exec(
        select(ReservationChangeRequest).where(
            ReservationChangeRequest.tenant_id == effective_tenant_id,
            ReservationChangeRequest.status == ChangeRequestStatus.pending,
        )
    )
    return {"pending": len(result.all())}


@router.patch("/change-requests/{request_id}/approve", response_model=ChangeRequestRead)
async def approve_change_request(
    request_id: UUID,
    data: ChangeRequestReview,
    current_user: AdminDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None),
) -> ChangeRequestRead:
    """Admin aprueba la solicitud — aplica el cambio inmediatamente."""
    effective_tenant_id = _resolve_tenant(current_user, tenant_id)

    cr = await session.get(ReservationChangeRequest, request_id)
    if not cr or cr.tenant_id != effective_tenant_id:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Solicitud no encontrada."}})
    if cr.status != ChangeRequestStatus.pending:
        raise HTTPException(status_code=409, detail={"error": {"code": "ALREADY_REVIEWED", "message": "La solicitud ya fue procesada."}})

    # Aplicar el cambio en la reserva
    reservation = await session.get(Reservation, cr.reservation_id)
    if reservation:
        if cr.type == ChangeRequestType.status_change and cr.requested_status:
            try:
                reservation.status = ReservationStatus(cr.requested_status)
            except ValueError:
                raise HTTPException(status_code=422, detail={"error": {"code": "INVALID_STATUS", "message": f"Estado '{cr.requested_status}' no válido."}})
        elif cr.type == ChangeRequestType.price_change and cr.requested_price is not None:
            reservation.total_price = cr.requested_price
        session.add(reservation)

    cr.status = ChangeRequestStatus.approved
    cr.reviewed_by = current_user.id
    cr.reviewed_by_name = current_user.full_name
    cr.review_comment = data.review_comment
    cr.reviewed_at = datetime.utcnow()
    session.add(cr)
    await session.commit()
    await session.refresh(cr)
    return _to_read(cr)


@router.patch("/change-requests/{request_id}/reject", response_model=ChangeRequestRead)
async def reject_change_request(
    request_id: UUID,
    data: ChangeRequestReview,
    current_user: AdminDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None),
) -> ChangeRequestRead:
    """Admin rechaza la solicitud sin aplicar cambios."""
    effective_tenant_id = _resolve_tenant(current_user, tenant_id)

    cr = await session.get(ReservationChangeRequest, request_id)
    if not cr or cr.tenant_id != effective_tenant_id:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Solicitud no encontrada."}})
    if cr.status != ChangeRequestStatus.pending:
        raise HTTPException(status_code=409, detail={"error": {"code": "ALREADY_REVIEWED", "message": "La solicitud ya fue procesada."}})

    cr.status = ChangeRequestStatus.rejected
    cr.reviewed_by = current_user.id
    cr.reviewed_by_name = current_user.full_name
    cr.review_comment = data.review_comment
    cr.reviewed_at = datetime.utcnow()
    session.add(cr)
    await session.commit()
    await session.refresh(cr)
    return _to_read(cr)
