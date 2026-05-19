"""
Servicio de envío de emails transaccionales.

Lógica de selección de SMTP (en orden de prioridad):
  1. SMTP del tenant — si smtp_enabled=True y está configurado
  2. SMTP global del sistema — si el tenant no tiene SMTP propio
  3. No se envía — registra un warning sin romper el flujo

Todos los intentos de envío se registran en la tabla mail_logs.
"""

import logging
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from app.core.crypto import decrypt_secret
from app.models.reservation import Reservation
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# Motor síncrono reutilizado entre llamadas (lazy init)
_sync_engine = None


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        from sqlalchemy import create_engine
        from app.core.config import settings
        sync_url = re.sub(r"\+asyncpg", "+psycopg2", settings.database_url)
        _sync_engine = create_engine(sync_url, pool_size=2, max_overflow=5)
    return _sync_engine


def _write_mail_log(
    tenant_id: UUID,
    reservation_id: UUID | None,
    to_email: str,
    subject: str,
    email_type: str,
    status: str,
    smtp_source: str,
    error_message: str | None,
) -> None:
    try:
        from sqlalchemy.orm import Session
        from app.models.mail_log import MailLog
        with Session(_get_sync_engine()) as db:
            db.add(MailLog(
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                to_email=to_email,
                subject=subject,
                email_type=email_type,
                status=status,
                smtp_source=smtp_source,
                error_message=error_message,
            ))
            db.commit()
    except Exception as exc:
        logger.error("Error writing mail log: %s", exc)


def _build_confirmation_html(reservation: Reservation, tenant: Tenant, cancel_url: str) -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="background:{tenant.primary_color or '#051937'};padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0">{tenant.brand_name or tenant.name}</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#051937">¡Reserva confirmada!</h2>
        <p>Hola <strong>{reservation.guest_name}</strong>,</p>
        <p>Tu reserva ha sido confirmada correctamente.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Alojamiento</td>
              <td style="padding:8px;border-bottom:1px solid #ddd"><strong>Reserva #{str(reservation.id)[:8].upper()}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Entrada</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_in.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Salida</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_out.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Personas</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.num_persons}</td></tr>
          <tr><td style="padding:8px;color:#666">Total pagado</td>
              <td style="padding:8px"><strong>{reservation.total_price} {reservation.currency.upper()}</strong></td></tr>
        </table>
        <p>Si necesitas cancelar tu reserva, puedes hacerlo desde el siguiente enlace:</p>
        <a href="{cancel_url}" style="display:inline-block;background:{tenant.accent_color or '#2E6DB4'};color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Gestionar / Cancelar reserva</a>
        <p style="color:#999;font-size:12px;margin-top:24px">Este email fue enviado automáticamente por {tenant.brand_name or tenant.name}.</p>
      </div>
    </body></html>
    """


def _build_reminder_html(reservation: Reservation, tenant: Tenant, confirm_url: str) -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="background:{tenant.primary_color or '#051937'};padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0">{tenant.brand_name or tenant.name}</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#051937">¡Tu reserva es en 7 días!</h2>
        <p>Hola <strong>{reservation.guest_name}</strong>,</p>
        <p>Te recordamos que tienes una reserva en <strong>{tenant.brand_name or tenant.name}</strong> dentro de <strong>7 días</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Entrada</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_in.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Salida</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_out.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;color:#666">Personas</td>
              <td style="padding:8px">{reservation.num_persons}</td></tr>
        </table>
        <p>Por favor, confirma tu asistencia pulsando el botón:</p>
        <a href="{confirm_url}" style="display:inline-block;background:{tenant.accent_color or '#2E6DB4'};color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Confirmar mi asistencia</a>
        <p style="color:#999;font-size:12px;margin-top:24px">Si no puedes asistir, recuerda cancelar tu reserva con antelación.</p>
      </div>
    </body></html>
    """


