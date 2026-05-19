"""
Router público de carga de documentos de viajeros — SIN autenticación.

El huésped accede con un token opaco (?token en la URL /g/{token}).
El token identifica unívocamente la reserva y su tenant; no se expone
ningún dato sensible adicional ni se permite enumerar reservas.

Rate limiting aplicado a la subida de imágenes para evitar abuso.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.rate_limit import limiter
from app.models.accommodation import AccommodationUnit
from app.models.reservation_guest import OCRStatus, ReservationGuest, UploadedBy
from app.models.tenant import Tenant
from app.schemas.guest_doc import (
    GuestCreate,
    GuestRead,
    GuestUpdate,
    PublicGuestUploadInfo,
)
from app.services import guest_doc_service

router = APIRouter(prefix="/public/guest-upload", tags=["Documentos de viajeros (público)"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _to_read(guest: ReservationGuest) -> GuestRead:
    data = guest.model_dump()
    data["doc_status"] = guest_doc_service.compute_doc_status(guest)
    return GuestRead.model_validate(data)


@router.get(
    "/{token}",
    response_model=PublicGuestUploadInfo,
    summary="Información de la reserva para la página de carga",
)
async def get_upload_info(token: str, session: SessionDep) -> PublicGuestUploadInfo:
    _, reservation = await guest_doc_service.resolve_token_or_404(session, token)
    tenant = await session.get(Tenant, reservation.tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Alojamiento no encontrado."}},
        )

    unit_result = await session.exec(
        select(AccommodationUnit).where(AccommodationUnit.id == reservation.unit_id)
    )
    unit = unit_result.first()

    registered, completed = await guest_doc_service.count_guests_status(
        session, reservation
    )

    return PublicGuestUploadInfo(
        reservation_id=reservation.id,
        guest_name=reservation.guest_name,
        accommodation_name=unit.name if unit else "Tu alojamiento",
        check_in=reservation.check_in,
        check_out=reservation.check_out,
        num_persons=reservation.num_persons,
        brand_name=tenant.brand_name or tenant.name,
        primary_color=tenant.primary_color,
        accent_color=tenant.accent_color,
        logo_url=tenant.logo_url,
        registered_guests=registered,
        completed_guests=completed,
    )


@router.get(
    "/{token}/guests",
    response_model=list[GuestRead],
    summary="Listar viajeros ya registrados",
)
async def list_public_guests(token: str, session: SessionDep) -> list[GuestRead]:
    _, reservation = await guest_doc_service.resolve_token_or_404(session, token)
    guests = await guest_doc_service.list_guests(
        session, reservation.id, reservation.tenant_id
    )
    return [_to_read(g) for g in guests]


@router.post(
    "/{token}/guests",
    response_model=GuestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un nuevo viajero",
)
async def create_public_guest(
    token: str, data: GuestCreate, session: SessionDep
) -> GuestRead:
    _, reservation = await guest_doc_service.resolve_token_or_404(session, token)

    # Límite de seguridad: no permitir más viajeros que personas en la reserva
    existing = await guest_doc_service.list_guests(
        session, reservation.id, reservation.tenant_id
    )
    if len(existing) >= reservation.num_persons:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "MAX_GUESTS_REACHED",
                    "message": (
                        f"La reserva es para {reservation.num_persons} viajeros. "
                        "No se pueden añadir más."
                    ),
                }
            },
        )

    guest = ReservationGuest(
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        is_main=data.is_main and not any(g.is_main for g in existing),
        first_name=data.first_name,
        last_name=data.last_name,
        full_name=data.full_name,
        doc_type=data.doc_type,
        doc_number=data.doc_number,
        nationality=data.nationality,
        date_of_birth=data.date_of_birth,
        sex=data.sex,
        doc_expiry_date=data.doc_expiry_date,
        address=data.address,
        ocr_status=OCRStatus.pending.value,
        uploaded_by=UploadedBy.guest_self.value,
    )
    session.add(guest)
    await session.commit()
    await session.refresh(guest)
    return _to_read(guest)


@router.patch(
    "/{token}/guests/{guest_id}",
    response_model=GuestRead,
    summary="Actualizar datos de un viajero",
)
async def update_public_guest(
    token: str,
    guest_id: UUID,
    data: GuestUpdate,
    session: SessionDep,
) -> GuestRead:
    _, reservation = await guest_doc_service.resolve_token_or_404(session, token)
    guest = await guest_doc_service.get_guest_or_404(
        session, guest_id, reservation.id, reservation.tenant_id
    )
    update_data = data.model_dump(exclude_unset=True, exclude={"mark_manual"})
    for field, value in update_data.items():
        setattr(guest, field, value)
    if data.mark_manual:
        guest.ocr_status = OCRStatus.manual.value
    guest.updated_at = datetime.now(UTC)
    session.add(guest)
    await session.commit()
    await session.refresh(guest)
    return _to_read(guest)


async def _upload_side(
    token: str,
    guest_id: UUID,
    session: AsyncSession,
    file: UploadFile,
    side: str,
) -> GuestRead:
    _, reservation = await guest_doc_service.resolve_token_or_404(session, token)
    guest = await guest_doc_service.get_guest_or_404(
        session, guest_id, reservation.id, reservation.tenant_id
    )
    image_url = await guest_doc_service.save_document_image(file, side)
    if side == "front":
        guest.id_front_url = image_url
    else:
        guest.id_back_url = image_url
    guest.ocr_status = OCRStatus.processing.value
    guest.uploaded_by = UploadedBy.guest_self.value
    guest.updated_at = datetime.now(UTC)
    session.add(guest)
    await session.commit()
    await session.refresh(guest)

    guest_doc_service.queue_ocr(guest.id, image_url, side)
    return _to_read(guest)


@router.post(
    "/{token}/guests/{guest_id}/front",
    response_model=GuestRead,
    summary="Subir el frontal del documento",
)
@limiter.limit("20/minute")
async def upload_front(
    request: Request,
    token: str,
    guest_id: UUID,
    session: SessionDep,
    file: UploadFile = File(...),
) -> GuestRead:
    return await _upload_side(token, guest_id, session, file, "front")


@router.post(
    "/{token}/guests/{guest_id}/back",
    response_model=GuestRead,
    summary="Subir el reverso del documento",
)
@limiter.limit("20/minute")
async def upload_back(
    request: Request,
    token: str,
    guest_id: UUID,
    session: SessionDep,
    file: UploadFile = File(...),
) -> GuestRead:
    return await _upload_side(token, guest_id, session, file, "back")
