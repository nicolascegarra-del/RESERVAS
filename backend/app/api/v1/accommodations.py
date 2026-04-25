"""
Router de alojamientos — inventario de tipos, unidades, campos y extras.

Control de acceso:
- GET: cualquier rol autenticado del tenant.
- POST / PUT / DELETE: solo company_admin y super_admin.

El tenant_id SIEMPRE se extrae del JWT (current_user.tenant_id).
El super_admin puede operar sobre cualquier tenant pasando ?tenant_id=<uuid>.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.accommodation import (
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
from app.services import accommodation_service

router = APIRouter(tags=["Alojamientos"])


def _resolve_tenant_id(current_user: User, tenant_id_override: UUID | None) -> UUID:
    """
    Resuelve el tenant_id efectivo para la operación.

    El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
    El resto de roles usa siempre su propio tenant_id del JWT.

    Raises:
        HTTPException 400: Si el usuario no es super_admin e intenta usar override.
        HTTPException 400: Si no se puede determinar el tenant_id.
    """
    from fastapi import HTTPException

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


# ─── AccommodationType ───────────────────────────────────────────────────────


@router.get(
    "/accommodations/types",
    response_model=list[AccommodationTypeSummary],
    summary="Listar tipos de alojamiento",
    description="Devuelve los tipos de alojamiento del tenant con conteo de unidades activas.",
)
async def list_accommodation_types(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    include_inactive: bool = Query(default=False, description="Incluir tipos desactivados"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[AccommodationTypeSummary]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.get_accommodation_types(
        session, effective_tenant_id, include_inactive
    )


@router.post(
    "/accommodations/types",
    response_model=AccommodationTypeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear tipo de alojamiento",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def create_accommodation_type(
    data: AccommodationTypeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationTypeRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.create_accommodation_type(
        session, data, effective_tenant_id
    )


@router.get(
    "/accommodations/types/{type_id}",
    response_model=AccommodationTypeWithUnits,
    summary="Detalle de tipo de alojamiento con unidades",
)
async def get_accommodation_type(
    type_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationTypeWithUnits:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.get_accommodation_type_with_units(
        session, type_id, effective_tenant_id
    )


@router.put(
    "/accommodations/types/{type_id}",
    response_model=AccommodationTypeRead,
    summary="Actualizar tipo de alojamiento",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def update_accommodation_type(
    type_id: UUID,
    data: AccommodationTypeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationTypeRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.update_accommodation_type(
        session, type_id, data, effective_tenant_id
    )


@router.delete(
    "/accommodations/types/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar tipo de alojamiento (soft delete)",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def delete_accommodation_type(
    type_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await accommodation_service.delete_accommodation_type(
        session, type_id, effective_tenant_id
    )


# ─── AccommodationUnit ───────────────────────────────────────────────────────


@router.get(
    "/accommodations/units",
    response_model=list[AccommodationUnitRead],
    summary="Listar unidades de alojamiento",
    description="Lista unidades del tenant. Filtrable por type_id.",
)
async def list_accommodation_units(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    type_id: UUID | None = Query(default=None, description="Filtrar por tipo"),
    include_inactive: bool = Query(default=False, description="Incluir unidades desactivadas"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[AccommodationUnitRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.get_accommodation_units(
        session, effective_tenant_id, type_id, include_inactive
    )


@router.post(
    "/accommodations/units",
    response_model=AccommodationUnitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear unidad de alojamiento",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def create_accommodation_unit(
    data: AccommodationUnitCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationUnitRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.create_accommodation_unit(
        session, data, effective_tenant_id
    )


@router.get(
    "/accommodations/units/{unit_id}",
    response_model=AccommodationUnitRead,
    summary="Detalle de unidad de alojamiento",
)
async def get_accommodation_unit(
    unit_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationUnitRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    unit = await accommodation_service.get_accommodation_unit(
        session, unit_id, effective_tenant_id
    )
    return AccommodationUnitRead.model_validate(unit)


@router.put(
    "/accommodations/units/{unit_id}",
    response_model=AccommodationUnitRead,
    summary="Actualizar unidad de alojamiento",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def update_accommodation_unit(
    unit_id: UUID,
    data: AccommodationUnitUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> AccommodationUnitRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.update_accommodation_unit(
        session, unit_id, data, effective_tenant_id
    )


@router.delete(
    "/accommodations/units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar unidad (soft delete)",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def delete_accommodation_unit(
    unit_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await accommodation_service.delete_accommodation_unit(
        session, unit_id, effective_tenant_id
    )


# ─── FieldDefinition ─────────────────────────────────────────────────────────


@router.get(
    "/accommodations/fields",
    response_model=list[FieldDefinitionRead],
    summary="Listar campos personalizados de un tipo",
    description="Requiere type_id como query param obligatorio.",
)
async def list_field_definitions(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    type_id: UUID = Query(description="AccommodationType al que pertenecen los campos"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[FieldDefinitionRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.get_field_definitions(
        session, effective_tenant_id, type_id
    )


@router.post(
    "/accommodations/fields",
    response_model=FieldDefinitionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear campo personalizado",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def create_field_definition(
    data: FieldDefinitionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> FieldDefinitionRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.create_field_definition(
        session, data, effective_tenant_id
    )


@router.put(
    "/accommodations/fields/{field_id}",
    response_model=FieldDefinitionRead,
    summary="Actualizar campo personalizado",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def update_field_definition(
    field_id: UUID,
    data: FieldDefinitionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> FieldDefinitionRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.update_field_definition(
        session, field_id, data, effective_tenant_id
    )


@router.delete(
    "/accommodations/fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar campo personalizado",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def delete_field_definition(
    field_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await accommodation_service.delete_field_definition(
        session, field_id, effective_tenant_id
    )


# ─── Extra ───────────────────────────────────────────────────────────────────


@router.get(
    "/accommodations/extras",
    response_model=list[ExtraRead],
    summary="Listar extras del tenant",
)
async def list_extras(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    include_inactive: bool = Query(default=False, description="Incluir extras desactivados"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[ExtraRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.get_extras(
        session, effective_tenant_id, include_inactive
    )


@router.post(
    "/accommodations/extras",
    response_model=ExtraRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear extra",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def create_extra(
    data: ExtraCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ExtraRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.create_extra(
        session, data, effective_tenant_id
    )


@router.put(
    "/accommodations/extras/{extra_id}",
    response_model=ExtraRead,
    summary="Actualizar extra",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def update_extra(
    extra_id: UUID,
    data: ExtraUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ExtraRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await accommodation_service.update_extra(
        session, extra_id, data, effective_tenant_id
    )


@router.delete(
    "/accommodations/extras/{extra_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar extra (soft delete)",
    dependencies=[Depends(require_role(UserRole.company_admin, UserRole.super_admin))],
)
async def delete_extra(
    extra_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await accommodation_service.delete_extra(
        session, extra_id, effective_tenant_id
    )
