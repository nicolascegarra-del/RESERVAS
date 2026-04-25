"""
Configuración de Celery con Redis como broker y backend.

Las tareas se descubren automáticamente del paquete app.tasks.
El Beat schedule ejecuta el envío de recordatorios diariamente a las 09:00 UTC.
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "reservas",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.reminders"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "send-reminder-emails-daily": {
            "task": "app.tasks.reminders.send_reminder_emails",
            "schedule": crontab(hour=9, minute=0),  # 09:00 UTC todos los días
        },
    },
)
