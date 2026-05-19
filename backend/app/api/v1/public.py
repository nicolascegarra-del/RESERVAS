"""
Router público — accesible sin autenticación.

Permite a los clientes finales consultar disponibilidad, precios y crear reservas
sin necesidad de token JWT. El tenant se identifica por su slug en la URL.
"""

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import limiter
from app.models.accommodation import AccommodationUnit, AccommodationType
from app.models.cancellation import CancellationPolicy
from app.models.reservation import Reservation, ReservationStatus
from app.models.tenant import Tenant
from app.schemas.pricing import PriceCalculationRequest
from app.schemas.public import (
    PublicAccommodationType,
    PublicAvailabilityRequest,
    PublicCancelPreview,
    PublicConfirmInfo,
    PublicReservationCreate,
    PublicReservationResponse,
    PublicTypeAvailability,
    PublicUnitAvailability,
)
from app.services import pricing_service, reservation_service
from app.services import stripe_service
from app.schemas.reservation import AvailabilityRequest
from app.schemas.tenant import TenantBrandingRead

router = APIRouter(prefix="/public", tags=["Público"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class PublicTenantInfo(BaseModel):
    slug: str
    name: str
    logo_url: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None


@router.get(
    "/tenants",
    response_model=list[PublicTenantInfo],
    summary="Lista de tenants públicos activos",
    description="Devuelve todos los tenants activos para el selector de empresa en la landing.",
)
async def list_public_tenants(session: SessionDep) -> list[PublicTenantInfo]:
    result = await session.exec(
        select(Tenant).where(Tenant.is_active == True).order_by(Tenant.name)  # noqa: E712
    )
    tenants = result.all()
    return [
        PublicTenantInfo(
            slug=t.slug,
            name=t.brand_name or t.name,
            logo_url=t.logo_url,
            primary_color=t.primary_color,
            accent_color=t.accent_color,
        )
        for t in tenants
    ]


async def _get_tenant_by_slug(session: AsyncSession, slug: str) -> Tenant:
    """Resuelve el tenant por su slug o lanza 404."""
    result = await session.exec(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    tenant = result.first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"No existe el tenant '{slug}'."}},
        )
    return tenant


@router.get(
    "/{tenant_slug}/branding",
    response_model=TenantBrandingRead,
    summary="Branding público del tenant",
    description="Devuelve la configuración de branding del tenant para personalizar la landing pública.",
)
async def get_public_branding(
    tenant_slug: str,
    session: SessionDep,
) -> TenantBrandingRead:
    tenant = await _get_tenant_by_slug(session, tenant_slug)
    return TenantBrandingRead(
        brand_name=tenant.brand_name,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        accent_color=tenant.accent_color,
        tagline=tenant.tagline,
    )


@router.get(
    "/{tenant_slug}/accommodation-types",
    response_model=list[PublicAccommodationType],
    summary="Tipos de alojamiento disponibles",
    description="Lista los tipos de alojamiento activos del tenant para el buscador público.",
)
async def list_public_accommodation_types(
    tenant_slug: str,
    session: SessionDep,
) -> list[PublicAccommodationType]:
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    result = await session.exec(
        select(AccommodationType).where(
            AccommodationType.tenant_id == tenant.id,
            AccommodationType.is_active == True,  # noqa: E712
        ).order_by(AccommodationType.name)
    )
    types = result.all()

    output: list[PublicAccommodationType] = []
    for t in types:
        # Contar unidades activas
        count_result = await session.exec(
            select(func.count(AccommodationUnit.id)).where(
                AccommodationUnit.accommodation_type_id == t.id,
                AccommodationUnit.is_active == True,  # noqa: E712
            )
        )
        count = count_result.one()
        output.append(
            PublicAccommodationType(
                id=t.id,
                name=t.name,
                type_category=t.type_category.value if hasattr(t.type_category, "value") else t.type_category,
                description=t.description,
                active_unit_count=count,
            )
        )
    return output


