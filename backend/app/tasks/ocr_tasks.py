"""
Tarea Celery: OCR de documentos de viajeros en segundo plano.

Cuando un huésped (o la recepción) sube la imagen del documento, el endpoint
guarda el fichero en disco, marca el huésped como `processing` y encola esta
tarea. Aquí se ejecuta el OCR de la MRZ y se pre-rellenan los campos.

Celery no es async → se usa una sesión síncrona de SQLAlchemy, igual que en
app.tasks.reminders.
"""

import logging
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.reservation_guest import OCRStatus, ReservationGuest
from app.services.ocr_service import extract_mrz

logger = logging.getLogger(__name__)

# Celery usa SQLAlchemy síncrono — convertir la URL asyncpg → psycopg2.
# En docker-compose el worker recibe ya una URL sin +asyncpg, pero
# normalizamos por si se ejecuta con la URL de la app.
_sync_db_url = settings.database_url.replace("+asyncpg", "")


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


@celery_app.task(bind=True, max_retries=2, name="app.tasks.ocr_tasks.process_guest_document")
def process_guest_document(
    self, guest_id: str, image_path: str, image_side: str
) -> dict:
    """
    Procesa un documento de huésped con OCR.

    Args:
        guest_id: UUID (str) del ReservationGuest.
        image_path: Ruta absoluta de la imagen subida.
        image_side: 'front' o 'back' — solo informativo para el log.

    Returns:
        dict con el resultado: {"guest_id", "ocr_status", "found": bool}
    """
    engine = create_engine(_sync_db_url)
    try:
        with Session(engine) as session:
            guest = session.get(ReservationGuest, guest_id)
            if guest is None:
                logger.warning("OCR: huésped %s no encontrado", guest_id)
                return {"guest_id": guest_id, "ocr_status": "missing", "found": False}

            mrz = extract_mrz(image_path)

            if mrz is None:
                # No se pudo leer la MRZ → corrección manual
                guest.ocr_status = OCRStatus.failed.value
                session.add(guest)
                session.commit()
                logger.info(
                    "OCR sin MRZ legible para huésped %s (%s)",
                    guest_id,
                    image_side,
                )
                return {
                    "guest_id": guest_id,
                    "ocr_status": OCRStatus.failed.value,
                    "found": False,
                }

            # Pre-rellenar solo los campos que vengan vacíos o que el OCR
            # haya leído con confianza — el huésped puede corregirlos luego.
            if mrz.first_name and not guest.first_name:
                guest.first_name = mrz.first_name[:100]
            if mrz.last_name and not guest.last_name:
                guest.last_name = mrz.last_name[:100]
            if (mrz.first_name or mrz.last_name) and not guest.full_name:
                guest.full_name = " ".join(
                    p for p in (mrz.first_name, mrz.last_name) if p
                )[:200]
            if mrz.doc_type and not guest.doc_type:
                guest.doc_type = mrz.doc_type
            if mrz.doc_number and not guest.doc_number:
                guest.doc_number = mrz.doc_number[:30]
            if mrz.nationality and not guest.nationality:
                guest.nationality = mrz.nationality[:3]
            if mrz.date_of_birth and not guest.date_of_birth:
                guest.date_of_birth = _parse_iso_date(mrz.date_of_birth)
            if mrz.sex and not guest.sex:
                guest.sex = mrz.sex[:1]
            if mrz.doc_expiry_date and not guest.doc_expiry_date:
                guest.doc_expiry_date = _parse_iso_date(mrz.doc_expiry_date)

            guest.mrz_raw = mrz.mrz_raw
            guest.ocr_status = OCRStatus.completed.value
            session.add(guest)
            session.commit()

            logger.info(
                "OCR completado para huésped %s (%s, confianza %.1f)",
                guest_id,
                image_side,
                mrz.confidence,
            )
            return {
                "guest_id": guest_id,
                "ocr_status": OCRStatus.completed.value,
                "found": True,
            }
    except Exception as exc:  # noqa: BLE001
        logger.error("Error procesando OCR del huésped %s: %s", guest_id, exc)
        # Reintento con backoff; al agotar reintentos marcamos como failed
        try:
            raise self.retry(exc=exc, countdown=10)
        except self.MaxRetriesExceededError:
            try:
                with Session(engine) as session:
                    guest = session.get(ReservationGuest, guest_id)
                    if guest is not None:
                        guest.ocr_status = OCRStatus.failed.value
                        session.add(guest)
                        session.commit()
            except Exception as inner:  # noqa: BLE001
                logger.error(
                    "No se pudo marcar el huésped %s como failed: %s",
                    guest_id,
                    inner,
                )
            return {
                "guest_id": guest_id,
                "ocr_status": OCRStatus.failed.value,
                "found": False,
            }
