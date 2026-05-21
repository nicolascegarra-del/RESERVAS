"""
Lógica de negocio para el módulo de alojamientos.

TODAS las operaciones filtran por tenant_id para garantizar el aislamiento
multi-tenant. El tenant_id SIEMPRE proviene del usuario autenticado (JWT),
nunca del body de la request.

Excepción: super_admin puede pasar tenant_id explícito para gestión global.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.accommodation import (
    AccommodationPhoto,
    AccommodationPriceRule,
    AccommodationType,
    AccommodationUnit,
    Extra,
    FieldDefinition,
)
from app.schemas.accommodation import (
    AccommodationPhotoRead,
    AccommodationPhotoUpdate,
    AccommodationPriceRuleCreate,
    AccommodationPriceRuleRead,
    AccommodationPriceRuleUpdate,
    AccommodationTypeCreate,
    AccommodationTypeRead,
    AccommodationTypeSummary,
    AccommodationTypeUpdate,
    AccommodationTypeWithUnits,
    AccommodationUnitCreate,
    AccommodationUnitRead,
    AccommodationUnitUpdate,
    ExtraCreate,
    ExtraRead,
    ExtraUpdate,
    FieldDefinitionCreate,
    FieldDefinitionRead,
    FieldDefinitionUpdate,
)


# ─── AccommodationType ───────────────────────────────────────────────────────


async def get_accommodation_types(
    session: AsyncSession,
    tenant_id: UUID,
    include_inactive: bool = False,
) -> list[AccommodationTypeSummary]:
    """
    Lista todos los tipos de alojamiento del tenant con conteo de unidades activas.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        include_inactive: Si True incluye tipos desactivados (solo admins).

    Returns:
        Lista de AccommodationTypeSummary ordenada por nombre.
    """
    query = select(AccommodationType).where(
        AccommodationType.tenant_id == tenant_id
    )
    if not include_inactive:
        query = query.where(AccommodationType.is_active.is_(True))
    query = query.order_by(AccommodationType.name)

    result = await session.exec(query)
    types = result.all()

    summaries: list[AccommodationTypeSummary] = []
    for accommodation_type in types:
        count_result = await session.exec(
            select(func.count())
            .select_from(AccommodationUnit)
            .where(
                AccommodationUnit.accommodation_type_id == accommodation_type.id,
                AccommodationUnit.is_active.is_(True),
            )
        )
        active_unit_count = count_result.one()

        summary = AccommodationTypeSummary(
            **AccommodationTypeRead.model_validate(accommodation_type).model_dump(),
            active_unit_count=active_unit_count,
        )
        summaries.append(summary)

    return summaries


async def get_accommodation_type(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> AccommodationType:
    """
    Obtiene un AccommodationType verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe o pertenece a otro tenant.
    """
    result = await session.exec(
        select(AccommodationType).where(
            AccommodationType.id == type_id,
            AccommodationType.tenant_id == tenant_id,
        )
    )
    accommodation_type = result.first()
    if not accommodation_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "ACCOMMODATION_TYPE_NOT_FOUND",
                    "message": f"Tipo de alojamiento {type_id} no encontrado.",
                }
            },
        )
    return accommodation_type


async def get_accommodation_type_with_units(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> AccommodationTypeWithUnits:
    """
    Obtiene un AccommodationType con sus unidades activas incluidas.

    Raises:
        HTTPException 404: Si no existe o pertenece a otro tenant.
    """
    accommodation_type = await get_accommodation_type(session, type_id, tenant_id)

    units_result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.accommodation_type_id == type_id,
            AccommodationUnit.tenant_id == tenant_id,
        ).order_by(AccommodationUnit.name)
    )
    units = units_result.all()

    type_read = AccommodationTypeRead.model_validate(accommodation_type)
    return AccommodationTypeWithUnits(
        **type_read.model_dump(),
        units=[AccommodationUnitRead.model_validate(u) for u in units],
    )


async def create_accommodation_type(
    session: AsyncSession,
    data: AccommodationTypeCreate,
    tenant_id: UUID,
) -> AccommodationTypeRead:
    """
    Crea un nuevo tipo de alojamiento para el tenant.

    Args:
        session: Sesión de BD.
        data: Datos del tipo a crear.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        AccommodationTypeRead del tipo creado.

    Raises:
        HTTPException 409: Si ya existe un tipo con el mismo nombre en el tenant.
    """
    existing = await session.exec(
        select(AccommodationType).where(
            AccommodationType.tenant_id == tenant_id,
            AccommodationType.name == data.name,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "ACCOMMODATION_TYPE_NAME_EXISTS",
                    "message": f"Ya existe un tipo de alojamiento con el nombre '{data.name}'.",
                    "field": "name",
                }
            },
        )

    accommodation_type = AccommodationType(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
    )
    session.add(accommodation_type)
    await session.commit()
    await session.refresh(accommodation_type)
    return AccommodationTypeRead.model_validate(accommodation_type)


async def update_accommodation_type(
    session: AsyncSession,
    type_id: UUID,
    data: AccommodationTypeUpdate,
    tenant_id: UUID,
) -> AccommodationTypeRead:
    """
    Actualiza los campos proporcionados de un AccommodationType.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 409: Si el nuevo nombre ya está en uso.
    """
    accommodation_type = await get_accommodation_type(session, type_id, tenant_id)
    update_data = data.model_dump(exclude_none=True)

    if "name" in update_data and update_data["name"] != accommodation_type.name:
        existing = await session.exec(
            select(AccommodationType).where(
                AccommodationType.tenant_id == tenant_id,
                AccommodationType.name == update_data["name"],
                AccommodationType.id != type_id,
            )
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "ACCOMMODATION_TYPE_NAME_EXISTS",
                        "message": f"Ya existe un tipo con el nombre '{update_data['name']}'.",
                        "field": "name",
                    }
                },
            )

    for field, value in update_data.items():
        setattr(accommodation_type, field, value)

    session.add(accommodation_type)
    await session.commit()
    await session.refresh(accommodation_type)
    return AccommodationTypeRead.model_validate(accommodation_type)


async def delete_accommodation_type(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Desactiva (soft delete) un AccommodationType y todas sus unidades.

    Raises:
        HTTPException 404: Si no existe.
    """
    accommodation_type = await get_accommodation_type(session, type_id, tenant_id)
    accommodation_type.is_active = False
    session.add(accommodation_type)

    # Desactivar también todas las unidades del tipo
    units_result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.accommodation_type_id == type_id,
            AccommodationUnit.tenant_id == tenant_id,
        )
    )
    for unit in units_result.all():
        unit.is_active = False
        session.add(unit)

    await session.commit()