@router.post(
    "/{tenant_slug}/availability",
    response_model=list[PublicTypeAvailability],
    summary="Consultar disponibilidad pública",
    description=(
        "Devuelve los tipos de alojamiento con unidades disponibles para las fechas "
        "y número de personas indicados. Filtra automáticamente los alojamientos con "
        "capacidad insuficiente y los que ya están reservados."
    ),
)
async def public_availability(
    tenant_slug: str,
    data: PublicAvailabilityRequest,
    session: SessionDep,
) -> list[PublicTypeAvailability]:
    tenant = await _get_tenant_by_slug(session, tenant_slug)
    tenant_id: UUID = tenant.id

    # Determinar qué tipos consultar
    if data.accommodation_type_id:
        # Verificar que el tipo pertenece al tenant
        type_result = await session.exec(
            select(AccommodationType).where(
                AccommodationType.id == data.accommodation_type_id,
                AccommodationType.tenant_id == tenant_id,
                AccommodationType.is_active == True,  # noqa: E712
            )
        )
        accom_type = type_result.first()
        if not accom_type:
            return []
        types_to_check = [accom_type]
    else:
        # Todos los tipos activos del tenant
        all_result = await session.exec(
            select(AccommodationType).where(
                AccommodationType.tenant_id == tenant_id,
                AccommodationType.is_active == True,  # noqa: E712
            ).order_by(AccommodationType.name)
        )
        types_to_check = list(all_result.all())

    output: list[PublicTypeAvailability] = []

    for accom_type in types_to_check:
        # Obtener unidades activas del tipo
        units_result = await session.exec(
            select(AccommodationUnit).where(
                AccommodationUnit.accommodation_type_id == accom_type.id,
                AccommodationUnit.tenant_id == tenant_id,
                AccommodationUnit.is_active == True,  # noqa: E712
            )
        )
        all_units = list(units_result.all())

        if not all_units:
            continue

        # Calcular rango de capacidad del tipo
        capacities = [u.capacity for u in all_units]
        min_cap = min(capacities)
        max_cap = max(capacities)

        # Filtrar unidades con capacidad suficiente para las personas solicitadas
        eligible_units = [u for u in all_units if u.capacity >= data.num_persons]

        if not eligible_units:
            # Ninguna unidad puede alojar el nº de personas → excluir tipo
            continue

        # Comprobar disponibilidad de cada unidad elegible
        unit_availabilities: list[PublicUnitAvailability] = []
        has_any_available = False

        for unit in eligible_units:
            is_available = await reservation_service.check_unit_availability(
                session=session,
                unit_id=unit.id,
                check_in=data.check_in,
                check_out=data.check_out,
                tenant_id=tenant_id,
            )
            if is_available:
                has_any_available = True
            unit_availabilities.append(
                PublicUnitAvailability(
                    unit_id=unit.id,
                    unit_name=unit.name,
                    capacity=unit.capacity,
                    is_available=is_available,
                )
            )

        if not has_any_available:
            # Todas las unidades elegibles están ocupadas → excluir tipo
            continue

        # Calcular precio preview
        price_preview = None
        min_price_per_night = None
        try:
            price_request = PriceCalculationRequest(
                accommodation_type_id=accom_type.id,
                check_in=data.check_in,
                check_out=data.check_out,
                num_persons=data.num_persons,
                extra_ids=[],
            )
            price_preview = await pricing_service.calculate_price(
                session=session,
                request=price_request,
                tenant_id=tenant_id,
            )
            # Precio mínimo por noche: primer tramo del breakdown
            if price_preview and price_preview.breakdown:
                min_price_per_night = price_preview.breakdown[0].price_per_night
        except Exception:
            price_preview = None
            min_price_per_night = None

        category = accom_type.type_category.value if hasattr(accom_type.type_category, "value") else str(accom_type.type_category)

        output.append(
            PublicTypeAvailability(
                type_id=accom_type.id,
                type_name=accom_type.name,
                type_category=category,
                description=accom_type.description,
                available_units=unit_availabilities,
                price_preview=price_preview,
                min_price_per_night=min_price_per_night,
                min_capacity=min_cap,
                max_capacity=max_cap,
            )
        )

    return output


# ─── Reservas públicas ────────────────────────────────────────────────────────


