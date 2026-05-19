"""Servicio de auditoría — registra eventos de reservas."""

from typing import Any
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.reservation_history import ReservationHistory
from app.models.user import User


async def log_reservation_event(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
    user: User,
    action: str,
    description: str,
    changes: dict[str, Any] | None = None,
) -> None:
    """
    Registra un evento en el historial de la reserva.
    El commit lo realiza el caller para poder agrupar en la misma transacción.
    """
    entry = ReservationHistory(
        reservation_id=reservation_id,
        tenant_id=tenant_id,
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role.value,
        action=action,
        description=description,
        changes=changes,
    )
    session.add(entry)


async def get_reservation_history(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> list[ReservationHistory]:
    """Devuelve el historial de una reserva ordenado del más reciente al más antiguo."""
    result = await session.exec(
        select(ReservationHistory)
        .where(
            ReservationHistory.reservation_id == reservation_id,
            ReservationHistory.tenant_id == tenant_id,
        )
        .order_by(ReservationHistory.created_at.desc())  # type: ignore[attr-defined]
    )
    return list(result.all())