# ─── AccommodationUnit ───────────────────────────────────────────────────────


async def get_accommodation_units(
    session: AsyncSession,
    tenant_id: UUID,
    type_id: UUID | None = None,
    include_inactive: bool = False,
) -> list[AccommodationUnitRead]:
    """
    Lista unidades del tenant, opcionalmente filtradas por tipo.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        type_id: Filtra por accommodation_type_id si se proporciona.
        include_inactive: Incluye unidades inactivas si True.

    Returns:
        Lista de AccommodationUnitRead ordenada por nombre.
    """
    query = select(AccommodationUnit).where(
        AccommodationUnit.tenant_id == tenant_id
    )
    if type_id is not None:
        query = query.where(AccommodationUnit.accommodation_type_id == type_id)
    if not include_inactive:
        query = query.where(AccommodationUnit.is_active.is_(True))
    query = query.order_by(AccommodationUnit.name)

    result = await session.exec(query)
    return [AccommodationUnitRead.model_validate(u) for u in result.all()]


async def get_accommodation_unit(
    session: AsyncSession,
    unit_id: UUID,
    tenant_id: UUID,
) -> AccommodationUnit:
    """
    Obtiene una AccommodationUnit verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.id == unit_id,
            AccommodationUnit.tenant_id == tenant_id,
        )
    )
    unit = result.first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "ACCOMMODATION_UNIT_NOT_FOUND",
                    "message": f"Unidad de alojamiento {unit_id} no encontrada.",
                }
            },
        )
    return unit


async def create_accommodation_unit(
    session: AsyncSession,
    data: AccommodationUnitCreate,
    tenant_id: UUID,
) -> AccommodationUnitRead:
    """
    Crea una unidad de alojamiento verificando que el tipo pertenezca al tenant.

    Raises:
        HTTPException 404: Si el AccommodationType no existe en el tenant.
        HTTPException 409: Si ya existe una unidad con el mismo nombre en el tipo.
    """
    # Verificar que el tipo existe y pertenece al tenant
    await get_accommodation_type(session, data.accommodation_type_id, tenant_id)

    existing = await session.exec(
        select(AccommodationUnit).where(
            AccommodationUnit.accommodation_type_id == data.accommodation_type_id,
            AccommodationUnit.tenant_id == tenant_id,
            AccommodationUnit.name == data.name,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "ACCOMMODATION_UNIT_NAME_EXISTS",
                    "message": f"Ya existe una unidad con el nombre '{data.name}' en este tipo.",
                    "field": "name",
                }
            },
        )

    unit = AccommodationUnit(
        tenant_id=tenant_id,
        accommodation_type_id=data.accommodation_type_id,
        name=data.name,
        description=data.description,
        capacity=data.capacity,
        custom_fields=data.custom_fields,
    )
    session.add(unit)
    await session.commit()
    await session.refresh(unit)
    return AccommodationUnitRead.model_validate(unit)


async def update_accommodation_unit(
    session: AsyncSession,
    unit_id: UUID,
    data: AccommodationUnitUpdate,
    tenant_id: UUID,
) -> AccommodationUnitRead:
    """
    Actualiza los campos proporcionados de una AccommodationUnit.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 409: Si el nuevo nombre ya está en uso en el mismo tipo.
    """
    unit = await get_accommodation_unit(session, unit_id, tenant_id)
    update_data = data.model_dump(exclude_none=True)

    if "name" in update_data and update_data["name"] != unit.name:
        existing = await session.exec(
            select(AccommodationUnit).where(
                AccommodationUnit.accommodation_type_id == unit.accommodation_type_id,
                AccommodationUnit.tenant_id == tenant_id,
                AccommodationUnit.name == update_data["name"],
                AccommodationUnit.id != unit_id,
            )
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "ACCOMMODATION_UNIT_NAME_EXISTS",
                        "message": f"Ya existe una unidad con el nombre '{update_data['name']}'.",
                        "field": "name",
                    }
                },
            )

    for field, value in update_data.items():
        setattr(unit, field, value)

    session.add(unit)
    await session.commit()
    await session.refresh(unit)
    return AccommodationUnitRead.model_validate(unit)


async def delete_accommodation_unit(
    session: AsyncSession,
    unit_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Desactiva (soft delete) una AccommodationUnit.

    Raises:
        HTTPException 404: Si no existe.
    """
    unit = await get_accommodation_unit(session, unit_id, tenant_id)
    unit.is_active = False
    session.add(unit)
    await session.commit()


