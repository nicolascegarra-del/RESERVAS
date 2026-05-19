"""
Lógica de negocio para la captación de documentos de viajeros.

Responsabilidades:
  - Cálculo del estado de documentación de un huésped y de la reserva.
  - Generación/recuperación del token público de carga.
  - Guardado de imágenes de documentos en disco (mismo patrón que logos:
    /app/media/<dir>, servido por StaticFiles en /media).
  - Encolado del OCR.

Las imágenes se guardan en /app/media/guest_docs con nombre UUID para
evitar colisiones y no exponer datos en la ruta.
"""

import logging
import os
import secrets
import uuid as uuid_lib
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.guest_upload_token import GuestUploadToken
from app.models.reservation import Reservation
from app.models.reservation_guest import OCRStatus, ReservationGuest
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant
from app.schemas.guest_doc import DocStatus

logger = logging.getLogger(__name__)

GUEST_DOCS_DIR = "/app/media/guest_docs"
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_BYTES = 12 * 1024 * 1024  # 12 MB — fotos de móvil

# Campos mínimos para considerar a un viajero "completo"
_REQUIRED_FIELDS = ("first_name", "last_name", "doc_type", "doc_number")


def compute_doc_status(guest: ReservationGuest) -> DocStatus:
    """
    Calcula el estado de documentación de un viajero.

    none     → no hay imagen ni datos
    partial  → hay algo pero faltan campos obligatorios o un lado del doc
    complete → campos obligatorios presentes y al menos una imagen del doc
    """
    has_any_image = bool(guest.id_front_url or guest.id_back_url)
    has_any_data = any(
        getattr(guest, f) for f in _REQUIRED_FIELDS
    ) or guest.full_name

    if not has_any_image and not has_any_data:
        return DocStatus.none

    has_all_required = all(getattr(guest, f) for f in _REQUIRED_FIELDS) or bool(
        guest.full_name and guest.doc_number
    )
    # Pasaporte: MRZ está en el frontal → basta una imagen.
    # DNI/NIE: la MRZ está en el reverso; consideramos completo con al menos
    # un lado subido y los datos obligatorios presentes.
    if has_all_required and has_any_image and guest.ocr_status != OCRStatus.processing.value:
        return DocStatus.complete
    return DocStatus.partial


async def get_reservation_or_404(
    session: AsyncSession, reservation_id: UUID, tenant_id: UUID
) -> Reservation:
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


async def list_guests(
    session: AsyncSession, reservation_id: UUID, tenant_id: UUID
) -> list[ReservationGuest]:
    result = await session.exec(
        select(ReservationGuest)
        .where(
            ReservationGuest.reservation_id == reservation_id,
            ReservationGuest.tenant_id == tenant_id,
        )
        .order_by(ReservationGuest.is_main.desc(), ReservationGuest.created_at)
    )
    return list(result.all())


async def get_guest_or_404(
    session: AsyncSession, guest_id: UUID, reservation_id: UUID, tenant_id: UUID
) -> ReservationGuest:
    result = await session.exec(
        select(ReservationGuest).where(
            ReservationGuest.id == guest_id,
            ReservationGuest.reservation_id == reservation_id,
            ReservationGuest.tenant_id == tenant_id,
        )
    )
    guest = result.first()
    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "GUEST_NOT_FOUND",
                    "message": "Viajero no encontrado en esta reserva.",
                }
            },
        )
    return guest


async def get_or_create_token(
    session: AsyncSession, reservation: Reservation
) -> GuestUploadToken:
    """
    Devuelve el token activo de la reserva o crea uno nuevo si no existe.

    No hace commit — el llamador controla la transacción.
    """
    result = await session.exec(
        select(GuestUploadToken).where(
            GuestUploadToken.reservation_id == reservation.id
        )
    )
    token = result.first()
    if token is not None:
        if not token.is_active:
            token.is_active = True
            session.add(token)
        return token

    token = GuestUploadToken(
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        token=secrets.token_urlsafe(32),
        is_active=True,
    )
    session.add(token)
    return token


async def resolve_token_or_404(
    session: AsyncSession, token_value: str
) -> tuple[GuestUploadToken, Reservation]:
    """Resuelve un token público activo y su reserva, o lanza 404."""
    result = await session.exec(
        select(GuestUploadToken).where(
            GuestUploadToken.token == token_value,
            GuestUploadToken.is_active == True,  # noqa: E712
        )
    )
    token = result.first()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "TOKEN_NOT_FOUND",
                    "message": "El enlace no es válido o ha caducado.",
                }
            },
        )
    reservation = await session.get(Reservation, token.reservation_id)
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": "La reserva asociada ya no existe.",
                }
            },
        )
    return token, reservation


