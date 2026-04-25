"""
Router de precios — configuración de pricing models, temporadas, extras y calculadora.

Control de acceso:
- GET y POST /calculate: cualquier rol autenticado del tenant.
- PUT / POST / DELETE en models, seasons, extras: solo company_admin y super_admin.

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
from app.schemas.pricing import (
    ExtraPriceCreate,
    ExtraPriceRead,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingModelCreate,
    PricingModelRead,
    PricingModelWithExtras,
    SeasonCreate,
    SeasonRead,
    SeasonUpdate,
)
from app.services import pricing_service

router = APIRouter(tags=["Precios"])


def _resolve_tenant_id(current_user: User, tenant_id_override: UUID | None) -> UUID:
    """
    Resuelve el tenant_id efectivo para la operación.

    El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
    El resto de roles usa siempre su propio tenant_id del JWT.
    """
    from fastapi import HTTPException

    if tenant_id_override and current_user.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Solo super_admin puede especificar un tenant diferente.",
                }
            },
        )
    if tenant_id_override:
        return tenant_id_override
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "MISSING_TENANT",
                    "message": "El usuario no tiene tenant asignado.",
                }
            },
        )
    return current_user.tenant_id


# ─── Pricing Model ────────────────────────────────────────────────────────────


@router.get(
    "/pricing/types/{type_id}/model",
    response_model=PricingModelWithExtras | None,
    summary="Obtener pricing model del tipo",
    description="Devuelve el pricing model del AccommodationType junto con extras y temporadas.",
)
async def get_pricing_model(
    type_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PricingModelWithExtras | None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.get_pricing_model_with_extras(
        session, type_id, effective_tenant_id
    )


@router.put(
    "/pricing/types/{type_id}/model",
    response_model=PricingModelRead,
    summary="Crear o actualizar pricing model",
    description="Upsert del pricing model: si ya existe se actualiza, si no se crea.",
)
async def upsert_pricing_model(
    type_id: UUID,
    data: PricingModelCreate,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PricingModelRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.upsert_pricing_model(
        session, data, type_id, effective_tenant_id
    )


# ─── Seasons ──────────────────────────────────────────────────────────────────


@router.get(
    "/pricing/types/{type_id}/seasons",
    response_model=list[SeasonRead],
    summary="Listar temporadas del tipo",
    description="Devuelve las temporadas del AccommodationType ordenadas por prioridad desc.",
)
async def list_seasons(
    type_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[SeasonRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.get_seasons(session, type_id, effective_tenant_id)


@router.post(
    "/pricing/types/{type_id}/seasons",
    response_model=SeasonRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear temporada",
    description="Crea una nueva temporada de precios para el AccommodationType.",
)
async def create_season(
    type_id: UUID,
    data: SeasonCreate,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> SeasonRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.create_season(
        session, data, type_id, effective_tenant_id
    )


@router.put(
    "/pricing/types/{type_id}/seasons/{season_id}",
    response_model=SeasonRead,
    summary="Actualizar temporada",
    description="Actualiza los campos proporcionados de una temporada.",
)
async def update_season(
    type_id: UUID,
    season_id: UUID,
    data: SeasonUpdate,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> SeasonRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.update_season(
        session, season_id, data, effective_tenant_id
    )


@router.delete(
    "/pricing/types/{type_id}/seasons/{season_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar temporada",
    description="Elimina permanentemente una temporada.",
)
async def delete_season(
    type_id: UUID,
    season_id: UUID,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await pricing_service.delete_season(session, season_id, effective_tenant_id)


# ─── Extra Prices ─────────────────────────────────────────────────────────────


@router.get(
    "/pricing/types/{type_id}/extras",
    response_model=list[ExtraPriceRead],
    summary="Listar precios de extras del tipo",
    description="Devuelve los ExtraPrice configurados en el pricing model del tipo.",
)
async def list_extra_prices(
    type_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[ExtraPriceRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.get_extra_prices_by_type(
        session, type_id, effective_tenant_id
    )


@router.put(
    "/pricing/types/{type_id}/extras/{extra_id}",
    response_model=ExtraPriceRead,
    summary="Crear o actualizar precio de un extra",
    description="Upsert del precio por noche de un extra dentro del pricing model del tipo.",
)
async def upsert_extra_price(
    type_id: UUID,
    extra_id: UUID,
    data: ExtraPriceCreate,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ExtraPriceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.upsert_extra_price(
        session, type_id, extra_id, data, effective_tenant_id
    )


@router.delete(
    "/pricing/types/{type_id}/extras/{extra_price_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar precio de un extra",
    description="Elimina el ExtraPrice por su ID.",
)
async def delete_extra_price(
    type_id: UUID,
    extra_price_id: UUID,
    current_user: Annotated[
        User,
        Depends(require_role(UserRole.company_admin, UserRole.super_admin)),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await pricing_service.delete_extra_price(
        session, extra_price_id, effective_tenant_id
    )


# ─── Calculadora ──────────────────────────────────────────────────────────────


@router.post(
    "/pricing/calculate",
    response_model=PriceCalculationResult,
    summary="Calcular precio de una estancia",
    description=(
        "Calcula el precio total para un AccommodationType en un rango de fechas, "
        "aplicando temporadas por prioridad y sumando los extras seleccionados. "
        "check_out es exclusivo: lunes→miércoles = 2 noches."
    ),
)
async def calculate_price(
    data: PriceCalculationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PriceCalculationResult:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await pricing_service.calculate_price(session, data, effective_tenant_id)