# ─── FieldDefinition ─────────────────────────────────────────────────────────


async def get_field_definitions(
    session: AsyncSession,
    tenant_id: UUID,
    type_id: UUID,
) -> list[FieldDefinitionRead]:
    """
    Lista FieldDefinitions de un tipo de alojamiento, ordenadas por sort_order.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        type_id: AccommodationType al que pertenecen los campos.

    Returns:
        Lista de FieldDefinitionRead ordenada por sort_order, luego por nombre.
    """
    # Verificar que el tipo pertenece al tenant
    await get_accommodation_type(session, type_id, tenant_id)

    result = await session.exec(
        select(FieldDefinition).where(
            FieldDefinition.accommodation_type_id == type_id,
            FieldDefinition.tenant_id == tenant_id,
        ).order_by(FieldDefinition.sort_order, FieldDefinition.field_label)
    )
    return [FieldDefinitionRead.model_validate(f) for f in result.all()]


async def get_field_definition(
    session: AsyncSession,
    field_id: UUID,
    tenant_id: UUID,
) -> FieldDefinition:
    """
    Obtiene un FieldDefinition verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(FieldDefinition).where(
            FieldDefinition.id == field_id,
            FieldDefinition.tenant_id == tenant_id,
        )
    )
    field = result.first()
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "FIELD_DEFINITION_NOT_FOUND",
                    "message": f"Campo personalizado {field_id} no encontrado.",
                }
            },
        )
    return field


async def create_field_definition(
    session: AsyncSession,
    data: FieldDefinitionCreate,
    tenant_id: UUID,
) -> FieldDefinitionRead:
    """
    Crea un campo personalizado para un tipo de alojamiento.

    Raises:
        HTTPException 404: Si el AccommodationType no existe.
        HTTPException 409: Si el field_key ya está en uso en ese tipo.
        HTTPException 422: Si field_type es "select" pero no se proveen opciones.
    """
    await get_accommodation_type(session, data.accommodation_type_id, tenant_id)

    if data.field_type.value == "select" and not data.options:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "OPTIONS_REQUIRED_FOR_SELECT",
                    "message": "Se deben proveer opciones para campos de tipo 'select'.",
                    "field": "options",
                }
            },
        )

    existing = await session.exec(
        select(FieldDefinition).where(
            FieldDefinition.accommodation_type_id == data.accommodation_type_id,
            FieldDefinition.tenant_id == tenant_id,
            FieldDefinition.field_key == data.field_key,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "FIELD_KEY_EXISTS",
                    "message": f"Ya existe un campo con la clave '{data.field_key}' en este tipo.",
                    "field": "field_key",
                }
            },
        )

    field = FieldDefinition(
        tenant_id=tenant_id,
        accommodation_type_id=data.accommodation_type_id,
        field_key=data.field_key,
        field_label=data.field_label,
        field_type=data.field_type,
        options=data.options,
        is_required=data.is_required,
        sort_order=data.sort_order,
    )
    session.add(field)
    await session.commit()
    await session.refresh(field)
    return FieldDefinitionRead.model_validate(field)


async def update_field_definition(
    session: AsyncSession,
    field_id: UUID,
    data: FieldDefinitionUpdate,
    tenant_id: UUID,
) -> FieldDefinitionRead:
    """
    Actualiza un FieldDefinition.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 422: Si se cambia a type "select" sin options.
    """
    field = await get_field_definition(session, field_id, tenant_id)
    update_data = data.model_dump(exclude_none=True)

    # Si se actualiza el tipo a "select", validar que haya opciones
    new_type = update_data.get("field_type", field.field_type)
    new_options = update_data.get("options", field.options)
    if str(new_type) == "select" and not new_options:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "OPTIONS_REQUIRED_FOR_SELECT",
                    "message": "Se deben proveer opciones para campos de tipo 'select'.",
                    "field": "options",
                }
            },
        )

    for key, value in update_data.items():
        setattr(field, key, value)

    session.add(field)
    await session.commit()
    await session.refresh(field)
    return FieldDefinitionRead.model_validate(field)


async def delete_field_definition(
    session: AsyncSession,
    field_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Elimina permanentemente un FieldDefinition (hard delete: es solo metadato).

    Raises:
        HTTPException 404: Si no existe.
    """
    field = await get_field_definition(session, field_id, tenant_id)
    await session.delete(field)
    await session.commit()


