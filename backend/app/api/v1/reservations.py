"""
Router de reservas.

Control de acceso:
- GET y POST /availability: cualquier rol autenticado del tenant.
- GET /reservations y GET /reservations/{id}: cualquier rol autenticado.
- POST /reservations: cualquier rol autenticado.
- PATCH /reservations/{id}: cualquier rol autenticado (editar datos del huésped).
- PATCH /reservations/{id}/status: solo company_admin y super_admin.

El tenant_id se extrae del JWT. El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
"""

import calendar
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select, func, and_
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.accommodation import AccommodationUnit
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.schemas.reservation import (
    AvailabilityRequest,
    AvailabilityResult,
    PaginatedReservations,
    ReservationCreate,
    ReservationHistoryEntry,
    ReservationRead,
    ReservationStatusUpdate,
    ReservationUpdate,
)
from app.services import reservation_service
from app.services import history_service
from app.services import guest_doc_service

router = APIRouter(tags=["Reservas"])


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


# ─── Disponibilidad ───────────────────────────────────────────────────────────


@router.post(
    "/reservations/availability",
    response_model=AvailabilityResult,
    summary="Consultar disponibilidad",
    description=(
        "Devuelve todas las unidades del tipo con su disponibilidad para el rango "
        "solicitado, junto con un preview de precio si el tipo tiene pricing model."
    ),
)
async def check_availability(
    data: AvailabilityRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AvailabilityResult:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await reservation_service.get_availability(
        session=session,
        request=data,
        tenant_id=effective_tenant_id,
    )


# ─── Listado y creación ───────────────────────────────────────────────────────


@router.get(
    "/reservations",
    response_model=PaginatedReservations,
    summary="Listar reservas",
    description="Lista paginada de reservas del tenant con filtros opcionales.",
)
async def list_reservations(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    status_filter: ReservationStatus | None = Query(default=None, alias="status"),
    unit_id: UUID | None = Query(default=None),
    date_from: str | None = Query(default=None, description="Formato YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="Formato YYYY-MM-DD"),
    search: str | None = Query(default=None, description="Busca en nombre, email o ID"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PaginatedReservations:
    from datetime import date

    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)

    date_from_parsed: date | None = (
        date.fromisoformat(date_from) if date_from else None
    )
    date_to_parsed: date | None = (
        date.fromisoformat(date_to) if date_to else None
    )

    return await reservation_service.get_reservations(
        session=session,
        tenant_id=effective_tenant_id,
        status_filter=status_filter,
        unit_id=unit_id,
        date_from=date_from_parsed,
        date_to=date_to_parsed,
        search=search or None,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/reservations",
    response_model=ReservationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear reserva",
    description=(
        "Crea una nueva reserva verificando disponibilidad y calculando el precio. "
        "El precio queda fijo al momento de la creación (snapshot)."
    ),
)
async def create_reservation(
    data: ReservationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await reservation_service.create_reservation(
        session=session,
        data=data,
        tenant_id=effective_tenant_id,
    )
    await history_service.log_reservation_event(
        session=session,
        reservation_id=result.id,
        tenant_id=effective_tenant_id,
        user=current_user,
        action="created",
        description=f"Reserva creada para {result.guest_name} ({result.check_in} → {result.check_out}, {result.nights} noches)",
    )
    # Generar el token público de carga de documentos de viajeros.
    # Si falla (p. ej. tabla aún sin migrar) no debe romper la reserva.
    try:
        reservation_model = await reservation_service._get_reservation_model(
            session=session,
            reservation_id=result.id,
            tenant_id=effective_tenant_id,
        )
        await guest_doc_service.get_or_create_token(session, reservation_model)
    except Exception:  # noqa: BLE001
        pass
    await session.commit()
    return result


# ─── Stats del dashboard — DEBE ir antes de {reservation_id} ────────────────

@router.get("/reservations/stats", summary="KPIs para el dashboard")
async def get_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None),
) -> dict:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    today = date.today()

    # Total unidades activas
    units_result = await session.exec(
        select(func.count(AccommodationUnit.id)).where(
            AccommodationUnit.tenant_id == effective_tenant_id,
            AccommodationUnit.is_active == True,  # noqa: E712
        )
    )
    total_units = units_result.one() or 0

    # Reservas activas (confirmed + pending_payment + checked_in)
    active_statuses = [ReservationStatus.confirmed, ReservationStatus.pending_payment, ReservationStatus.checked_in]
    active_result = await session.exec(
        select(func.count(Reservation.id)).where(
            Reservation.tenant_id == effective_tenant_id,
            Reservation.status.in_(active_statuses),  # type: ignore[attr-defined]
        )
    )
    active_reservations = active_result.one() or 0

    # Huéspedes en casa hoy (check_in <= today < check_out y checked_in)
    guests_result = await session.exec(
        select(func.coalesce(func.sum(Reservation.num_persons), 0)).where(
            Reservation.tenant_id == effective_tenant_id,
            Reservation.status == ReservationStatus.checked_in,
            Reservation.check_in <= today,
            Reservation.check_out > today,
        )
    )
    guests_in_house = int(guests_result.one() or 0)

    # Unidades ocupadas hoy (confirmed + checked_in que solapan con hoy)
    occupied_result = await session.exec(
        select(func.count(Reservation.id)).where(
            Reservation.tenant_id == effective_tenant_id,
            Reservation.status.in_([ReservationStatus.confirmed, ReservationStatus.checked_in]),  # type: ignore[attr-defined]
            Reservation.check_in <= today,
            Reservation.check_out > today,
        )
    )
    occupied_today = int(occupied_result.one() or 0)
    occupancy_pct = round(occupied_today / total_units * 100) if total_units > 0 else 0

    return {
        "total_units": total_units,
        "active_reservations": active_reservations,
        "guests_in_house": guests_in_house,
        "occupancy_pct_today": occupancy_pct,
        "occupied_units_today": occupied_today,
    }


# ─── Calendario de ocupación — DEBE ir antes de {reservation_id} ─────────────

# Statuses que cuentan como "unidad ocupada" para el % de ocupación
_OCCUPANCY_STATUSES = {
    ReservationStatus.confirmed,
    ReservationStatus.pending_payment,
    ReservationStatus.checked_in,
}


def _res_to_dict(r: Reservation) -> dict:
    return {
        "id": str(r.id),
        "guest_name": r.guest_name or "Sin nombre",
        "check_in": r.check_in.isoformat(),
        "check_out": r.check_out.isoformat(),
        "num_persons": r.num_persons,
        "status": r.status.value,
        "unit_id": str(r.unit_id) if r.unit_id else None,
        "total_price": float(r.total_price) if r.total_price else None,
        "nights": r.nights,
    }


@router.get(
    "/reservations/calendar",
    summary="Calendario de ocupación mensual",
)
async def get_calendar(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    year: int = Query(default=..., ge=2020, le=2100),
    month: int = Query(default=..., ge=1, le=12),
    tenant_id: UUID | None = Query(default=None),
    accommodation_type_id: UUID | None = Query(default=None, description="Filtrar por tipo de alojamiento"),
    status_filter: str | None = Query(default=None, alias="status", description="Filtrar por estado"),
) -> dict:
    from datetime import timedelta
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)

    # Rango del mes
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])

    # Total de unidades activas (del tipo si se filtra)
    units_query = select(func.count(AccommodationUnit.id)).where(
        AccommodationUnit.tenant_id == effective_tenant_id,
        AccommodationUnit.is_active == True,  # noqa: E712
    )
    if accommodation_type_id:
        units_query = units_query.where(AccommodationUnit.accommodation_type_id == accommodation_type_id)
    units_result = await session.exec(units_query)
    total_units = units_result.one() or 1

    # TODAS las reservas que solapan con el mes
    res_query = select(Reservation).where(
        Reservation.tenant_id == effective_tenant_id,
        Reservation.check_in <= last_day,
        Reservation.check_out > first_day,
    )
    if accommodation_type_id:
        res_query = res_query.where(Reservation.accommodation_type_id == accommodation_type_id)

    res_result = await session.exec(res_query)
    all_reservations = res_result.all()

    # Parsear status_filter para mostrar en UI (no afecta ocupación)
    display_status: ReservationStatus | None = None
    if status_filter:
        try:
            display_status = ReservationStatus(status_filter)
        except ValueError:
            pass

    # Construir mapa día → reservas
    non_cancelled = {ReservationStatus.cancelled, ReservationStatus.no_show}
    days: list[dict] = []
    current = first_day
    while current <= last_day:
        occupancy_res = [
            r for r in all_reservations
            if r.check_in <= current < r.check_out and r.status in _OCCUPANCY_STATUSES
        ]
        day_res = [
            r for r in all_reservations
            if r.check_in <= current < r.check_out
        ]
        if display_status is not None:
            day_res = [r for r in day_res if r.status == display_status]

        check_ins = [r for r in all_reservations if r.check_in == current and r.status not in non_cancelled]
        check_outs = [r for r in all_reservations if r.check_out == current and r.status not in non_cancelled]

        occupied = len(occupancy_res)
        occupancy_pct = round(occupied / total_units * 100) if total_units > 0 else 0

        days.append({
            "date": current.isoformat(),
            "weekday": current.weekday(),
            "occupied_units": occupied,
            "total_units": total_units,
            "occupancy_pct": occupancy_pct,
            "check_ins": len(check_ins),
            "check_outs": len(check_outs),
            "reservations": [_res_to_dict(r) for r in day_res],
        })
        current += timedelta(days=1)

    active_res = [r for r in all_reservations if r.status in _OCCUPANCY_STATUSES]
    total_check_ins = sum(1 for r in active_res if first_day <= r.check_in <= last_day)
    avg_occupancy = round(sum(d["occupancy_pct"] for d in days) / len(days)) if days else 0
    total_revenue = sum(
        float(r.total_price or 0) for r in active_res
        if first_day <= r.check_in <= last_day
    )

    return {
        "year": year,
        "month": month,
        "total_units": total_units,
        "avg_occupancy_pct": avg_occupancy,
        "total_check_ins": total_check_ins,
        "total_reservations": len(active_res),
        "total_revenue": round(total_revenue, 2),
        "days": days,
    }