async def save_document_image(
    file: UploadFile, side: str
) -> str:
    """
    Guarda una imagen de documento en disco y devuelve su URL pública (/media/...).

    Valida tipo de contenido y tamaño. side ∈ {'front','back'} (solo nombre).
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "INVALID_FILE_TYPE",
                    "message": "Solo se permiten imágenes PNG, JPEG o WebP.",
                }
            },
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "FILE_TOO_LARGE",
                    "message": "La imagen supera el tamaño máximo permitido (12 MB).",
                }
            },
        )

    ext = (file.filename or "doc").rsplit(".", 1)[-1].lower()
    if ext not in {"png", "jpg", "jpeg", "webp"}:
        ext = "jpg"
    filename = f"{uuid_lib.uuid4()}_{side}.{ext}"
    os.makedirs(GUEST_DOCS_DIR, exist_ok=True)

    file_path = os.path.join(GUEST_DOCS_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    return f"/media/guest_docs/{filename}"


def media_url_to_path(url: str) -> str:
    """Convierte una URL /media/... a la ruta absoluta en disco."""
    return f"/app{url}"


def queue_ocr(guest_id: UUID, image_url: str, side: str) -> None:
    """
    Encola la tarea de OCR. Si Celery/Redis no está disponible, no rompe
    el flujo: el huésped podrá rellenar los datos manualmente.
    """
    try:
        from app.tasks.ocr_tasks import process_guest_document

        process_guest_document.delay(
            str(guest_id), media_url_to_path(image_url), side
        )
    except Exception as exc:  # noqa: BLE001 — broker caído no debe romper la subida
        logger.warning(
            "No se pudo encolar el OCR del huésped %s: %s", guest_id, exc
        )


def build_upload_url(token_value: str) -> str:
    """URL pública que recibe el huésped en el email."""
    return f"{settings.frontend_url.rstrip('/')}/g/{token_value}"


async def send_docs_link_email(
    session: AsyncSession,
    reservation: Reservation,
    tenant: Tenant,
    token_value: str,
) -> str:
    """
    Envía el email de solicitud de documentos respetando la configuración
    de notificaciones del tenant ('guest_docs_request').

    Devuelve el status: 'sent' | 'failed' | 'no_smtp' | 'disabled'.
    El envío de email es síncrono (igual que el resto del sistema); si
    falla no rompe el flujo del endpoint.
    """
    from app.services import notification_service
    from app.services.email_service import send_guest_docs_email

    configs = await notification_service.get_notification_configs(
        session, tenant.id
    )
    cfg = next(
        (c for c in configs if c["notification_type"] == "guest_docs_request"),
        None,
    )
    if cfg is not None and not cfg["enabled"]:
        logger.info(
            "Notificación guest_docs_request desactivada para tenant %s",
            tenant.slug,
        )
        return "disabled"

    subject = cfg["subject"] if cfg else "Completa los datos de tus viajeros"
    body_text = cfg["body_text"] if cfg else (
        "Hola {nombre}, sube los documentos de los viajeros aquí: "
        "{enlace_documentos}"
    )
    upload_url = build_upload_url(token_value)
    system_smtp = await session.get(SystemSettings, 1)

    try:
        return send_guest_docs_email(
            reservation=reservation,
            tenant=tenant,
            upload_url=upload_url,
            subject=subject,
            body_text=body_text,
            system_smtp=system_smtp,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Error enviando email de documentos para reserva %s: %s",
            reservation.id,
            exc,
        )
        return "failed"


async def count_guests_status(
    session: AsyncSession, reservation: Reservation
) -> tuple[int, int]:
    """Devuelve (registrados, completos) para una reserva."""
    guests = await list_guests(
        session, reservation.id, reservation.tenant_id
    )
    completed = sum(
        1 for g in guests if compute_doc_status(g) == DocStatus.complete
    )
    return len(guests), completed


def aggregate_status(
    num_persons: int, registered: int, completed: int
) -> DocStatus:
    """Estado agregado de la reserva a partir de los contadores."""
    if registered == 0:
        return DocStatus.none
    if completed >= num_persons and completed >= registered:
        return DocStatus.complete
    return DocStatus.partial


async def reservation_docs_status(
    session: AsyncSession, reservation_ids: list[UUID], tenant_id: UUID
) -> dict[UUID, DocStatus]:
    """
    Calcula el estado de documentación para varias reservas de una vez
    (usado por el dashboard y la tabla de reservas, evita N+1 por viajero).
    """
    if not reservation_ids:
        return {}

    # num_persons por reserva
    res_result = await session.exec(
        select(Reservation.id, Reservation.num_persons).where(
            Reservation.id.in_(reservation_ids),  # type: ignore[attr-defined]
            Reservation.tenant_id == tenant_id,
        )
    )
    num_persons_map: dict[UUID, int] = {
        rid: np for rid, np in res_result.all()
    }

    guests_result = await session.exec(
        select(ReservationGuest).where(
            ReservationGuest.reservation_id.in_(reservation_ids),  # type: ignore[attr-defined]
            ReservationGuest.tenant_id == tenant_id,
        )
    )
    by_reservation: dict[UUID, list[ReservationGuest]] = {}
    for g in guests_result.all():
        by_reservation.setdefault(g.reservation_id, []).append(g)

    status_map: dict[UUID, DocStatus] = {}
    for rid in reservation_ids:
        guests = by_reservation.get(rid, [])
        completed = sum(
            1 for g in guests if compute_doc_status(g) == DocStatus.complete
        )
        status_map[rid] = aggregate_status(
            num_persons_map.get(rid, 1), len(guests), completed
        )
    return status_map