# ─── Extra ───────────────────────────────────────────────────────────────────


async def get_extras(
    session: AsyncSession,
    tenant_id: UUID,
    include_inactive: bool = False,
) -> list[ExtraRead]:
    """
    Lista los extras del tenant ordenados por nombre.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        include_inactive: Incluye extras inactivos si True.

    Returns:
        Lista de ExtraRead.
    """
    query = select(Extra).where(Extra.tenant_id == tenant_id)
    if not include_inactive:
        query = query.where(Extra.is_active.is_(True))
    query = query.order_by(Extra.name)

    result = await session.exec(query)
    return [ExtraRead.model_validate(e) for e in result.all()]


async def get_extra(
    session: AsyncSession,
    extra_id: UUID,
    tenant_id: UUID,
) -> Extra:
    """
    Obtiene un Extra verificando que pertenezca al tenant.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await session.exec(
        select(Extra).where(
            Extra.id == extra_id,
            Extra.tenant_id == tenant_id,
        )
    )
    extra = result.first()
    if not extra:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "EXTRA_NOT_FOUND",
                    "message": f"Extra {extra_id} no encontrado.",
                }
            },
        )
    return extra


async def create_extra(
    session: AsyncSession,
    data: ExtraCreate,
    tenant_id: UUID,
) -> ExtraRead:
    """
    Crea un extra para el tenant.

    Raises:
        HTTPException 409: Si ya existe un extra con el mismo nombre.
    """
    existing = await session.exec(
        select(Extra).where(
            Extra.tenant_id == tenant_id,
            Extra.name == data.name,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "EXTRA_NAME_EXISTS",
                    "message": f"Ya existe un extra con el nombre '{data.name}'.",
                    "field": "name",
                }
            },
        )

    extra = Extra(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
        iva_rate=data.iva_rate,
        price=data.price,
        multiplier_type=data.multiplier_type,
    )
    session.add(extra)
    await session.commit()
    await session.refresh(extra)
    return ExtraRead.model_validate(extra)


async def update_extra(
    session: AsyncSession,
    extra_id: UUID,
    data: ExtraUpdate,
    tenant_id: UUID,
) -> ExtraRead:
    """
    Actualiza un Extra.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 409: Si el nuevo nombre ya está en uso.
    """
    extra = await get_extra(session, extra_id, tenant_id)
    update_data = data.model_dump(exclude_none=True)

    if "name" in update_data and update_data["name"] != extra.name:
        existing = await session.exec(
            select(Extra).where(
                Extra.tenant_id == tenant_id,
                Extra.name == update_data["name"],
                Extra.id != extra_id,
            )
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "EXTRA_NAME_EXISTS",
                        "message": f"Ya existe un extra con el nombre '{update_data['name']}'.",
                        "field": "name",
                    }
                },
            )

    for field, value in update_data.items():
        setattr(extra, field, value)

    session.add(extra)
    await session.commit()
    await session.refresh(extra)
    return ExtraRead.model_validate(extra)


async def delete_extra(
    session: AsyncSession,
    extra_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Desactiva (soft delete) un Extra.

    Raises:
        HTTPException 404: Si no existe.
    """
    extra = await get_extra(session, extra_id, tenant_id)
    extra.is_active = False
    session.add(extra)
    await session.commit()