def _build_guest_docs_html(
    reservation: Reservation,
    tenant: Tenant,
    upload_url: str,
    body_text: str,
) -> str:
    """
    Construye el HTML del email de solicitud de documentos de viajeros.

    body_text es el texto configurable de la notificación; se respetan los
    saltos de línea y se inserta un botón con el enlace de carga.
    """
    safe_body = body_text.replace("\n", "<br>")
    return f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="background:{tenant.primary_color or '#051937'};padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0">{tenant.brand_name or tenant.name}</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#051937">Completa los datos de tus viajeros</h2>
        <p style="color:#374151">{safe_body}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Entrada</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_in.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#666">Salida</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">{reservation.check_out.strftime('%d/%m/%Y')}</td></tr>
          <tr><td style="padding:8px;color:#666">Viajeros</td>
              <td style="padding:8px">{reservation.num_persons}</td></tr>
        </table>
        <a href="{upload_url}" style="display:inline-block;background:{tenant.accent_color or '#2E6DB4'};color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Subir documentos ahora</a>
        <p style="color:#999;font-size:12px;margin-top:24px">Puedes hacerlo desde tu móvil con la cámara. Si el botón no funciona, copia este enlace: {upload_url}</p>
      </div>
    </body></html>
    """


def send_guest_docs_email(
    reservation: Reservation,
    tenant: Tenant,
    upload_url: str,
    subject: str,
    body_text: str,
    system_smtp: SystemSettings | None = None,
) -> str:
    """
    Envía el email con el enlace de carga de documentos de viajeros.

    El asunto y el cuerpo provienen de la configuración de notificaciones
    del tenant (tipo 'guest_docs_request'). Devuelve el status del envío
    ('sent' | 'failed' | 'no_smtp').
    """
    rendered_subject = subject.replace(
        "{empresa}", tenant.brand_name or tenant.name
    )
    rendered_body = (
        body_text.replace("{nombre}", reservation.guest_name)
        .replace("{check_in}", reservation.check_in.strftime("%d/%m/%Y"))
        .replace("{check_out}", reservation.check_out.strftime("%d/%m/%Y"))
        .replace("{personas}", str(reservation.num_persons))
        .replace("{empresa}", tenant.brand_name or tenant.name)
        .replace("{enlace_documentos}", upload_url)
    )
    html = _build_guest_docs_html(reservation, tenant, upload_url, rendered_body)
    status, smtp_source, error = _send_email(
        tenant, reservation.guest_email, rendered_subject, html, system_smtp
    )
    _write_mail_log(
        tenant_id=reservation.tenant_id,
        reservation_id=reservation.id,
        to_email=reservation.guest_email,
        subject=rendered_subject,
        email_type="guest_docs_request",
        status=status,
        smtp_source=smtp_source,
        error_message=error,
    )
    return status


def _send_email(
    tenant: Tenant,
    to_email: str,
    subject: str,
    html_body: str,
    system_smtp: SystemSettings | None = None,
) -> tuple[str, str, str | None]:
    """
    Envía un email resolviendo SMTP en orden de prioridad.
    Devuelve (status, smtp_source, error_message).
    """
    smtp_source: str

    # ── 1. SMTP del tenant ──────────────────────────────────────────────────────
    if tenant.smtp_enabled and tenant.smtp_host and tenant.smtp_user and tenant.smtp_from:
        smtp_source = "tenant"
        smtp_host = tenant.smtp_host
        smtp_port = tenant.smtp_port
        smtp_user = tenant.smtp_user
        smtp_password = decrypt_secret(tenant.smtp_password) if tenant.smtp_password else None
        smtp_from = tenant.smtp_from
    # ── 2. SMTP global de fallback ──────────────────────────────────────────────
    elif (
        system_smtp
        and system_smtp.smtp_enabled
        and system_smtp.smtp_host
        and system_smtp.smtp_user
        and system_smtp.smtp_from
    ):
        smtp_source = "system"
        smtp_host = system_smtp.smtp_host
        smtp_port = system_smtp.smtp_port
        smtp_user = system_smtp.smtp_user
        smtp_password = decrypt_secret(system_smtp.smtp_password) if system_smtp.smtp_password else None
        smtp_from = system_smtp.smtp_from
        logger.info("Usando SMTP global para tenant %s (sin SMTP propio)", tenant.slug)
    else:
        logger.warning(
            "SMTP no configurado para tenant '%s' ni globalmente — email no enviado.",
            tenant.slug,
        )
        return "no_smtp", "none", None

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            if smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())
        logger.info("Email enviado a %s (tenant: %s)", to_email, tenant.slug)
        return "sent", smtp_source, None
    except Exception as exc:
        logger.error("Error enviando email a %s: %s", to_email, exc)
        return "failed", smtp_source, str(exc)[:500]


def send_confirmation_email(
    reservation: Reservation,
    tenant: Tenant,
    frontend_url: str,
    system_smtp: SystemSettings | None = None,
) -> None:
    cancel_url = f"{frontend_url}/reserva/cancelar/{reservation.cancel_token}"
    subject = f"✅ Reserva confirmada — {tenant.brand_name or tenant.name}"
    html = _build_confirmation_html(reservation, tenant, cancel_url)
    status, smtp_source, error = _send_email(tenant, reservation.guest_email, subject, html, system_smtp)
    _write_mail_log(
        tenant_id=reservation.tenant_id,
        reservation_id=reservation.id,
        to_email=reservation.guest_email,
        subject=subject,
        email_type="confirmation",
        status=status,
        smtp_source=smtp_source,
        error_message=error,
    )


def send_reminder_email(
    reservation: Reservation,
    tenant: Tenant,
    frontend_url: str,
    system_smtp: SystemSettings | None = None,
) -> None:
    confirm_url = f"{frontend_url}/reserva/confirmar/{reservation.confirm_token}"
    subject = f"⏰ Recordatorio: tu reserva es en 7 días — {tenant.brand_name or tenant.name}"
    html = _build_reminder_html(reservation, tenant, confirm_url)
    status, smtp_source, error = _send_email(tenant, reservation.guest_email, subject, html, system_smtp)
    _write_mail_log(
        tenant_id=reservation.tenant_id,
        reservation_id=reservation.id,
        to_email=reservation.guest_email,
        subject=subject,
        email_type="reminder",
        status=status,
        smtp_source=smtp_source,
        error_message=error,
    )
