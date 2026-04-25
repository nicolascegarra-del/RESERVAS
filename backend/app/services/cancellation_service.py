"""
Lógica de negocio para políticas de cancelación y órdenes de devolución.

Flujo de cancelación:
1. Obtener la reserva y verificar que se puede cancelar (confirmed/checked_in).
2. Buscar la política aplicable: primero por tipo de alojamiento, luego global.
3. Calcular el reembolso según los días de antelación al check_in.
4. Crear la RefundOrder con el importe calculado.
5. Actualizar el estado de la reserva a 'cancelled'.

Tramos de reembolso (con política activa):
  - días ≥ full_refund_days  → 100% del total pagado
  - días ≥ partial_refund_days (y < full_refund_days) → partial_refund_percentage%
  - días < partial_refund_days → 0%

Sin política: la RefundOrder se crea con refund_percentage=0, amount=0.
El admin puede procesar o rechazar manualmente cada orden.
"""

import math
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.cancellation import CancellationPolicy, RefundOrder, RefundOrderStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.cancellation import (
    CancellationPolicyCreate,
    CancellationPolicyRead,
    CancellationPolicyUpdate,
    CancelReservationRequest,
    PaginatedRefundOrders,
    RefundOrderProcess,
    RefundOrderRead,
    RefundPreview,
)
from app.schemas.reservation import ReservationRead


# ─── Estados cancelables ──────────────────────────────────────────────────────

_CANCELLABLE_STATUSES = {
    ReservationStatus.pending_payment,
    ReservationStatus.confirmed,
}


# ─── Helpers internos ─────────────────────────────────────────────────────────


def _calculate_refund(
    total_paid: Decimal,
    days_before: int,
    policy: CancellationPolicy | None,
) -> tuple[Decimal, int, str]:
    """
    Calcula el importe y porcentaje de reembolso.

    Returns:
        Tuple (refund_amount, refund_percentage, tramo)
        tramo: "full" | "partial" | "none"
    """
    if policy is None or not policy.is_active:
        # Sin política — sin reembolso automático
        return Decimal("0.00"), 0, "none"

    if days_before >= policy.full_refund_days:
        amount = (total_paid * Decimal("1")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return amount, 100, "full"

    if days_before >= policy.partial_refund_days:
        pct = Decimal(str(policy.partial_refund_percentage)) / Decimal("100")
        amount = (total_paid * pct).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return amount, policy.partial_refund_percentage, "partial"

    return Decimal("0.00"), 0, "none"


async def _find_policy(
    session: AsyncSession,
    tenant_id: UUID,
    accommodation_type_id: UUID,
) -> CancellationPolicy | None:
    """
    Busca la política aplicable al tipo de alojamiento.

    Prioridad: política específica del tipo > política global del tenant.
    Solo devuelve políticas activas.
    """
    # Política específica del tipo
    specific_result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.tenant_id == tenant_id,
            CancellationPolicy.accommodation_type_id == accommodation_type_id,
            CancellationPolicy.is_active.is_(True),
        )
    )
    specific = specific_result.first()
    if specific:
        return specific

    # Política global del tenant
    global_result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.tenant_id == tenant_id,
            CancellationPolicy.accommodation_type_id.is_(None),
            CancellationPolicy.is_active.is_(True),
        )
    )
    return global_result.first()


# ─── CRUD de CancellationPolicy ───────────────────────────────────────────────


async def list_policies(
    session: AsyncSession,
    tenant_id: UUID,
) -> list[CancellationPolicyRead]:
    """Lista todas las políticas de cancelación del tenant."""
    result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.tenant_id == tenant_id
        )
    )
    return [CancellationPolicyRead.model_validate(p) for p in result.all()]


