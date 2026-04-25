"""
Lógica de negocio para reservas.

Principios:
- tenant_id siempre del JWT, nunca del body de la request.
- Los precios se calculan en el momento de crear la reserva (snapshot inmutable).
- cancelled y no_show no bloquean disponibilidad.
- Las transiciones de estado son estrictas — cualquier otra lanza 422.

Transiciones válidas:
  confirmed   → checked_in, cancelled
  checked_in  → checked_out, no_show
  cancelled   → confirmed (reactivar — verifica disponibilidad de nuevo)
"""

import math
from datetime import date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.accommodation import AccommodationUnit
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.pricing import PriceCalculationRequest
from app.schemas.reservation import (
    AvailabilityRequest,
    AvailabilityResult,
    PaginatedReservations,
    ReservationCreate,
    ReservationRead,
    ReservationStatusUpdate,
    ReservationUpdate,
    UnitAvailability,
)
from app.services import pricing_service


# ─── Transiciones de estado válidas ──────────────────────────────────────────

_VALID_TRANSITIONS: dict[ReservationStatus, set[ReservationStatus]] = {
    ReservationStatus.confirmed: {
        ReservationStatus.checked_in,
        ReservationStatus.cancelled,
    },
    ReservationStatus.checked_in: {
        ReservationStatus.checked_out,
        ReservationStatus.no_show,
    },
    ReservationStatus.cancelled: {
        ReservationStatus.confirmed,
    },
    # Estados finales — sin transiciones salientes
    ReservationStatus.checked_out: set(),
    ReservationStatus.no_show: set(),
    ReservationStatus.pending_payment: {
        ReservationStatus.confirmed,
        ReservationStatus.cancelled,
    },
}

# Estados que NO bloquean disponibilidad
_NON_BLOCKING_STATUSES = {ReservationStatus.cancelled, ReservationStatus.no_show}


# ─── Disponibilidad ───────────────────────────────────────────────────────────


async def check_unit_availability(
    session: AsyncSession,
    unit_id: UUID,
    check_in: date,
    check_out: date,
    tenant_id: UUID,
    exclude_reservation_id: UUID | None = None,
) -> bool:
    """
    Comprueba si una unidad está libre en el rango [check_in, check_out).

    Una unidad está ocupada si existe alguna reserva activa que solape el rango.
    Solapamiento: check_in1 < check_out2 AND check_out1 > check_in2.
    Los estados cancelled y no_show no bloquean.

    Args:
        session: Sesión de BD.
        unit_id: Unidad a verificar.
        check_in: Fecha de entrada (inclusiva).
        check_out: Fecha de salida (exclusiva).
        tenant_id: Tenant del usuario autenticado.
        exclude_reservation_id: Excluir esta reserva (útil en reactivaciones).

    Returns:
        True si la unidad está libre.
    """
    query = select(Reservation).where(
        Reservation.unit_id == unit_id,
        Reservation.tenant_id == tenant_id,
        Reservation.status.notin_(list(_NON_BLOCKING_STATUSES)),
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
    )

    if exclude_reservation_id is not None:
        query = query.where(Reservation.id != exclude_reservation_id)

    result = await session.exec(query)
    conflicting = result.first()
    return conflicting is None


async def get_availability(
    session: AsyncSession,
    request: AvailabilityRequest,
    tenant_id: UUID,
) -> AvailabilityResult:
    """
    Devuelve disponibilidad de todas las unidades activas del tipo solicitado
    junto con un preview de precio.

    Args:
        session: Sesión de BD.
        request: Parámetros de búsqueda.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        AvailabilityResult con disponibilidad por unidad y preview de precio.
    """
    # Obtener unidades activas del tipo con capacidad suficiente para el grupo
    units_result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.accommodation_type_id == request.accommodation_type_id,
            AccommodationUnit.tenant_id == tenant_id,
            AccommodationUnit.is_active.is_(True),
            AccommodationUnit.capacity >= request.num_persons,
        )
    )
    units = list(units_result.all())

    # Comprobar disponibilidad de cada unidad
    unit_availabilities: list[UnitAvailability] = []
    for unit in units:
        is_available = await check_unit_availability(
            session=session,
            unit_id=unit.id,
            check_in=request.check_in,
            check_out=request.check_out,
            tenant_id=tenant_id,
        )
        unit_availabilities.append(
            UnitAvailability(
                unit_id=unit.id,
                unit_name=unit.name,
                capacity=unit.capacity,
                is_available=is_available,
            )
        )

    # Preview de precio — None si el tipo no tiene pricing model configurado
    price_preview = None
    try:
        price_request = PriceCalculationRequest(
            accommodation_type_id=request.accommodation_type_id,
            check_in=request.check_in,
            check_out=request.check_out,
            num_persons=request.num_persons,
            extra_ids=request.selected_extra_ids,
        )
        price_preview = await pricing_service.calculate_price(
            session=session,
            request=price_request,
            tenant_id=tenant_id,
        )
    except HTTPException:
        # Sin pricing model configurado — preview no disponible
        price_preview = None

    return AvailabilityResult(
        available_units=unit_availabilities,
        price_preview=price_preview,
    )


