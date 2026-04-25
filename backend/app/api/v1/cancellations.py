"""
Router de cancelaciones.

Endpoints:
  GET    /cancellation-policies              → listar políticas del tenant
  POST   /cancellation-policies              → crear política (company_admin)
  GET    /cancellation-policies/{id}         → detalle de política
  PUT    /cancellation-policies/{id}         → actualizar política (company_admin)
  DELETE /cancellation-policies/{id}         → eliminar política (company_admin)

  GET    /reservations/{id}/refund-preview   → calcular reembolso sin cancelar
  POST   /reservations/{id}/cancel           → cancelar + generar RefundOrder

  GET    /refund-orders                      → listar órdenes (company_admin)
  PATCH  /refund-orders/{id}/process         → marcar como procesada/rechazada

Control de acceso:
  - Gestión de políticas: company_admin y super_admin.
  - Cancelación: cualquier rol autenticado del tenant.
  - Gestión de órdenes: company_admin y super_admin.

El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.cancellation import RefundOrderStatus
from app.models.user import User, UserRole
from app.schemas.cancellation import (
    CancelReservationRequest,
    CancellationPolicyCreate,
    CancellationPolicyRead,
    CancellationPolicyUpdate,
    PaginatedRefundOrders,
    RefundOrderProcess,
    RefundOrderRead,
    RefundPreview,
)
from app.schemas.reservation import ReservationRead
from app.services import cancellation_service

router = APIRouter(tags=["Cancelaciones"])


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


# ─── Políticas de cancelación ─────────────────────────────────────────────────


@router.get(
    "/cancellation-policies",
    response_model=list[CancellationPolicyRead],
    summary="Listar políticas de cancelación",
)
async def list_policies(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[CancellationPolicyRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.list_policies(session=session, tenant_id=effective_tenant_id)


@router.post(
    "/cancellation-policies",
    response_model=CancellationPolicyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear política de cancelación",
    description=(
        "Crea una política con tres tramos de reembolso. "
        "Si accommodation_type_id es None, aplica a todos los tipos del tenant."
    ),
)
async def create_policy(
    data: CancellationPolicyCreate,
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> CancellationPolicyRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.create_policy(
        session=session, data=data, tenant_id=effective_tenant_id
    )


@router.get(
    "/cancellation-policies/{policy_id}",
    response_model=CancellationPolicyRead,
    summary="Detalle de política de cancelación",
)
async def get_policy(
    policy_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> CancellationPolicyRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.get_policy(
        session=session, policy_id=policy_id, tenant_id=effective_tenant_id
    )


@router.put(
    "/cancellation-policies/{policy_id}",
    response_model=CancellationPolicyRead,
    summary="Actualizar política de cancelación",
)
async def update_policy(
    policy_id: UUID,
    data: CancellationPolicyUpdate,
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> CancellationPolicyRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.update_policy(
        session=session, policy_id=policy_id, data=data, tenant_id=effective_tenant_id
    )


@router.delete(
    "/cancellation-policies/{policy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar política de cancelación",
)
async def delete_policy(
    policy_id: UUID,
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await cancellation_service.delete_policy(
        session=session, policy_id=policy_id, tenant_id=effective_tenant_id
    )


# ─── Preview y cancelación de reservas ───────────────────────────────────────


@router.get(
    "/reservations/{reservation_id}/refund-preview",
    response_model=RefundPreview,
    summary="Preview del reembolso por cancelación",
    description=(
        "Calcula cuánto se reembolsaría si se cancelara la reserva ahora mismo. "
        "No ejecuta la cancelación."
    ),
)
async def refund_preview(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> RefundPreview:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.preview_refund(
        session=session,
        reservation_id=reservation_id,
        tenant_id=effective_tenant_id,
    )


@router.post(
    "/reservations/{reservation_id}/cancel",
    response_model=dict,
    summary="Cancelar reserva",
    description=(
        "Cancela la reserva y genera una orden de devolución según la política activa. "
        "Devuelve la reserva actualizada y la orden de devolución creada."
    ),
)
async def cancel_reservation(
    reservation_id: UUID,
    data: CancelReservationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> dict:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    reservation, refund_order = await cancellation_service.cancel_reservation(
        session=session,
        reservation_id=reservation_id,
        data=data,
        tenant_id=effective_tenant_id,
    )
    return {
        "reservation": reservation.model_dump(mode="json"),
        "refund_order": refund_order.model_dump(mode="json"),
    }


# ─── Órdenes de devolución ────────────────────────────────────────────────────


@router.get(
    "/refund-orders",
    response_model=PaginatedRefundOrders,
    summary="Listar órdenes de devolución",
)
async def list_refund_orders(
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    status_filter: RefundOrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PaginatedRefundOrders:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.list_refund_orders(
        session=session,
        tenant_id=effective_tenant_id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/refund-orders/{order_id}/process",
    response_model=RefundOrderRead,
    summary="Procesar o rechazar una orden de devolución",
    description=(
        "Marca la orden como 'processed' (reembolso ejecutado) o 'rejected'. "
        "Solo puede procesarse desde estado 'pending'."
    ),
)
async def process_refund_order(
    order_id: UUID,
    data: RefundOrderProcess,
    current_user: Annotated[
        User, Depends(require_role(UserRole.company_admin, UserRole.super_admin))
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> RefundOrderRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await cancellation_service.process_refund_order(
        session=session,
        order_id=order_id,
        data=data,
        tenant_id=effective_tenant_id,
    )