def _calculate_refund_preview(
    total_paid: Decimal,
    days_before: int,
    policy: CancellationPolicy | None,
) -> tuple[Decimal, str]:
    """Calcula el reembolso estimado y una descripción legible."""
    if policy is None:
        return Decimal("0.00"), "Sin política de cancelación — consulta las condiciones."

    if days_before >= policy.full_refund_days:
        return total_paid, f"Reembolso completo (100%) — cancelación con {days_before} días de antelación."

    if days_before >= policy.partial_refund_days:
        pct = Decimal(str(policy.partial_refund_percentage)) / Decimal("100")
        amount = (total_paid * pct).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return amount, f"Reembolso parcial ({policy.partial_refund_percentage}%) — cancelación con {days_before} días de antelación."

    return Decimal("0.00"), f"Sin reembolso — cancelación con menos de {policy.partial_refund_days} días de antelación."


@router.post(
    "/{tenant_slug}/reservations",
    response_model=PublicReservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear reserva pública",
)
@limiter.limit("5/minute")
async def create_public_reservation(
    request: Request,
    tenant_slug: str,
    data: PublicReservationCreate,
    session: SessionDep,
) -> PublicReservationResponse:
    """Crea una reserva y devuelve la URL de pago de Stripe."""
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    if not tenant.stripe_enabled or not tenant.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "STRIPE_NOT_CONFIGURED", "message": "El pago online no está disponible para este alojamiento."}},
        )

    # Verificar disponibilidad de la unidad
    is_available = await reservation_service.check_unit_availability(
        session=session,
        unit_id=data.unit_id,
        check_in=data.check_in,
        check_out=data.check_out,
        tenant_id=tenant.id,
    )
    if not is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "UNIT_NOT_AVAILABLE", "message": "La unidad ya no está disponible para esas fechas."}},
        )

    # Calcular precio
    price_result = await pricing_service.calculate_price(
        session=session,
        request=PriceCalculationRequest(
            accommodation_type_id=data.accommodation_type_id,
            check_in=data.check_in,
            check_out=data.check_out,
            num_persons=data.num_persons,
            extra_ids=[],
        ),
        tenant_id=tenant.id,
    )

    # Obtener nombre de la unidad
    unit_result = await session.exec(select(AccommodationUnit).where(AccommodationUnit.id == data.unit_id))
    unit = unit_result.first()
    unit_name = unit.name if unit else "Alojamiento"

    # Crear reserva con estado pending_payment
    reservation = Reservation(
        tenant_id=tenant.id,
        accommodation_type_id=data.accommodation_type_id,
        unit_id=data.unit_id,
        guest_name=data.guest_name,
        guest_email=data.guest_email,
        guest_phone=data.guest_phone,
        guest_id_type=data.guest_id_type,
        guest_id_number=data.guest_id_number,
        guest_address=data.guest_address,
        guest_postal_code=data.guest_postal_code,
        guest_city=data.guest_city,
        guest_region=data.guest_region,
        guest_country=data.guest_country,
        check_in=data.check_in,
        check_out=data.check_out,
        num_persons=data.num_persons,
        nights=price_result.nights,
        base_price=price_result.base_price,
        extras_price=price_result.extras_price,
        total_price=price_result.total_price,
        currency=price_result.currency,
        selected_extra_ids=[],
        status=ReservationStatus.pending_payment,
    )
    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    await session.refresh(tenant)

    # Crear Stripe Checkout Session
    success_url = f"{settings.frontend_url}/reserva/exito?reservation_id={reservation.id}"
    cancel_url = f"{settings.frontend_url}/reserva/cancelar/{reservation.cancel_token}"

    try:
        checkout_url = stripe_service.create_checkout_session(
            reservation=reservation,
            tenant=tenant,
            unit_name=unit_name,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as exc:
        # Si falla Stripe, cancelar la reserva para liberar la unidad
        reservation.status = ReservationStatus.cancelled
        session.add(reservation)
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "PAYMENT_UNAVAILABLE", "message": "No fue posible iniciar el pago. Inténtalo de nuevo en unos minutos."}},
        ) from exc

    return PublicReservationResponse(
        reservation_id=reservation.id,
        stripe_checkout_url=checkout_url,
    )


