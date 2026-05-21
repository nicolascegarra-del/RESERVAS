"""
Lógica de negocio para precios, temporadas y calculadora de reservas.

TODAS las operaciones filtran por tenant_id para garantizar el aislamiento
multi-tenant. El tenant_id SIEMPRE proviene del usuario autenticado (JWT),
nunca del body de la request.

La calculadora recorre noche a noche para aplicar correctamente los precios
de temporada, agrupando tramos consecutivos con el mismo precio en el breakdown.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.accommodation import AccommodationType, Extra
from app.models.pricing import ExtraPrice, PricingModel, Season
from app.schemas.pricing import (
    ExtraPriceCreate,
    ExtraPriceRead,
    ExtraPriceUpdate,
    IvaBreakdownItem,
    PriceBreakdownItem,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingModelCreate,
    PricingModelRead,
    PricingModelWithExtras,
    SeasonCreate,
    SeasonRead,
    SeasonUpdate,
)


# ─── PricingModel ─────────────────────────────────────────────────────────────


async def get_pricing_model(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> PricingModel | None:
    """
    Obtiene el PricingModel del AccommodationType, o None si no existe.

    Args:
        session: Sesión de BD.
        type_id: ID del AccommodationType.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        PricingModel o None.
    """
    result = await session.exec(
        select(PricingModel).where(
            PricingModel.accommodation_type_id == type_id,
            PricingModel.tenant_id == tenant_id,
        )
    )
    return result.first()


async def get_pricing_model_or_404(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> PricingModel:
    """
    Obtiene el PricingModel del AccommodationType o lanza 404.

    Raises:
        HTTPException 404: Si no existe pricing model para el tipo.
    """
    pricing_model = await get_pricing_model(session, type_id, tenant_id)
    if not pricing_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "PRICING_MODEL_NOT_FOUND",
                    "message": f"No existe modelo de precios para el tipo {type_id}.",
                }
            },
        )
    return pricing_model


async def upsert_pricing_model(
    session: AsyncSession,
    data: PricingModelCreate,
    type_id: UUID,
    tenant_id: UUID,
) -> PricingModelRead:
    """
    Crea o actualiza el PricingModel de un AccommodationType.

    Si ya existe un pricing model para ese type_id, lo actualiza.
    Si no existe, lo crea. Solo puede existir uno por tipo (constraint unique).

    Args:
        session: Sesión de BD.
        data: Datos de precio base.
        type_id: AccommodationType al que pertenece.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        PricingModelRead del modelo creado o actualizado.
    """
    existing = await get_pricing_model(session, type_id, tenant_id)

    if existing:
        # Actualizar campos no nulos del request
        existing.unit_price_per_night = data.unit_price_per_night
        existing.plot_price_per_night = data.plot_price_per_night
        existing.person_price_per_night = data.person_price_per_night
        existing.currency = data.currency
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        return PricingModelRead.model_validate(existing)

    pricing_model = PricingModel(
        tenant_id=tenant_id,
        accommodation_type_id=type_id,
        unit_price_per_night=data.unit_price_per_night,
        plot_price_per_night=data.plot_price_per_night,
        person_price_per_night=data.person_price_per_night,
        currency=data.currency,
    )
    session.add(pricing_model)
    await session.commit()
    await session.refresh(pricing_model)
    return PricingModelRead.model_validate(pricing_model)


async def get_pricing_model_with_extras(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> PricingModelWithExtras | None:
    """
    Obtiene el PricingModel junto con sus ExtraPrice y Seasons.

    Returns:
        PricingModelWithExtras o None si no existe pricing model.
    """
    pricing_model = await get_pricing_model(session, type_id, tenant_id)
    if not pricing_model:
        return None

    extra_prices = await get_extra_prices(session, pricing_model.id, tenant_id)
    seasons = await get_seasons(session, type_id, tenant_id)

    return PricingModelWithExtras(
        **PricingModelRead.model_validate(pricing_model).model_dump(),
        extra_prices=extra_prices,
        seasons=seasons,
    )


# ─── Season ───────────────────────────────────────────────────────────────────


async def get_seasons(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> list[SeasonRead]:
    """
    Lista todas las temporadas de un AccommodationType ordenadas por prioridad desc.

    Args:
        session: Sesión de BD.
        type_id: AccommodationType al que pertenecen las temporadas.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Lista de SeasonRead ordenada por priority desc, luego start_date asc.
    """
    result = await session.exec(
        select(Season)
        .where(
            Season.accommodation_type_id == type_id,
            Season.tenant_id == tenant_id,
        )
        .order_by(Season.priority.desc(), Season.start_date)
    )
    return [SeasonRead.model_validate(s) for s in result.all()]


async def get_season(
    session: AsyncSession,
    season_id: UUID,
    tenant_id: UUID,
) -> Season:
    """
    Obtiene una Season verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(Season).where(
            Season.id == season_id,
            Season.tenant_id == tenant_id,
        )
    )
    season = result.first()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "SEASON_NOT_FOUND",
                    "message": f"Temporada {season_id} no encontrada.",
                }
            },
        )
    return season