# ─── AccommodationPriceRule ───────────────────────────────────────────────────


async def _get_price_rule(
    session: AsyncSession,
    rule_id: UUID,
    tenant_id: UUID,
) -> AccommodationPriceRule:
    result = await session.exec(
        select(AccommodationPriceRule).where(
            AccommodationPriceRule.id == rule_id,
            AccommodationPriceRule.tenant_id == tenant_id,
        )
    )
    rule = result.first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "PRICE_RULE_NOT_FOUND",
                    "message": f"Regla de precio {rule_id} no encontrada.",
                }
            },
        )
    return rule


async def list_price_rules(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> list[AccommodationPriceRuleRead]:
    await get_accommodation_type(session, type_id, tenant_id)
    result = await session.exec(
        select(AccommodationPriceRule).where(
            AccommodationPriceRule.accommodation_type_id == type_id,
            AccommodationPriceRule.tenant_id == tenant_id,
        ).order_by(AccommodationPriceRule.date_from)
    )
    return [AccommodationPriceRuleRead.model_validate(r) for r in result.all()]


async def create_price_rule(
    session: AsyncSession,
    type_id: UUID,
    data: AccommodationPriceRuleCreate,
    tenant_id: UUID,
) -> AccommodationPriceRuleRead:
    await get_accommodation_type(session, type_id, tenant_id)

    # Verificar solapamiento de fechas con reglas activas existentes
    existing_result = await session.exec(
        select(AccommodationPriceRule).where(
            AccommodationPriceRule.accommodation_type_id == type_id,
            AccommodationPriceRule.tenant_id == tenant_id,
            AccommodationPriceRule.is_active.is_(True),
        )
    )
    for existing_rule in existing_result.all():
        if data.date_from <= existing_rule.date_to and existing_rule.date_from <= data.date_to:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "DATE_RANGE_OVERLAP",
                        "message": f"Las fechas se solapan con la regla '{existing_rule.name}'.",
                        "field": "date_from",
                    }
                },
            )

    from uuid import uuid4
    rule = AccommodationPriceRule(
        id=uuid4(),
        tenant_id=tenant_id,
        accommodation_type_id=type_id,
        name=data.name,
        date_from=data.date_from,
        date_to=data.date_to,
        price_per_night=data.price_per_night,
        min_nights=data.min_nights,
        is_active=data.is_active,
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return AccommodationPriceRuleRead.model_validate(rule)


async def update_price_rule(
    session: AsyncSession,
    rule_id: UUID,
    data: AccommodationPriceRuleUpdate,
    tenant_id: UUID,
) -> AccommodationPriceRuleRead:
    rule = await _get_price_rule(session, rule_id, tenant_id)

    update_data = data.model_dump(exclude_none=True)
    new_date_from = update_data.get("date_from", rule.date_from)
    new_date_to = update_data.get("date_to", rule.date_to)

    # Verificar solapamiento excluyendo la regla actual
    if "date_from" in update_data or "date_to" in update_data:
        existing_result = await session.exec(
            select(AccommodationPriceRule).where(
                AccommodationPriceRule.accommodation_type_id == rule.accommodation_type_id,
                AccommodationPriceRule.tenant_id == tenant_id,
                AccommodationPriceRule.is_active.is_(True),
                AccommodationPriceRule.id != rule_id,
            )
        )
        for existing_rule in existing_result.all():
            if new_date_from <= existing_rule.date_to and existing_rule.date_from <= new_date_to:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error": {
                            "code": "DATE_RANGE_OVERLAP",
                            "message": f"Las fechas se solapan con la regla '{existing_rule.name}'.",
                            "field": "date_from",
                        }
                    },
                )

    for field, value in update_data.items():
        setattr(rule, field, value)
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return AccommodationPriceRuleRead.model_validate(rule)