@router.get(
    "/{tenant_slug}/cancel/{cancel_token}",
    response_model=PublicCancelPreview,
    summary="Preview de cancelación pública",
)
async def get_cancel_preview(
    tenant_slug: str,
    cancel_token: UUID,
    session: SessionDep,
) -> PublicCancelPreview:
    """Devuelve datos de la reserva y estimación de reembolso."""
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    result = await session.exec(
        select(Reservation).where(
            Reservation.cancel_token == cancel_token,
            Reservation.tenant_id == tenant.id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESERVATION_NOT_FOUND", "message": "Reserva no encontrada."}})

    # Buscar política de cancelación
    policy_result = await session.exec(
        select(CancellationPolicy).where(
            CancellationPolicy.tenant_id == tenant.id,
            CancellationPolicy.accommodation_type_id.is_(None),
            CancellationPolicy.is_active.is_(True),
        )
    )
    policy = policy_result.first()

    days_until = (reservation.check_in - date.today()).days
    refund_amount, refund_description = _calculate_refund_preview(
        reservation.total_price, max(0, days_until), policy
    )

    return PublicCancelPreview(
        reservation_id=reservation.id,
        guest_name=reservation.guest_name,
        guest_email=reservation.guest_email,
        check_in=reservation.check_in,
        check_out=reservation.check_out,
        num_persons=reservation.num_persons,
        total_price=reservation.total_price,
        currency=reservation.currency,
        status=reservation.status.value,
        policy_name=policy.name if policy else None,
        full_refund_days=policy.full_refund_days if policy else None,
        partial_refund_days=policy.partial_refund_days if policy else None,
        partial_refund_percentage=policy.partial_refund_percentage if policy else None,
        days_until_checkin=days_until,
        estimated_refund=refund_amount,
        refund_description=refund_description,
    )


@router.post(
    "/{tenant_slug}/cancel/{cancel_token}",
    status_code=status.HTTP_200_OK,
    summary="Cancelar reserva pública",
)
async def cancel_public_reservation(
    tenant_slug: str,
    cancel_token: UUID,
    session: SessionDep,
) -> dict:
    """Cancela la reserva del cliente."""
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    result = await session.exec(
        select(Reservation).where(
            Reservation.cancel_token == cancel_token,
            Reservation.tenant_id == tenant.id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESERVATION_NOT_FOUND", "message": "Reserva no encontrada."}})

    if reservation.status not in {ReservationStatus.confirmed, ReservationStatus.pending_payment}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "CANNOT_CANCEL", "message": f"Esta reserva no se puede cancelar (estado: {reservation.status.value})."}},
        )

    reservation.status = ReservationStatus.cancelled
    reservation.updated_at = datetime.utcnow()
    session.add(reservation)
    await session.commit()
    return {"message": "Reserva cancelada correctamente."}


@router.get(
    "/{tenant_slug}/confirm/{confirm_token}",
    response_model=PublicConfirmInfo,
    summary="Info de confirmación de asistencia",
)
async def get_confirm_info(
    tenant_slug: str,
    confirm_token: UUID,
    session: SessionDep,
) -> PublicConfirmInfo:
    """Devuelve información de la reserva para la página de confirmación."""
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    result = await session.exec(
        select(Reservation).where(
            Reservation.confirm_token == confirm_token,
            Reservation.tenant_id == tenant.id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESERVATION_NOT_FOUND", "message": "Reserva no encontrada."}})

    return PublicConfirmInfo(
        reservation_id=reservation.id,
        guest_name=reservation.guest_name,
        check_in=reservation.check_in,
        check_out=reservation.check_out,
        num_persons=reservation.num_persons,
        status=reservation.status.value,
        already_confirmed=reservation.reminder_sent,
    )


@router.post(
    "/{tenant_slug}/confirm/{confirm_token}",
    status_code=status.HTTP_200_OK,
    summary="Confirmar asistencia (recordatorio)",
)
async def confirm_attendance(
    tenant_slug: str,
    confirm_token: UUID,
    session: SessionDep,
) -> dict:
    """El huésped confirma su asistencia desde el enlace del recordatorio."""
    tenant = await _get_tenant_by_slug(session, tenant_slug)

    result = await session.exec(
        select(Reservation).where(
            Reservation.confirm_token == confirm_token,
            Reservation.tenant_id == tenant.id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESERVATION_NOT_FOUND", "message": "Reserva no encontrada."}})

    # Marcar como confirmado por el huésped (reutilizamos reminder_sent como flag)
    if not reservation.reminder_sent:
        reservation.reminder_sent = True
        session.add(reservation)
        await session.commit()

    return {"message": "¡Asistencia confirmada! Te esperamos."}