async def create_season(
    session: AsyncSession,
    data: SeasonCreate,
    type_id: UUID,
    tenant_id: UUID,
) -> SeasonRead:
    """
    Crea una temporada para un AccommodationType.

    Args:
        session: Sesión de BD.
        data: Datos de la temporada.
        type_id: AccommodationType al que pertenece.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        SeasonRead de la temporada creada.
    """
    season = Season(
        tenant_id=tenant_id,
        accommodation_type_id=type_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        priority=data.priority,
        unit_price_per_night=data.unit_price_per_night,
        plot_price_per_night=data.plot_price_per_night,
        person_price_per_night=data.person_price_per_night,
        is_active=data.is_active,
    )
    session.add(season)
    await session.commit()
    await session.refresh(season)
    return SeasonRead.model_validate(season)


async def update_season(
    session: AsyncSession,
    season_id: UUID,
    data: SeasonUpdate,
    tenant_id: UUID,
) -> SeasonRead:
    """
    Actualiza los campos proporcionados de una Season.

    Raises:
        HTTPException 404: Si no existe.
    """
    season = await get_season(session, season_id, tenant_id)
    update_data = data.model_dump(exclude_none=True)

    # Validar coherencia de fechas si se actualiza solo una de las dos
    start = update_data.get("start_date", season.start_date)
    end = update_data.get("end_date", season.end_date)
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_DATE_RANGE",
                    "message": "end_date debe ser posterior a start_date.",
                    "field": "end_date",
                }
            },
        )

    for field, value in update_data.items():
        setattr(season, field, value)

    session.add(season)
    await session.commit()
    await session.refresh(season)
    return SeasonRead.model_validate(season)


async def delete_season(
    session: AsyncSession,
    season_id: UUID,
    tenant_id: UUID,
) -> bool:
    """
    Elimina permanentemente una Season (hard delete: es metadato de precio).

    Raises:
        HTTPException 404: Si no existe.

    Returns:
        True si se eliminó correctamente.
    """
    season = await get_season(session, season_id, tenant_id)
    await session.delete(season)
    await session.commit()
    return True


# ─── ExtraPrice ───────────────────────────────────────────────────────────────


async def get_extra_prices(
    session: AsyncSession,
    pricing_model_id: UUID,
    tenant_id: UUID,
) -> list[ExtraPriceRead]:
    """
    Lista todos los ExtraPrice de un PricingModel.

    Args:
        session: Sesión de BD.
        pricing_model_id: ID del PricingModel.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Lista de ExtraPriceRead.
    """
    result = await session.exec(
        select(ExtraPrice).where(
            ExtraPrice.pricing_model_id == pricing_model_id,
            ExtraPrice.tenant_id == tenant_id,
        )
    )
    return [ExtraPriceRead.model_validate(ep) for ep in result.all()]


