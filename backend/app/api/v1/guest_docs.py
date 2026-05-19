"""
Router de documentos de viajeros — endpoints autenticados (dashboard).

Control de acceso:
  - Listar/crear/editar/eliminar huéspedes y escanear: cualquier rol
    autenticado del tenant (recepción incluida).
  - Enviar enlace y exportar SES: cualquier rol autenticado del tenant.

El tenant_id se extrae del JWT. El super_admin puede pasar ?tenant_id=<uuid>.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user
from app.models.reservation import Reservation, ReservationStatus
from app.models.reservation_guest import OCRStatus, ReservationGuest, UploadedBy
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.guest_doc import (
    DocStatus,
    GuestCreate,
    GuestRead,
    GuestUpdate,
    SendDocsLinkResponse,
)
from app.services import guest_doc_service, ses_service

router = APIRouter(tags=["Documentos de viajeros"])


def _resolve_tenant_id(current_user: User, tenant_id_override: UUID | None) -> UUID:
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


def _to_read(guest: ReservationGuest) -> GuestRead:
    data = guest.model_dump()
    data["doc_status"] = guest_doc_service.compute_doc_status(guest)
    return GuestRead.model_validate(data)


# ─── Alertas del dashboard — DEBE ir antes de {reservation_id} ───────────────


class DocsAlertItem(BaseModel):
    reservation_id: UUID
    guest_name: str
    check_in: date
    num_persons: int
    registered_guests: int
    completed_guests: int
    status: DocStatus


@router.get(
    "/reservations/docs-alerts",
    response_model=list[DocsAlertItem],
    summary="Reservas con check-in inminente y documentación incompleta",
    description=(
        "Devuelve las reservas activas (confirmadas o checked_in) con check-in "
        "hoy o mañana cuya documentación de viajeros NO está completa. "
        "Usado por el banner de alerta del dashboard."
    ),
)
async def get_docs_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    days_ahead: int = Query(default=1, ge=0, le=14),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[DocsAlertItem]:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    today = date.today()
    until = today + timedelta(days=days_ahead)

    res_result = await session.exec(
        select(Reservation).where(
            Reservation.tenant_id == eff_tenant_id,
            Reservation.status.in_(  # type: ignore[attr-defined]
                [ReservationStatus.confirmed, ReservationStatus.checked_in]
            ),
            Reservation.check_in >= today,
            Reservation.check_in <= until,
        )
    )
    reservations = list(res_result.all())
    if not reservations:
        return []

    status_map = await guest_doc_service.reservation_docs_status(
        session, [r.id for r in reservations], eff_tenant_id
    )

    alerts: list[DocsAlertItem] = []
    for r in reservations:
        agg = status_map.get(r.id, DocStatus.none)
        if agg == DocStatus.complete:
            continue
        registered, completed = await guest_doc_service.count_guests_status(
            session, r
        )
        alerts.append(
            DocsAlertItem(
                reservation_id=r.id,
                guest_name=r.guest_name,
                check_in=r.check_in,
                num_persons=r.num_persons,
                registered_guests=registered,
                completed_guests=completed,
                status=agg,
            )
        )
    alerts.sort(key=lambda a: a.check_in)
    return alerts


class DocsStatusRequest(BaseModel):
    reservation_ids: list[UUID]


@router.post(
    "/reservations/docs-status",
    response_model=dict[str, DocStatus],
    summary="Estado de documentación para un lote de reservas",
    description=(
        "Devuelve un mapa reservation_id → estado de documentación. "
        "Usado por la tabla de reservas para mostrar el indicador sin N+1."
    ),
)
async def get_docs_status_bulk(
    data: DocsStatusRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> dict[str, DocStatus]:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    status_map = await guest_doc_service.reservation_docs_status(
        session, data.reservation_ids[:200], eff_tenant_id
    )
    return {str(rid): st for rid, st in status_map.items()}


# ─── Listado y creación ───────────────────────────────────────────────────────


@router.get(
    "/reservations/{reservation_id}/guests",
    response_model=list[GuestRead],
    summary="Listar viajeros de una reserva",
)
async def list_reservation_guests(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[GuestRead]:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await guest_doc_service.get_reservation_or_404(session, reservation_id, eff_tenant_id)
    guests = await guest_doc_service.list_guests(session, reservation_id, eff_tenant_id)
    return [_to_read(g) for g in guests]


@router.post(
    "/reservations/{reservation_id}/guests",
    response_model=GuestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Añadir un viajero manualmente",
)
async def create_reservation_guest(
    reservation_id: UUID,
    data: GuestCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> GuestRead:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    reservation = await guest_doc_service.get_reservation_or_404(
        session, reservation_id, eff_tenant_id
    )
    guest = ReservationGuest(
        reservation_id=reservation.id,
        tenant_id=eff_tenant_id,
        is_main=data.is_main,
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
        ocr_status=OCRStatus.manual.value,
        uploaded_by=UploadedBy.reception.value,
    )
    session.add(guest)
    await session.commit()
    await session.refresh(guest)
    return _to_read(guest)


@router.patch(
    "/reservations/{reservation_id}/guests/{guest_id}",
    response_model=GuestRead,
    summary="Actualizar datos de un viajero",
)
async def update_reservation_guest(
    reservation_id: UUID,
    guest_id: UUID,
    data: GuestUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> GuestRead:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    guest = await guest_doc_service.get_guest_or_404(
        session, guest_id, reservation_id, eff_tenant_id
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


@router.delete(
    "/reservations/{reservation_id}/guests/{guest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar un viajero",
)
async def delete_reservation_guest(
    reservation_id: UUID,
    guest_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    guest = await guest_doc_service.get_guest_or_404(
        session, guest_id, reservation_id, eff_tenant_id
    )
    await session.delete(guest)
    await session.commit()


# ─── Escáner rápido (recepción) ───────────────────────────────────────────────


@router.post(
    "/reservations/{reservation_id}/guests/{guest_id}/scan",
    response_model=GuestRead,
    summary="Subir imagen de documento y lanzar OCR (recepción)",
    description=(
        "Sube la imagen del documento (frontal o reverso), la guarda y "
        "encola el OCR. El estado del viajero pasa a 'processing'."
    ),
)
async def scan_guest_document(
    reservation_id: UUID,
    guest_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    side: str = Query(default="front", pattern="^(front|back)$"),
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
    file: UploadFile = File(...),
) -> GuestRead:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    guest = await guest_doc_service.get_guest_or_404(
        session, guest_id, reservation_id, eff_tenant_id
    )

    image_url = await guest_doc_service.save_document_image(file, side)
    if side == "front":
        guest.id_front_url = image_url
    else:
        guest.id_back_url = image_url
    guest.ocr_status = OCRStatus.processing.value
    guest.uploaded_by = UploadedBy.reception.value
    guest.updated_at = datetime.now(UTC)
    session.add(guest)
    await session.commit()
    await session.refresh(guest)

    guest_doc_service.queue_ocr(guest.id, image_url, side)
    return _to_read(guest)


# ─── Enlace de documentos ─────────────────────────────────────────────────────


@router.post(
    "/reservations/{reservation_id}/send-docs-link",
    response_model=SendDocsLinkResponse,
    summary="Enviar/reenviar el enlace de carga de documentos",
)
async def send_docs_link(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> SendDocsLinkResponse:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    reservation = await guest_doc_service.get_reservation_or_404(
        session, reservation_id, eff_tenant_id
    )
    token = await guest_doc_service.get_or_create_token(session, reservation)
    await session.commit()
    await session.refresh(token)

    tenant = await session.get(Tenant, eff_tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant no encontrado."}},
        )

    email_status = await guest_doc_service.send_docs_link_email(
        session, reservation, tenant, token.token
    )
    return SendDocsLinkResponse(
        token=token.token,
        upload_url=guest_doc_service.build_upload_url(token.token),
        email_status=email_status,
    )


# ─── Exportar parte SES ───────────────────────────────────────────────────────


@router.get(
    "/reservations/{reservation_id}/guests/ses-export",
    summary="Exportar el parte de viajeros en XML SES",
    response_class=Response,
)
async def export_ses_xml(
    reservation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> Response:
    eff_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    reservation = await guest_doc_service.get_reservation_or_404(
        session, reservation_id, eff_tenant_id
    )
    guests = await guest_doc_service.list_guests(
        session, reservation_id, eff_tenant_id
    )
    if not guests:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "NO_GUESTS",
                    "message": "La reserva no tiene viajeros registrados.",
                }
            },
        )
    tenant = await session.get(Tenant, eff_tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant no encontrado."}},
        )

    xml = ses_service.generate_ses_xml(reservation, guests, tenant)
    filename = f"parte_ses_{str(reservation.id)[:8]}.xml"
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