# ─── Operaciones por ID ───────────────────────────────────────────────────────


@router.get(
    "/reservations/{reservation_id}",
    response_model=ReservationRead,
    summary="Detalle de reserva",
)
async def get_reservation(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await reservation_service.get_reservation(
        session=session,
        reservation_id=reservation_id,
        tenant_id=effective_tenant_id,
    )


@router.get(
    "/reservations/{reservation_id}/history",
    response_model=list[ReservationHistoryEntry],
    summary="Historial de cambios de una reserva",
    description="Devuelve todos los eventos registrados para esta reserva, del más reciente al más antiguo.",
)
async def get_reservation_history(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[ReservationHistoryEntry]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    # Verify reservation exists and belongs to this tenant
    await reservation_service.get_reservation(
        session=session, reservation_id=reservation_id, tenant_id=effective_tenant_id,
    )
    entries = await history_service.get_reservation_history(
        session=session, reservation_id=reservation_id, tenant_id=effective_tenant_id,
    )
    return [ReservationHistoryEntry.model_validate(e) for e in entries]


@router.patch(
    "/reservations/{reservation_id}",
    response_model=ReservationRead,
    summary="Editar datos del huésped",
    description=(
        "Actualiza nombre, email, teléfono y notas internas. "
        "No permite cambiar fechas, unidad ni estado."
    ),
)
async def update_reservation(
    reservation_id: UUID,
    data: ReservationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await reservation_service.update_reservation(
        session=session,
        reservation_id=reservation_id,
        data=data,
        tenant_id=effective_tenant_id,
    )
    changed_fields = [k for k, v in data.model_dump(exclude_none=True).items() if k != "internal_notes"]
    notes_changed = data.internal_notes is not None
    if changed_fields:
        await history_service.log_reservation_event(
            session=session,
            reservation_id=reservation_id,
            tenant_id=effective_tenant_id,
            user=current_user,
            action="guest_updated",
            description="Datos del huésped actualizados",
            changes={"fields": changed_fields},
        )
    if notes_changed:
        await history_service.log_reservation_event(
            session=session,
            reservation_id=reservation_id,
            tenant_id=effective_tenant_id,
            user=current_user,
            action="notes_updated",
            description="Notas internas actualizadas",
        )
    if changed_fields or notes_changed:
        await session.commit()
    return result


@router.patch(
    "/reservations/{reservation_id}/status",
    response_model=ReservationRead,
    summary="Cambiar estado de reserva",
    description=(
        "Aplica una transición de estado válida. "
        "Solo company_admin y super_admin pueden cambiar estados."
    ),
)
async def update_reservation_status(
    reservation_id: UUID,
    data: ReservationStatusUpdate,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    old_reservation = await reservation_service.get_reservation(
        session=session, reservation_id=reservation_id, tenant_id=effective_tenant_id,
    )
    result = await reservation_service.update_reservation_status(
        session=session,
        reservation_id=reservation_id,
        data=data,
        tenant_id=effective_tenant_id,
    )
    _STATUS_LABELS = {
        "confirmed": "confirmada",
        "checked_in": "en casa",
        "checked_out": "salida registrada",
        "cancelled": "cancelada",
        "no_show": "no presentado",
        "pending_payment": "pendiente de pago",
    }
    old_label = _STATUS_LABELS.get(old_reservation.status, old_reservation.status)
    new_label = _STATUS_LABELS.get(result.status, result.status)
    await history_service.log_reservation_event(
        session=session,
        reservation_id=reservation_id,
        tenant_id=effective_tenant_id,
        user=current_user,
        action="status_changed",
        description=f"Estado cambiado: {old_label} → {new_label}",
        changes={"from": old_reservation.status, "to": result.status},
    )
    await session.commit()
    return result