async def get_extra_prices_by_type(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> list[ExtraPriceRead]:
    """
    Lista ExtraPrice del tipo de alojamiento (a través del PricingModel).

    Returns:
        Lista de ExtraPriceRead o lista vacía si no hay pricing model.
    """
    pricing_model = await get_pricing_model(session, type_id, tenant_id)
    if not pricing_model:
        return []
    return await get_extra_prices(session, pricing_model.id, tenant_id)


async def upsert_extra_price(
    session: AsyncSession,
    type_id: UUID,
    extra_id: UUID,
    data: ExtraPriceCreate,
    tenant_id: UUID,
) -> ExtraPriceRead:
    """
    Crea o actualiza el precio de un Extra dentro del PricingModel del tipo.

    Si no existe el ExtraPrice para ese extra_id, lo crea.
    Si ya existe, actualiza el precio.

    Args:
        session: Sesión de BD.
        type_id: AccommodationType (para obtener el pricing_model_id).
        extra_id: Extra al que pertenece el precio.
        data: Nuevo precio por noche.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        ExtraPriceRead creado o actualizado.

    Raises:
        HTTPException 404: Si no existe pricing model para el tipo o el extra no existe.
    """
    pricing_model = await get_pricing_model_or_404(session, type_id, tenant_id)

    # Verificar que el extra pertenece al tenant
    extra_result = await session.exec(
        select(Extra).where(Extra.id == extra_id, Extra.tenant_id == tenant_id)
    )
    if not extra_result.first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "EXTRA_NOT_FOUND",
                    "message": f"Extra {extra_id} no encontrado.",
                }
            },
        )

    existing = await session.exec(
        select(ExtraPrice).where(
            ExtraPrice.pricing_model_id == pricing_model.id,
            ExtraPrice.extra_id == extra_id,
            ExtraPrice.tenant_id == tenant_id,
        )
    )
    extra_price = existing.first()

    if extra_price:
        extra_price.price_per_night = data.price_per_night
        session.add(extra_price)
        await session.commit()
        await session.refresh(extra_price)
        return ExtraPriceRead.model_validate(extra_price)

    new_extra_price = ExtraPrice(
        tenant_id=tenant_id,
        pricing_model_id=pricing_model.id,
        extra_id=extra_id,
        price_per_night=data.price_per_night,
    )
    session.add(new_extra_price)
    await session.commit()
    await session.refresh(new_extra_price)
    return ExtraPriceRead.model_validate(new_extra_price)


async def delete_extra_price(
    session: AsyncSession,
    extra_price_id: UUID,
    tenant_id: UUID,
) -> bool:
    """
    Elimina un ExtraPrice.

    Raises:
        HTTPException 404: Si no existe.

    Returns:
        True si se eliminó correctamente.
    """
    result = await session.exec(
        select(ExtraPrice).where(
            ExtraPrice.id == extra_price_id,
            ExtraPrice.tenant_id == tenant_id,
        )
    )
    extra_price = result.first()
    if not extra_price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "EXTRA_PRICE_NOT_FOUND",
                    "message": f"Precio de extra {extra_price_id} no encontrado.",
                }
            },
        )
    await session.delete(extra_price)
    await session.commit()
    return True


# ─── Calculadora de precios ───────────────────────────────────────────────────


def _find_active_season_for_date(
    seasons: list[Season],
    target_date: date,
) -> Season | None:
    """
    Encuentra la Season activa con mayor prioridad que incluye una fecha.

    Itera sobre las temporadas (ya ordenadas por prioridad desc) y devuelve
    la primera que contenga la fecha. Si hay solapamiento, prevalece la de
    mayor prioridad (mayor número).

    Args:
        seasons: Lista de Season activas ordenadas por priority desc.
        target_date: Fecha a evaluar.

    Returns:
        Season con mayor prioridad que aplica, o None si ninguna aplica.
    """
    for season in seasons:
        if season.is_active and season.start_date <= target_date <= season.end_date:
            return season
    return None


