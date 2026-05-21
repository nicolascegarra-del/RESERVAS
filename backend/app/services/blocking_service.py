"""Lógica de negocio para bloqueos de unidades de alojamiento."""

from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.accommodation import AccommodationType, AccommodationUnit
from app.models.blocking import Blocking
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.blocking import (
    BlockingConflict,
    BlockingConflictReservation,
    BlockingCreate,
    BlockingRead,
)

_ACTIVE_STATUSES = {
    ReservationStatus.pending_payment,
    ReservationStatus.confirmed,
    ReservationStatus.checked_in,
}


async def _enrich_blocking(
    session: AsyncSession,
    blocking: Blocking,
) -> BlockingRead:
    """Construye BlockingRead enriquecido con nombres de unidad y tipo."""
    unit_result = await session.exec(
        select(AccommodationUnit).where(AccommodationUnit.id == blocking.accommodation_unit_id)
    )
    unit = unit_result.first()
    unit_name = unit.name if unit else "—"

    type_name = "—"
    if unit:
        type_result = await session.exec(
            select(AccommodationType).where(AccommodationType.id == unit.accommodation_type_id)
        )
        acc_type = type_result.first()
        type_name = acc_type.name if acc_type else "—"

    return BlockingRead(
        id=blocking.id,
        tenant_id=blocking.tenant_id,
        accommodation_unit_id=blocking.accommodation_unit_id,
        unit_name=unit_name,
        type_name=type_name,
        start_date=blocking.start_date,
        end_date=blocking.end_date,
        reason=blocking.reason,
        created_at=blocking.created_at,
    )


async def list_blockings(
    session: AsyncSession,
    tenant_id: UUID,
    unit_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[BlockingRead]:
    """Lista bloqueos del tenant con filtros opcionales."""
    query = select(Blocking).where(Blocking.tenant_id == tenant_id)
    if unit_id:
        query = query.where(Blocking.accommodation_unit_id == unit_id)
    if from_date:
        query = query.where(Blocking.end_date >= from_date)
    if to_date:
        query = query.where(Blocking.start_date <= to_date)
    query = query.order_by(Blocking.start_date.desc())

    result = await session.exec(query)
    blockings = result.all()
    return [await _enrich_blocking(session, b) for b in blockings]


async def create_blockings(
    session: AsyncSession,
    data: BlockingCreate,
    tenant_id: UUID,
) -> list[BlockingRead]:
    """
    Crea un bloqueo por cada unidad solicitada.

    Si alguna unidad tiene reservas activas que solapen las fechas,
    rechaza todo el lote y devuelve un 422 con los conflictos.
    """
    # Verificar que todas las unidades pertenecen al tenant
    units_result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.id.in_(data.unit_ids),  # type: ignore[attr-defined]
            AccommodationUnit.tenant_id == tenant_id,
        )
    )
    units = {u.id: u for u in units_result.all()}

    missing = [uid for uid in data.unit_ids if uid not in units]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "UNIT_NOT_FOUND",
                    "message": "Una o más unidades no existen o no pertenecen al tenant.",
                }
            },
        )

    # Buscar reservas activas que solapen con el rango de bloqueo.
    # Bloqueo [start_date, end_date] inclusive. Reserva [check_in, check_out) exclusiva por check_out.
    # Solapamiento: check_in <= end_date AND check_out > start_date
    reservations_result = await session.exec(
        select(Reservation).where(
            Reservation.tenant_id == tenant_id,
            Reservation.unit_id.in_(data.unit_ids),  # type: ignore[attr-defined]
            Reservation.status.in_(list(_ACTIVE_STATUSES)),  # type: ignore[attr-defined]
            Reservation.check_in <= data.end_date,
            Reservation.check_out > data.start_date,
        )
    )
    conflicting_reservations = reservations_result.all()

    if conflicting_reservations:
        # Agrupar por unidad
        conflicts_by_unit: dict[UUID, list[Reservation]] = {}
        for res in conflicting_reservations:
            if res.unit_id not in conflicts_by_unit:
                conflicts_by_unit[res.unit_id] = []
            conflicts_by_unit[res.unit_id].append(res)

        conflicts = [
            BlockingConflict(
                unit_id=unit_id,
                unit_name=units[unit_id].name,
                reservations=[
                    BlockingConflictReservation(
                        id=r.id,
                        guest_name=r.guest_name,
                        check_in=r.check_in,
                        check_out=r.check_out,
                        status=r.status.value,
                    )
                    for r in res_list
                ],
            )
            for unit_id, res_list in conflicts_by_unit.items()
        ]

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "BLOCKING_CONFLICT",
                    "message": "No se pueden bloquear las fechas porque existen reservas activas en ese periodo.",
                    "conflicts": [c.model_dump(mode="json") for c in conflicts],
                }
            },
        )

    # Crear bloqueos
    created: list[Blocking] = []
    for unit_id in data.unit_ids:
        blocking = Blocking(
            tenant_id=tenant_id,
            accommodation_unit_id=unit_id,
            start_date=data.start_date,
            end_date=data.end_date,
            reason=data.reason,
        )
        session.add(blocking)
        created.append(blocking)

    await session.commit()
    for b in created:
        await session.refresh(b)

    return [await _enrich_blocking(session, b) for b in created]


async def delete_blocking(
    session: AsyncSession,
    blocking_id: UUID,
    tenant_id: UUID,
) -> bool:
    """Elimina un bloqueo (hard delete)."""
    result = await session.exec(
        select(Blocking).where(
            Blocking.id == blocking_id,
            Blocking.tenant_id == tenant_id,
        )
    )
    blocking = result.first()
    if not blocking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "BLOCKING_NOT_FOUND",
                    "message": f"Bloqueo {blocking_id} no encontrado.",
                }
            },
        )
    await session.delete(blocking)
    await session.commit()
    return True