# ─── CRUD de reservas ─────────────────────────────────────────────────────────


async def create_reservation(
    session: AsyncSession,
    data: ReservationCreate,
    tenant_id: UUID,
) -> ReservationRead:
    """
    Crea una nueva reserva verificando disponibilidad y calculando el precio.

    Pasos:
    1. Verificar que la unidad existe y pertenece al tenant.
    2. Verificar disponibilidad — 409 si ocupada.
    3. Calcular precio con snapshot inmutable.
    4. Persistir la reserva con status=confirmed.

    Args:
        session: Sesión de BD.
        data: Datos de la nueva reserva.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        ReservationRead de la reserva creada.

    Raises:
        HTTPException 404: Si la unidad no existe en el tenant.
        HTTPException 409: Si la unidad no está disponible.
        HTTPException 404: Si no hay pricing model — el precio no se puede calcular.
    """
    # 1. Verificar que la unidad existe y pertenece al tenant y al tipo indicado
    unit_result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.id == data.unit_id,
            AccommodationUnit.tenant_id == tenant_id,
            AccommodationUnit.accommodation_type_id == data.accommodation_type_id,
            AccommodationUnit.is_active.is_(True),
        )
    )
    unit = unit_result.first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "UNIT_NOT_FOUND",
                    "message": f"Unidad {data.unit_id} no encontrada o inactiva.",
                }
            },
        )

    # 2. Verificar disponibilidad
    is_available = await check_unit_availability(
        session=session,
        unit_id=data.unit_id,
        check_in=data.check_in,
        check_out=data.check_out,
        tenant_id=tenant_id,
    )
    if not is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "UNIT_NOT_AVAILABLE",
                    "message": (
                        f"La unidad '{unit.name}' no está disponible "
                        f"del {data.check_in} al {data.check_out}."
                    ),
                }
            },
        )

    # 3. Calcular precio (snapshot)
    price_request = PriceCalculationRequest(
        accommodation_type_id=data.accommodation_type_id,
        check_in=data.check_in,
        check_out=data.check_out,
        num_persons=data.num_persons,
        extra_ids=data.selected_extra_ids,
    )
    price_result = await pricing_service.calculate_price(
        session=session,
        request=price_request,
        tenant_id=tenant_id,
    )

    # 4. Crear la reserva
    reservation = Reservation(
        tenant_id=tenant_id,
        accommodation_type_id=data.accommodation_type_id,
        unit_id=data.unit_id,
        guest_name=data.guest_name,
        guest_email=str(data.guest_email),
        guest_phone=data.guest_phone,
        check_in=data.check_in,
        check_out=data.check_out,
        num_persons=data.num_persons,
        nights=price_result.nights,
        base_price=price_result.base_price,
        extras_price=price_result.extras_price,
        total_price=price_result.total_price,
        currency=price_result.currency,
        selected_extra_ids=[str(eid) for eid in data.selected_extra_ids],
        internal_notes=data.internal_notes,
        status=ReservationStatus.confirmed,
    )

    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    return ReservationRead.model_validate(reservation)


