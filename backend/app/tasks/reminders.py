"""
Tarea Celery: envío de emails de recordatorio 7 días antes del check-in.

Se ejecuta diariamente a las 09:00 UTC mediante Celery Beat.
Usa una sesión síncrona de SQLAlchemy (Celery no es async).
"""

import logging
from datetime import date, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlmodel import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.reservation import Reservation, ReservationStatus
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant
from app.services.email_service import send_reminder_email

logger = logging.getLogger(__name__)

# Celery usa SQLAlchemy síncrono — convertir la URL asyncpg → psycopg2
_sync_db_url = settings.database_url.replace("+asyncpg", "")


@celery_app.task(name="app.tasks.reminders.send_reminder_emails")
def send_reminder_emails() -> dict:
    """
    Busca reservas confirmadas con check_in en 7 días y que no hayan
    recibido recordatorio. Envía el email y marca reminder_sent=True.
    """
    target_date = date.today() + timedelta(days=7)
    sent = 0
    errors = 0

    engine = create_engine(_sync_db_url)
    with Session(engine) as session:
        # Obtener SMTP global para fallback
        system_smtp = session.get(SystemSettings, 1)

        reservations = session.exec(
            select(Reservation).where(
                Reservation.check_in == target_date,
                Reservation.reminder_sent == False,  # noqa: E712
                Reservation.status == ReservationStatus.confirmed,
            )
        ).all()

        for reservation in reservations:
            try:
                tenant = session.get(Tenant, reservation.tenant_id)
                if not tenant:
                    continue

                frontend_url = settings.frontend_url
                send_reminder_email(reservation, tenant, frontend_url, system_smtp)

                reservation.reminder_sent = True
                session.add(reservation)
                sent += 1
            except Exception as exc:
                logger.error(
                    "Error enviando recordatorio para reserva %s: %s",
                    reservation.id,
                    exc,
                )
                errors += 1

        session.commit()

    logger.info("Recordatorios: %d enviados, %d errores. Fecha objetivo: %s", sent, errors, target_date)
    return {"sent": sent, "errors": errors, "target_date": str(target_date)}