async def delete_price_rule(
    session: AsyncSession,
    rule_id: UUID,
    tenant_id: UUID,
) -> None:
    rule = await _get_price_rule(session, rule_id, tenant_id)
    await session.delete(rule)
    await session.commit()


# ─── AccommodationPhoto ───────────────────────────────────────────────────────


async def _get_photo(
    session: AsyncSession,
    photo_id: UUID,
    tenant_id: UUID,
) -> AccommodationPhoto:
    result = await session.exec(
        select(AccommodationPhoto).where(
            AccommodationPhoto.id == photo_id,
            AccommodationPhoto.tenant_id == tenant_id,
        )
    )
    photo = result.first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "PHOTO_NOT_FOUND",
                    "message": f"Foto {photo_id} no encontrada.",
                }
            },
        )
    return photo


async def list_photos(
    session: AsyncSession,
    type_id: UUID,
    tenant_id: UUID,
) -> list[AccommodationPhotoRead]:
    await get_accommodation_type(session, type_id, tenant_id)
    result = await session.exec(
        select(AccommodationPhoto).where(
            AccommodationPhoto.accommodation_type_id == type_id,
            AccommodationPhoto.tenant_id == tenant_id,
        ).order_by(AccommodationPhoto.sort_order, AccommodationPhoto.created_at)
    )
    return [AccommodationPhotoRead.model_validate(p) for p in result.all()]


async def create_photo(
    session: AsyncSession,
    type_id: UUID,
    file_url: str,
    file_key: str,
    tenant_id: UUID,
    caption: str | None = None,
    sort_order: int = 0,
) -> AccommodationPhotoRead:
    from uuid import uuid4
    photo = AccommodationPhoto(
        id=uuid4(),
        tenant_id=tenant_id,
        accommodation_type_id=type_id,
        file_url=file_url,
        file_key=file_key,
        caption=caption,
        sort_order=sort_order,
    )
    session.add(photo)
    await session.commit()
    await session.refresh(photo)
    return AccommodationPhotoRead.model_validate(photo)


async def update_photo(
    session: AsyncSession,
    photo_id: UUID,
    data: AccommodationPhotoUpdate,
    tenant_id: UUID,
) -> AccommodationPhotoRead:
    photo = await _get_photo(session, photo_id, tenant_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(photo, field, value)
    session.add(photo)
    await session.commit()
    await session.refresh(photo)
    return AccommodationPhotoRead.model_validate(photo)


async def delete_photo(
    session: AsyncSession,
    photo_id: UUID,
    tenant_id: UUID,
) -> str | None:
    """Returns file_key for MinIO deletion, or None if already gone."""
    photo = await _get_photo(session, photo_id, tenant_id)
    file_key = photo.file_key
    await session.delete(photo)
    await session.commit()
    return file_key