async def get_reservations(
    session: AsyncSession,
    tenant_id: UUID,
    status_filter: ReservationStatus | None = None,
    unit_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedReservations:
    """
    Lista reservas del tenant con filtros opcionales y paginación.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        status_filter: Filtrar por estado.
        unit_id: Filtrar por unidad.
        date_from: Solo reservas con check_in >= date_from.
        date_to: Solo reservas con check_in <= date_to.
        search: Busca en nombre, email o prefijo de ID.
        page: Página actual (base 1).
        page_size: Registros por página.

    Returns:
        PaginatedReservations con items y metadatos de paginación.
    """
    from sqlalchemy import or_, cast, String
    query = select(Reservation).where(Reservation.tenant_id == tenant_id)

    if status_filter is not None:
        query = query.where(Reservation.status == status_filter)
    if unit_id is not None:
        query = query.where(Reservation.unit_id == unit_id)
    if date_from is not None:
        query = query.where(Reservation.check_in >= date_from)
    if date_to is not None:
        query = query.where(Reservation.check_in <= date_to)
    if search:
        term = f"%{search.strip()}%"
        id_term = f"{search.strip().lower()}%"
        query = query.where(
            or_(
                Reservation.guest_name.ilike(term),  # type: ignore[attr-defined]
                Reservation.guest_email.ilike(term),  # type: ignore[attr-defined]
                cast(Reservation.id, String).ilike(id_term),  # type: ignore[attr-defined]
            )
        )

    # Contar total para paginación
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.exec(count_query)
    total = total_result.one()

    # Aplicar paginación y ordenar por check_in desc
    offset = (page - 1) * page_size
    items_result = await session.exec(
        query.order_by(Reservation.check_in.desc()).offset(offset).limit(page_size)
    )
    items = list(items_result.all())

    pages = max(1, math.ceil(total / page_size))

    return PaginatedReservations(
        items=[ReservationRead.model_validate(r) for r in items],
        total=total,
        page=page,
        pages=pages,
    )


async def get_reservation(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> ReservationRead:
    """
    Obtiene una reserva por ID verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe.
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
    return ReservationRead.model_validate(reservation)


async def _get_reservation_model(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> Reservation:
    """Devuelve el modelo ORM de una reserva o lanza 404."""
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
    return reservation


async def update_reservation(
    session: AsyncSession,
    reservation_id: UUID,
    data: ReservationUpdate,
    tenant_id: UUID,
) -> ReservationRead:
    """
    Actualiza los datos editables del huésped y notas internas.

    No permite cambiar fechas, unidad, precios ni estado por esta vía.

    Args:
        session: Sesión de BD.
        reservation_id: ID de la reserva a actualizar.
        data: Campos a actualizar (todos opcionales).
        tenant_id: Tenant del usuario autenticado.

    Returns:
        ReservationRead actualizado.
    """
    reservation = await _get_reservation_model(session, reservation_id, tenant_id)

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        # EmailStr se serializa como objeto — convertir a str
        setattr(reservation, field, str(value) if field == "guest_email" else value)

    reservation.updated_at = datetime.utcnow()
    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    return ReservationRead.model_validate(reservation)


async def update_reservation_status(
    session: AsyncSession,
    reservation_id: UUID,
    data: ReservationStatusUpdate,
    tenant_id: UUID,
) -> ReservationRead:
    """
    Cambia el estado de una reserva aplicando las reglas de transición.

    Transiciones válidas:
      confirmed   → checked_in, cancelled
      checked_in  → checked_out, no_show
      cancelled   → confirmed (verifica disponibilidad de nuevo)

    Args:
        session: Sesión de BD.
        reservation_id: ID de la reserva.
        data: Nuevo estado y nota opcional.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        ReservationRead con el nuevo estado.

    Raises:
        HTTPException 422: Si la transición no es válida.
        HTTPException 409: Si se reactiva desde cancelled y la unidad está ocupada.
    """
    reservation = await _get_reservation_model(session, reservation_id, tenant_id)

    current_status = reservation.status
    new_status = data.status

    # Verificar que la transición es válida
    allowed = _VALID_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_STATUS_TRANSITION",
                    "message": (
                        f"No se puede pasar de '{current_status.value}' "
                        f"a '{new_status.value}'."
                    ),
                }
            },
        )

    # Reactivación desde cancelled: verificar disponibilidad
    if current_status == ReservationStatus.cancelled and new_status == ReservationStatus.confirmed:
        is_available = await check_unit_availability(
            session=session,
            unit_id=reservation.unit_id,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            tenant_id=tenant_id,
            exclude_reservation_id=reservation.id,
        )
        if not is_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "UNIT_NOT_AVAILABLE",
                        "message": (
                            "No se puede reactivar la reserva: "
                            "la unidad ya no está disponible en esas fechas."
                        ),
                    }
                },
            )

    reservation.status = new_status
    if data.internal_notes is not None:
        reservation.internal_notes = data.internal_notes
    reservation.updated_at = datetime.utcnow()

    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    return ReservationRead.model_validate(reservation)
