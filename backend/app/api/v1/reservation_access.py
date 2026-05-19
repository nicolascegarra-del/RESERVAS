"""
Router para control de acceso de reservas:
- Matrículas de vehículos
- Códigos alfanuméricos de torno (uno por persona)

Control de acceso: cualquier usuario autenticado del tenant puede operar
(mismo nivel que el resto de endpoints de reservas).
"""

import secrets
import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user
from app.models.reservation import Reservation
from app.models.reservation_access_code import ReservationAccessCode
from app.models.reservation_vehicle import ReservationVehicle
from app.models.user import User, UserRole

router = APIRouter(tags=["Control de acceso"])

_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(6))


def _resolve_tenant(current_user: User, tenant_id_override: UUID | None) -> UUID:
    if current_user.role == UserRole.super_admin and tenant_id_override:
        return tenant_id_override
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "NO_TENANT", "message": "El usuario no tiene tenant asignado."}},
        )
    return current_user.tenant_id


async def _get_reservation(
    reservation_id: UUID,
    tenant_id: UUID,
    session: AsyncSession,
) -> Reservation:
    res = await session.get(Reservation, reservation_id)
    if not res or res.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RESERVATION_NOT_FOUND", "message": "Reserva no encontrada."}},
        )
    return res


# ─── Schemas ─────────────────────────────────────────────────────────────────

class VehiclePlateRead(BaseModel):
    id: UUID
    reservation_id: UUID
    plate: str
    created_at: str

    model_config = {"from_attributes": True}


class VehiclePlateCreate(BaseModel):
    plate: str


class AccessCodeRead(BaseModel):
    id: UUID
    reservation_id: UUID
    code: str
    person_index: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ─── Matrículas ───────────────────────────────────────────────────────────────

@router.get(
    "/reservations/{reservation_id}/vehicles",
    response_model=list[VehiclePlateRead],
    summary="Listar matrículas de una reserva",
)
async def list_vehicles(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> list[VehiclePlateRead]:
    effective_tenant = _resolve_tenant(current_user, tenant_id)
    await _get_reservation(reservation_id, effective_tenant, session)
    result = await session.exec(
        select(ReservationVehicle)
        .where(ReservationVehicle.reservation_id == reservation_id)
        .order_by(ReservationVehicle.created_at)
    )
    return [VehiclePlateRead.model_validate(v) for v in result.all()]


@router.post(
    "/reservations/{reservation_id}/vehicles",
    response_model=VehiclePlateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Añadir matrícula a una reserva",
)
async def add_vehicle(
    reservation_id: UUID,
    data: VehiclePlateCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> VehiclePlateRead:
    effective_tenant = _resolve_tenant(current_user, tenant_id)
    reservation = await _get_reservation(reservation_id, effective_tenant, session)
    plate_normalized = data.plate.strip().upper()
    if not plate_normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_PLATE", "message": "La matrícula no puede estar vacía."}},
        )
    vehicle = ReservationVehicle(
        tenant_id=reservation.tenant_id,
        reservation_id=reservation_id,
        plate=plate_normalized,
    )
    session.add(vehicle)
    await session.commit()
    await session.refresh(vehicle)
    return VehiclePlateRead.model_validate(vehicle)


@router.delete(
    "/reservations/{reservation_id}/vehicles/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar matrícula de una reserva",
)
async def delete_vehicle(
    reservation_id: UUID,
    vehicle_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> None:
    effective_tenant = _resolve_tenant(current_user, tenant_id)
    await _get_reservation(reservation_id, effective_tenant, session)
    vehicle = await session.get(ReservationVehicle, vehicle_id)
    if not vehicle or vehicle.reservation_id != reservation_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "VEHICLE_NOT_FOUND", "message": "Matrícula no encontrada."}},
        )
    await session.delete(vehicle)
    await session.commit()


# ─── Códigos de acceso al torno ───────────────────────────────────────────────

@router.get(
    "/reservations/{reservation_id}/access-codes",
    response_model=list[AccessCodeRead],
    summary="Listar códigos de torno de una reserva",
)
async def list_access_codes(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> list[AccessCodeRead]:
    effective_tenant = _resolve_tenant(current_user, tenant_id)
    await _get_reservation(reservation_id, effective_tenant, session)
    result = await session.exec(
        select(ReservationAccessCode)
        .where(ReservationAccessCode.reservation_id == reservation_id)
        .order_by(ReservationAccessCode.person_index)
    )
    return [AccessCodeRead.model_validate(c) for c in result.all()]


@router.post(
    "/reservations/{reservation_id}/access-codes/generate",
    response_model=list[AccessCodeRead],
    summary="Generar (o regenerar) todos los códigos de torno",
    description=(
        "Elimina los códigos existentes y genera uno nuevo por cada persona "
        "de la reserva (num_persons). Los códigos son alfanuméricos de 6 caracteres."
    ),
)
async def generate_access_codes(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> list[AccessCodeRead]:
    effective_tenant = _resolve_tenant(current_user, tenant_id)
    reservation = await _get_reservation(reservation_id, effective_tenant, session)

    # Eliminar los existentes
    existing = await session.exec(
        select(ReservationAccessCode).where(ReservationAccessCode.reservation_id == reservation_id)
    )
    for code in existing.all():
        await session.delete(code)

    # Crear uno por persona
    new_codes: list[ReservationAccessCode] = []
    for i in range(1, reservation.num_persons + 1):
        code = ReservationAccessCode(
            tenant_id=reservation.tenant_id,
            reservation_id=reservation_id,
            code=_generate_code(),
            person_index=i,
        )
        session.add(code)
        new_codes.append(code)

    await session.commit()
    for code in new_codes:
        await session.refresh(code)

    return [AccessCodeRead.model_validate(c) for c in new_codes]


@router.post(
    "/reservations/{reservation_id}/access-codes/{code_id}/regenerate",
    response_model=AccessCodeRead,
    summary="Regenerar un código de torno individual",
)
async def regenerate_access_code(
    reservation_id: UUID,
    code_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = None,
) -> AccessCodeRead:
    from datetime import UTC, datetime

    effective_tenant = _resolve_tenant(current_user, tenant_id)
    await _get_reservation(reservation_id, effective_tenant, session)
    code = await session.get(ReservationAccessCode, code_id)
    if not code or code.reservation_id != reservation_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "CODE_NOT_FOUND", "message": "Código no encontrado."}},
        )
    code.code = _generate_code()
    code.updated_at = datetime.now(UTC)
    session.add(code)
    await session.commit()
    await session.refresh(code)
    return AccessCodeRead.model_validate(code)