async def create_policy(
    session: AsyncSession,
    data: CancellationPolicyCreate,
    tenant_id: UUID,
) -> CancellationPolicyRead:
    """
    Crea una política de cancelación.

    Valida que full_refund_days > partial_refund_days para que los tramos
    tengan sentido lógico.

    Raises:
        HTTPException 422: Si full_refund_days <= partial_refund_days.
    """
    if data.full_refund_days <= data.partial_refund_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_POLICY_TRAMOS",
                    "message": (
                        "'full_refund_days' debe ser mayor que 'partial_refund_days'."
                    ),
                }
            },
        )

    policy = CancellationPolicy(
        tenant_id=tenant_id,
        **data.model_dump(),
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return CancellationPolicyRead.model_validate(policy)


async def get_policy(
    session: AsyncSession,
    policy_id: UUID,
    tenant_id: UUID,
) -> CancellationPolicyRead:
    """
    Obtiene una política por ID.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.id == policy_id,
            CancellationPolicy.tenant_id == tenant_id,
        )
    )
    policy = result.first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "POLICY_NOT_FOUND",
                    "message": f"Política {policy_id} no encontrada.",
                }
            },
        )
    return CancellationPolicyRead.model_validate(policy)


async def update_policy(
    session: AsyncSession,
    policy_id: UUID,
    data: CancellationPolicyUpdate,
    tenant_id: UUID,
) -> CancellationPolicyRead:
    """
    Actualiza una política de cancelación.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 422: Si los tramos resultantes no son válidos.
    """
    result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.id == policy_id,
            CancellationPolicy.tenant_id == tenant_id,
        )
    )
    policy = result.first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "POLICY_NOT_FOUND",
                    "message": f"Política {policy_id} no encontrada.",
                }
            },
        )

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(policy, field, value)

    # Revalidar tramos
    if policy.full_refund_days <= policy.partial_refund_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_POLICY_TRAMOS",
                    "message": (
                        "'full_refund_days' debe ser mayor que 'partial_refund_days'."
                    ),
                }
            },
        )

    policy.updated_at = datetime.utcnow()
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return CancellationPolicyRead.model_validate(policy)


async def delete_policy(
    session: AsyncSession,
    policy_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Elimina una política de cancelación.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.id == policy_id,
            CancellationPolicy.tenant_id == tenant_id,
        )
    )
    policy = result.first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "POLICY_NOT_FOUND",
                    "message": f"Política {policy_id} no encontrada.",
                }
            },
        )
    await session.delete(policy)
    await session.commit()


# ─── Preview y cancelación ────────────────────────────────────────────────────


async def preview_refund(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> RefundPreview:
    """
    Calcula el reembolso estimado sin ejecutar la cancelación.

    Permite mostrar al usuario cuánto recibirá antes de confirmar.

    Raises:
        HTTPException 404: Si la reserva no existe.
        HTTPException 422: Si la reserva no es cancelable.
    """
    result = await session.exec(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": f"Reserva {reservation_id} no encontrada.",
                }
            },
        )

    if reservation.status not in _CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_CANCELLABLE",
                    "message": (
                        f"Una reserva en estado '{reservation.status.value}' "
                        "no puede cancelarse."
                    ),
                }
            },
        )

    today = date.today()
    days_before = max(0, (reservation.check_in - today).days)

    policy = await _find_policy(
        session=session,
        tenant_id=tenant_id,
        accommodation_type_id=reservation.accommodation_type_id,
    )

    refund_amount, refund_pct, tramo = _calculate_refund(
        total_paid=reservation.total_price,
        days_before=days_before,
        policy=policy,
    )

    return RefundPreview(
        reservation_id=reservation_id,
        total_paid=reservation.total_price,
        refund_amount=refund_amount,
        refund_percentage=refund_pct,
        days_before_checkin=days_before,
        policy_name=policy.name if policy else None,
        tramo=tramo,
    )


async def cancel_reservation(
    session: AsyncSession,
    reservation_id: UUID,
    data: CancelReservationRequest,
    tenant_id: UUID,
) -> tuple[ReservationRead, RefundOrderRead]:
    """
    Cancela una reserva y genera la orden de devolución correspondiente.

    Pasos:
    1. Verificar que la reserva existe y es cancelable.
    2. Buscar política aplicable.
    3. Calcular reembolso.
    4. Crear RefundOrder.
    5. Actualizar estado de la reserva a 'cancelled'.

    Returns:
        Tuple (ReservationRead, RefundOrderRead)

    Raises:
        HTTPException 404: Si la reserva no existe.
        HTTPException 422: Si la reserva no es cancelable.
    """
    result = await session.exec(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": f"Reserva {reservation_id} no encontrada.",
                }
            },
        )

    if reservation.status not in _CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_CANCELLABLE",
                    "message": (
                        f"Una reserva en estado '{reservation.status.value}' "
                        "no puede cancelarse."
                    ),
                }
            },
        )

    today = date.today()
    days_before = max(0, (reservation.check_in - today).days)

    policy = await _find_policy(
        session=session,
        tenant_id=tenant_id,
        accommodation_type_id=reservation.accommodation_type_id,
    )

    refund_amount, refund_pct, _tramo = _calculate_refund(
        total_paid=reservation.total_price,
        days_before=days_before,
        policy=policy,
    )

    # Crear la orden de devolución
    refund_order = RefundOrder(
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        cancellation_policy_id=policy.id if policy else None,
        total_paid=reservation.total_price,
        refund_amount=refund_amount,
        refund_percentage=refund_pct,
        days_before_checkin=days_before,
        cancellation_reason=data.cancellation_reason,
        status=RefundOrderStatus.pending,
    )
    session.add(refund_order)

    # Cancelar la reserva
    reservation.status = ReservationStatus.cancelled
    reservation.updated_at = datetime.utcnow()
    session.add(reservation)

    await session.commit()
    await session.refresh(reservation)
    await session.refresh(refund_order)

    return (
        ReservationRead.model_validate(reservation),
        RefundOrderRead.model_validate(refund_order),
    )


# ─── Gestión de RefundOrders ──────────────────────────────────────────────────


async def list_refund_orders(
    session: AsyncSession,
    tenant_id: UUID,
    status_filter: RefundOrderStatus | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedRefundOrders:
    """Lista órdenes de devolución del tenant con filtros y paginación."""
    query = select(RefundOrder).where(RefundOrder.tenant_id == tenant_id)

    if status_filter is not None:
        query = query.where(RefundOrder.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.exec(count_query)
    total = total_result.one()

    offset = (page - 1) * page_size
    items_result = await session.exec(
        query.order_by(RefundOrder.created_at.desc()).offset(offset).limit(page_size)
    )
    items = list(items_result.all())

    pages = max(1, math.ceil(total / page_size))

    return PaginatedRefundOrders(
        items=[RefundOrderRead.model_validate(o) for o in items],
        total=total,
        page=page,
        pages=pages,
    )


async def process_refund_order(
    session: AsyncSession,
    order_id: UUID,
    data: RefundOrderProcess,
    tenant_id: UUID,
) -> RefundOrderRead:
    """
    Marca una orden de devolución como procesada o rechazada.

    Solo se puede procesar una orden en estado 'pending'.

    Raises:
        HTTPException 404: Si la orden no existe.
        HTTPException 422: Si la orden ya está en estado final.
    """
    result = await session.exec(
        select(RefundOrder).where(
            RefundOrder.id == order_id,
            RefundOrder.tenant_id == tenant_id,
        )
    )
    order = result.first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "REFUND_ORDER_NOT_FOUND",
                    "message": f"Orden de devolución {order_id} no encontrada.",
                }
            },
        )

    if order.status != RefundOrderStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "REFUND_ORDER_ALREADY_PROCESSED",
                    "message": (
                        f"La orden ya está en estado '{order.status.value}'."
                    ),
                }
            },
        )

    # Solo 'processed' o 'rejected' son válidos en este endpoint
    if data.status == RefundOrderStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_STATUS",
                    "message": "Solo se puede establecer 'processed' o 'rejected'.",
                }
            },
        )

    order.status = data.status
    order.processed_at = datetime.utcnow()
    if data.notes is not None:
        order.notes = data.notes
    if data.stripe_refund_id is not None:
        order.stripe_refund_id = data.stripe_refund_id
    order.updated_at = datetime.utcnow()

    session.add(order)
    await session.commit()
    await session.refresh(order)
    return RefundOrderRead.model_validate(order)