def _get_night_price(
    pricing_model: PricingModel,
    accommodation_type: AccommodationType,
    season: Season | None,
    num_persons: int,
) -> Decimal:
    """
    Calcula el precio por noche dado un pricing model y temporada.

    Lógica de precios:
    - Si unit_price_per_night tiene valor (no nulo): precio por unidad/noche.
    - En caso contrario: plot_price_per_night + person_price_per_night × num_persons.

    Si hay temporada activa, sus precios reemplazan los del modelo base cuando
    el campo correspondiente no es None.

    Args:
        pricing_model: Modelo de precios base.
        accommodation_type: Tipo de alojamiento.
        season: Temporada activa para esta noche, o None.
        num_persons: Número de personas.

    Returns:
        Precio total por esa noche.
    """
    zero = Decimal("0.00")

    unit_price = (
        season.unit_price_per_night
        if season and season.unit_price_per_night is not None
        else pricing_model.unit_price_per_night
    )

    if unit_price is not None:
        return unit_price or zero

    # Precio basado en parcela + persona
    plot_price = (
        season.plot_price_per_night
        if season and season.plot_price_per_night is not None
        else pricing_model.plot_price_per_night
    )
    person_price = (
        season.person_price_per_night
        if season and season.person_price_per_night is not None
        else pricing_model.person_price_per_night
    )
    return (plot_price or zero) + (person_price or zero) * Decimal(num_persons)


