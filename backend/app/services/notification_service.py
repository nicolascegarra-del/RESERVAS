"""Servicio de configuración de notificaciones de mail por tenant."""

from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.mail_notification_config import MailNotificationConfig

# ─── Definición de tipos de notificación disponibles ─────────────────────────

NOTIFICATION_TYPES: list[dict] = [
    # ── Reservas ──────────────────────────────────────────────────────────────
    {
        "type": "confirmation",
        "label": "Confirmación de reserva",
        "description": "Se envía al cliente cuando su reserva queda confirmada.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "✅ Tu reserva ha sido confirmada",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu reserva ha sido confirmada correctamente.\n\n"
            "📅 Entrada: {check_in}\n"
            "📅 Salida: {check_out}\n"
            "👥 Personas: {personas}\n"
            "💶 Total: {total} {moneda}\n\n"
            "Si necesitas cancelar tu reserva, usa el enlace que encontrarás en este email.\n\n"
            "¡Hasta pronto!"
        ),
    },
    {
        "type": "reservation_modified",
        "label": "Reserva modificada",
        "description": "Se envía al cliente cuando se modifican los datos de su reserva.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "✏️ Los datos de tu reserva han sido actualizados",
        "default_body": (
            "Hola {nombre},\n\n"
            "Te informamos de que los datos de tu reserva han sido actualizados.\n\n"
            "📅 Entrada: {check_in}\n"
            "📅 Salida: {check_out}\n"
            "👥 Personas: {personas}\n\n"
            "Si tienes alguna duda, contacta con nosotros."
        ),
    },
    {
        "type": "cancellation",
        "label": "Cancelación de reserva",
        "description": "Se envía al cliente cuando su reserva es cancelada.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "❌ Tu reserva ha sido cancelada",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu reserva con entrada el {check_in} ha sido cancelada.\n\n"
            "Si tienes alguna duda sobre el reembolso o necesitas ayuda, contáctanos."
        ),
    },
    # ── Recordatorios pre-llegada ─────────────────────────────────────────────
    {
        "type": "checkin_reminder",
        "label": "Recordatorio de check-in",
        "description": "Se envía al cliente X días antes de su llegada. Configura cuántos días antes.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": 1,
        "default_subject": "⏰ Recordatorio: tu llegada se aproxima",
        "default_body": (
            "Hola {nombre},\n\n"
            "Te recordamos que tu fecha de entrada se aproxima.\n\n"
            "📅 Entrada: {check_in}\n"
            "📅 Salida: {check_out}\n"
            "👥 Personas: {personas}\n\n"
            "¡Te esperamos!"
        ),
    },
    # ── Documentos de viajeros ────────────────────────────────────────────────
    {
        "type": "guest_docs_request",
        "label": "Solicitud de documentos de viajeros",
        "description": (
            "Se envía al cliente justo después de confirmar la reserva. "
            "Incluye el enlace para subir los DNI/pasaportes de todos los viajeros. "
            "Usa {enlace_documentos} para insertar el enlace en el texto."
        ),
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "📋 Completa los datos de tus viajeros — {empresa}",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu reserva está confirmada. Para agilizar tu check-in, "
            "necesitamos los datos de identificación de todos los viajeros.\n\n"
            "📅 Entrada: {check_in}\n"
            "📅 Salida: {check_out}\n"
            "👥 Viajeros: {personas}\n\n"
            "Sube los documentos aquí (solo te llevará unos minutos):\n"
            "👉 {enlace_documentos}\n\n"
            "Puedes hacerlo desde tu móvil con la cámara.\n\n"
            "¡Gracias y hasta pronto!"
        ),
    },
    {
        "type": "guest_docs_reminder",
        "label": "Recordatorio de documentos pendientes",
        "description": (
            "Se envía al cliente X días antes del check-in si aún no ha subido "
            "los documentos de todos los viajeros. Configura cuántos días antes."
        ),
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": 3,
        "default_subject": "⚠️ Documentos pendientes — tu llegada es pronto",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu check-in es el {check_in} y aún tienes documentos de viajeros pendientes de subir.\n\n"
            "Para evitar esperas en la recepción, complétalo ahora:\n"
            "👉 {enlace_documentos}\n\n"
            "Solo te llevará unos minutos."
        ),
    },
    # ── Check-in / Check-out ──────────────────────────────────────────────────
    {
        "type": "checkin_done",
        "label": "Check-in realizado",
        "description": "Se envía al cliente cuando se registra su llegada.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "🏨 ¡Bienvenido! Tu check-in ha sido registrado",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu check-in ha sido registrado correctamente. ¡Bienvenido!\n\n"
            "Tu estancia finaliza el {check_out}.\n\n"
            "Que disfrutes tu estancia."
        ),
    },
    {
        "type": "checkout_done",
        "label": "Check-out realizado",
        "description": "Se envía al cliente cuando finaliza su estancia.",
        "recipient": "cliente",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "👋 ¡Hasta pronto! Gracias por tu visita",
        "default_body": (
            "Hola {nombre},\n\n"
            "Tu check-out ha sido registrado. Gracias por tu visita.\n\n"
            "Esperamos verte de nuevo pronto."
        ),
    },
    # ── Solicitudes de cambio ─────────────────────────────────────────────────
    {
        "type": "change_request_pending",
        "label": "Solicitud de cambio pendiente (a la empresa)",
        "description": "Se envía al email de contacto de la empresa cuando recepción solicita un cambio que requiere aprobación.",
        "recipient": "empresa",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "🔔 Nueva solicitud de cambio pendiente de aprobación",
        "default_body": (
            "Hay una nueva solicitud de cambio pendiente de aprobación.\n\n"
            "Reserva: #{reservation_id}\n"
            "Solicitado por: {solicitante}\n\n"
            "Accede al panel de administración para revisar y aprobar o rechazar el cambio."
        ),
    },
    {
        "type": "change_request_resolved",
        "label": "Solicitud de cambio resuelta (a recepción)",
        "description": "Se envía al usuario de recepción cuando la empresa aprueba o rechaza su solicitud.",
        "recipient": "recepción",
        "enabled_default": True,
        "days_before_default": None,
        "default_subject": "✅ Tu solicitud de cambio ha sido revisada",
        "default_body": (
            "Tu solicitud de cambio para la reserva #{reservation_id} ha sido {decision}.\n\n"
            "Accede al sistema para ver los detalles."
        ),
    },
    # ── Notificaciones internas ───────────────────────────────────────────────
    {
        "type": "new_reservation_internal",
        "label": "Nueva reserva creada (interno a la empresa)",
        "description": "Se envía al email de contacto de la empresa cada vez que se crea una nueva reserva.",
        "recipient": "empresa",
        "enabled_default": False,
        "days_before_default": None,
        "default_subject": "📋 Nueva reserva: {nombre}",
        "default_body": (
            "Se ha creado una nueva reserva.\n\n"
            "Cliente: {nombre}\n"
            "Email: {email}\n"
            "📅 Entrada: {check_in}\n"
            "📅 Salida: {check_out}\n"
            "👥 Personas: {personas}\n"
            "💶 Total: {total} {moneda}"
        ),
    },
]

