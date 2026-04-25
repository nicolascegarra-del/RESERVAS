"""
Servicio de envío de emails transaccionales.

Lee la configuración SMTP del tenant. Si smtp_enabled=False o falta
configuración, registra un warning y no envía (no rompe el flujo).
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.models.reservation import Reservation
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


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
              <td style="padding:8px;border-bottom:1px solid #ddd"><strong>Ver reserva #{str(reservation.id)[:8].upper()}</strong></td></tr>
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


def _send_email(tenant: Tenant, to_email: str, subject: str, html_body: str) -> None:
    """Envía un email usando la configuración SMTP del tenant."""
    if not tenant.smtp_enabled or not tenant.smtp_host or not tenant.smtp_user or not tenant.smtp_from:
        logger.warning(
            "SMTP no configurado o deshabilitado para tenant %s — email no enviado.",
            tenant.slug,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = tenant.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(tenant.smtp_host, tenant.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            if tenant.smtp_password:
                server.login(tenant.smtp_user, tenant.smtp_password)
            server.sendmail(tenant.smtp_from, to_email, msg.as_string())
        logger.info("Email enviado a %s (tenant: %s)", to_email, tenant.slug)
    except Exception as exc:
        logger.error("Error enviando email a %s: %s", to_email, exc)


def send_confirmation_email(
    reservation: Reservation,
    tenant: Tenant,
    frontend_url: str,
) -> None:
    cancel_url = f"{frontend_url}/reserva/cancelar/{reservation.cancel_token}"
    subject = f"✅ Reserva confirmada — {tenant.brand_name or tenant.name}"
    html = _build_confirmation_html(reservation, tenant, cancel_url)
    _send_email(tenant, reservation.guest_email, subject, html)


def send_reminder_email(
    reservation: Reservation,
    tenant: Tenant,
    frontend_url: str,
) -> None:
    confirm_url = f"{frontend_url}/reserva/confirmar/{reservation.confirm_token}"
    subject = f"⏰ Recordatorio: tu reserva es en 7 días — {tenant.brand_name or tenant.name}"
    html = _build_reminder_html(reservation, tenant, confirm_url)
    _send_email(tenant, reservation.guest_email, subject, html)