async def calculate_price(
    session: AsyncSession,
    request: PriceCalculationRequest,
    tenant_id: UUID,
) -> PriceCalculationResult:
    """
    Calcula el precio total de una estancia para un AccommodationType.

    Algoritmo:
    1. Cargar PricingModel del tipo (404 si no existe).
    2. Cargar AccommodationType para leer la categoría.
    3. Cargar temporadas activas del tipo, ordenadas por prioridad desc.
    4. Para cada noche (check_in → check_out-1):
       a. Buscar la Season con mayor prioridad que incluya esa fecha.
       b. Calcular el precio de la noche según categoría y precios aplicables.
    5. Agrupar noches consecutivas con el mismo precio en tramos (breakdown).
    6. Calcular extras_price sumando precio_extra × noches para cada extra_id.
    7. Devolver resultado completo.

    Args:
        session: Sesión de BD.
        request: Parámetros de la reserva a calcular.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        PriceCalculationResult con desglose completo.

    Raises:
        HTTPException 404: Si no existe PricingModel para el tipo.
        HTTPException 422: Si los extra_ids no pertenecen al tenant o tipo.
    """
    # 1. Cargar el pricing model
    pricing_model = await get_pricing_model_or_404(
        session, request.accommodation_type_id, tenant_id
    )

    # 2. Cargar el AccommodationType para la categoría
    type_result = await session.exec(
        select(AccommodationType).where(
            AccommodationType.id == request.accommodation_type_id,
            AccommodationType.tenant_id == tenant_id,
        )
    )
    accommodation_type = type_result.first()
    if not accommodation_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "ACCOMMODATION_TYPE_NOT_FOUND",
                    "message": f"Tipo de alojamiento {request.accommodation_type_id} no encontrado.",
                }
            },
        )

    # 3. Cargar temporadas activas ordenadas por prioridad desc
    seasons_result = await session.exec(
        select(Season)
        .where(
            Season.accommodation_type_id == request.accommodation_type_id,
            Season.tenant_id == tenant_id,
            Season.is_active.is_(True),
        )
        .order_by(Season.priority.desc())
    )
    active_seasons = list(seasons_result.all())

    # 4. Calcular precio noche a noche
    nights_total = (request.check_out - request.check_in).days
    base_price = Decimal("0.00")

    # Estructura mutable para agrupar tramos consecutivos con el mismo precio.
    # Cada elemento: [season_name, price_per_night, dates_list]
    breakdown_raw: list[list] = []

    current_date = request.check_in
    for _ in range(nights_total):
        season = _find_active_season_for_date(active_seasons, current_date)
        night_price = _get_night_price(
            pricing_model, accommodation_type, season, request.num_persons
        )
        season_name = season.name if season else None
        base_price += night_price

        # Agrupar noches consecutivas del mismo tramo
        if (
            breakdown_raw
            and breakdown_raw[-1][0] == season_name
            and breakdown_raw[-1][1] == night_price
        ):
            breakdown_raw[-1][2].append(current_date)
        else:
            breakdown_raw.append([season_name, night_price, [current_date]])

        current_date += timedelta(days=1)

    # 5. Calcular extras_price e IVA de extras (agrupado por tipo de IVA)
    extras_price = Decimal("0.00")
    extra_iva_base: dict[Decimal, Decimal] = {}  # iva_rate → base imponible acumulada

    if request.extra_ids:
        extra_prices_result = await session.exec(
            select(ExtraPrice).where(
                ExtraPrice.pricing_model_id == pricing_model.id,
                ExtraPrice.tenant_id == tenant_id,
                ExtraPrice.extra_id.in_(request.extra_ids),
            )
        )
        extra_prices_list = extra_prices_result.all()

        # Cargar extras para obtener su iva_rate
        extras_result = await session.exec(
            select(Extra).where(
                Extra.id.in_(request.extra_ids),
                Extra.tenant_id == tenant_id,
            )
        )
        extra_iva_map: dict[UUID, Decimal] = {e.id: e.iva_rate for e in extras_result.all()}

        for ep in extra_prices_list:
            cost = ep.price_per_night * Decimal(nights_total)
            extras_price += cost
            rate = extra_iva_map.get(ep.extra_id, Decimal("10.00"))
            extra_iva_base[rate] = extra_iva_base.get(rate, Decimal("0")) + cost

    # 6. Calcular IVA del alojamiento base (usa el iva_rate del AccommodationType)
    accom_rate = accommodation_type.iva_rate
    iva_by_rate: dict[Decimal, Decimal] = {}
    if base_price > Decimal("0"):
        iva_by_rate[accom_rate] = iva_by_rate.get(accom_rate, Decimal("0")) + base_price
    for rate, base in extra_iva_base.items():
        iva_by_rate[rate] = iva_by_rate.get(rate, Decimal("0")) + base

    iva_breakdown: list[IvaBreakdownItem] = []
    total_iva = Decimal("0.00")
    for rate in sorted(iva_by_rate.keys()):
        base_imponible = iva_by_rate[rate]
        iva_amount = (base_imponible * rate / Decimal("100")).quantize(Decimal("0.01"))
        total_iva += iva_amount
        iva_breakdown.append(
            IvaBreakdownItem(rate=rate, base_imponible=base_imponible, iva_amount=iva_amount)
        )

    # 7. Construir breakdown tipado
    breakdown: list[PriceBreakdownItem] = []
    for season_name, price_per_night, dates in breakdown_raw:
        first_date = dates[0]
        last_date = dates[-1]
        breakdown.append(
            PriceBreakdownItem(
                dates=f"{first_date} → {last_date}",
                nights=len(dates),
                price_per_night=price_per_night,
                season=season_name,
            )
        )

    # Temporada aplicada: solo si hay una única temporada en toda la estancia
    unique_seasons = {item.season for item in breakdown}
    applied_season: str | None = None
    if len(unique_seasons) == 1:
        applied_season = next(iter(unique_seasons))

    total_price = base_price + extras_price
    total_with_iva = total_price + total_iva

    return PriceCalculationResult(
        nights=nights_total,
        base_price=base_price,
        extras_price=extras_price,
        total_price=total_price,
        iva_breakdown=iva_breakdown,
        total_iva=total_iva,
        total_with_iva=total_with_iva,
        currency=pricing_model.currency,
        breakdown=breakdown,
        applied_season=applied_season,
    )