NOTIFICATION_TYPES_MAP = {n["type"]: n for n in NOTIFICATION_TYPES}

# Variables disponibles por contexto
TEMPLATE_VARIABLES = (
    "{nombre} — Nombre del cliente\n"
    "{email} — Email del cliente\n"
    "{check_in} — Fecha de entrada (DD/MM/YYYY)\n"
    "{check_out} — Fecha de salida (DD/MM/YYYY)\n"
    "{personas} — Número de personas\n"
    "{total} — Importe total\n"
    "{moneda} — Moneda (EUR, etc.)\n"
    "{reservation_id} — ID corto de la reserva\n"
    "{empresa} — Nombre de la empresa\n"
    "{solicitante} — Nombre del usuario que solicita el cambio\n"
    "{decision} — Aprobada / Rechazada\n"
    "{enlace_documentos} — Enlace para subir documentos de viajeros (solo para notificaciones de documentos)"
)

# Tipos que usan días_before (tienen lógica de temporización)
TIME_BASED_TYPES = {"checkin_reminder", "guest_docs_reminder"}


async def get_notification_configs(
    session: AsyncSession,
    tenant_id: UUID,
) -> list[dict]:
    """
    Devuelve la configuración de todas las notificaciones del tenant.
    Los tipos sin configuración propia devuelven los valores por defecto.
    """
    result = await session.exec(
        select(MailNotificationConfig).where(
            MailNotificationConfig.tenant_id == tenant_id
        )
    )
    existing = {cfg.notification_type: cfg for cfg in result.all()}

    configs = []
    for ntype in NOTIFICATION_TYPES:
        cfg = existing.get(ntype["type"])
        configs.append({
            "notification_type": ntype["type"],
            "label": ntype["label"],
            "description": ntype["description"],
            "recipient": ntype["recipient"],
            "is_time_based": ntype["type"] in TIME_BASED_TYPES,
            "enabled": cfg.enabled if cfg else ntype["enabled_default"],
            "subject": cfg.subject if cfg else ntype["default_subject"],
            "body_text": cfg.body_text if cfg else ntype["default_body"],
            "days_before": (
                cfg.days_before if cfg and cfg.days_before is not None
                else ntype["days_before_default"]
            ),
        })
    return configs


async def upsert_notification_config(
    session: AsyncSession,
    tenant_id: UUID,
    notification_type: str,
    enabled: bool,
    subject: str,
    body_text: str,
    days_before: int | None = None,
) -> dict:
    """Crea o actualiza la configuración de una notificación del tenant."""
    result = await session.exec(
        select(MailNotificationConfig).where(
            MailNotificationConfig.tenant_id == tenant_id,
            MailNotificationConfig.notification_type == notification_type,
        )
    )
    cfg = result.first()
    if cfg:
        cfg.enabled = enabled
        cfg.subject = subject
        cfg.body_text = body_text
        cfg.days_before = days_before
        cfg.updated_at = datetime.now(UTC)
    else:
        cfg = MailNotificationConfig(
            tenant_id=tenant_id,
            notification_type=notification_type,
            enabled=enabled,
            subject=subject,
            body_text=body_text,
            days_before=days_before,
        )
    session.add(cfg)
    await session.commit()
    await session.refresh(cfg)

    ntype_meta = NOTIFICATION_TYPES_MAP.get(notification_type, {})
    return {
        "notification_type": notification_type,
        "label": ntype_meta.get("label", notification_type),
        "description": ntype_meta.get("description", ""),
        "recipient": ntype_meta.get("recipient", ""),
        "is_time_based": notification_type in TIME_BASED_TYPES,
        "enabled": cfg.enabled,
        "subject": cfg.subject,
        "body_text": cfg.body_text,
        "days_before": cfg.days_before,
    }
