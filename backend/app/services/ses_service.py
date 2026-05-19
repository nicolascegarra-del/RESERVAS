"""
Servicio SES — parte de viajeros para el Ministerio del Interior (España).

Genera el XML del parte de hospedería (RD 933/2021, "Sistema de Entrada
de Hospederías") con una entrada por viajero de la reserva y permite
enviarlo a la plataforma SES mediante su servicio web SOAP.

Notas de implementación:
  - El esquema oficial SES es extenso; aquí se genera la estructura
    `peticion/solicitud/comunicacion` con los campos mínimos requeridos
    para una comunicación de tipo "parte de hospedería" (alta de viajeros).
  - Las credenciales (código de establecimiento, usuario y contraseña)
    se almacenan en el tenant. La contraseña va cifrada con
    app.core.crypto.encrypt_secret y se descifra solo aquí, en memoria.
  - send_to_ses NO loguea credenciales ni el XML completo (puede contener
    datos personales: DNI, fecha de nacimiento, etc.).
"""

import logging
from datetime import date
from xml.sax.saxutils import escape

import httpx

from app.core.crypto import decrypt_secret
from app.models.reservation import Reservation
from app.models.reservation_guest import ReservationGuest
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# Endpoint de producción del servicio web de hospedajes del SES.
# Si el Ministerio publica una URL de pruebas distinta, configurarla por env.
SES_ENDPOINT = "https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion"

# Mapeo del tipo de documento Klyp → catálogo de tipos de documento SES.
_SES_DOC_TYPE = {
    "dni": "NIF",
    "nie": "NIE",
    "passport": "PAS",
}


class SESConfigError(Exception):
    """El tenant no tiene las credenciales SES configuradas."""


class SESSendError(Exception):
    """El envío al SES falló (red, autenticación o rechazo del servicio)."""


def _fmt_date(value: date | None) -> str:
    """Formatea una fecha como YYYY-MM-DD o cadena vacía."""
    return value.isoformat() if value else ""


def _xml_text(value: str | None) -> str:
    """Escapa texto para insertarlo de forma segura en el XML."""
    return escape(value) if value else ""


def generate_ses_xml(
    reservation: Reservation,
    guests: list[ReservationGuest],
    tenant: Tenant,
) -> str:
    """
    Genera el XML del parte de viajeros en formato SES (hospedería).

    Args:
        reservation: Reserva de la que se reporta la estancia.
        guests: Lista de viajeros con sus datos identificativos.
        tenant: Establecimiento (datos fiscales + código SES).

    Returns:
        El documento XML como string (UTF-8, declaración incluida).
    """
    establishment_code = tenant.ses_establishment_code or ""

    personas_xml: list[str] = []
    for g in guests:
        doc_type_ses = _SES_DOC_TYPE.get((g.doc_type or "").lower(), "OTRO")
        personas_xml.append(
            f"""        <persona>
          <rol>VIAJERO</rol>
          <nombre>{_xml_text(g.first_name)}</nombre>
          <apellido1>{_xml_text(g.last_name)}</apellido1>
          <tipoDocumento>{doc_type_ses}</tipoDocumento>
          <numeroDocumento>{_xml_text(g.doc_number)}</numeroDocumento>
          <nacionalidad>{_xml_text(g.nationality)}</nacionalidad>
          <fechaNacimiento>{_fmt_date(g.date_of_birth)}</fechaNacimiento>
          <sexo>{_xml_text(g.sex)}</sexo>
        </persona>"""
        )

    personas_block = "\n".join(personas_xml)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<peticion>
  <solicitud>
    <codigoEstablecimiento>{_xml_text(establishment_code)}</codigoEstablecimiento>
    <comunicacion>
      <contrato>
        <referencia>{reservation.id}</referencia>
        <fechaContrato>{_fmt_date(reservation.created_at.date())}</fechaContrato>
        <fechaEntrada>{_fmt_date(reservation.check_in)}</fechaEntrada>
        <fechaSalida>{_fmt_date(reservation.check_out)}</fechaSalida>
        <numPersonas>{len(guests)}</numPersonas>
      </contrato>
      <personas>
{personas_block}
      </personas>
    </comunicacion>
  </solicitud>
</peticion>
"""


def _build_soap_envelope(xml_payload: str, username: str, password: str) -> str:
    """Envuelve el XML del parte en un sobre SOAP con cabecera WS-Security."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:ws="http://www.neg.hospedajes.mir.es/altaParteHospedaje">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>{escape(username)}</wsse:Username>
        <wsse:Password>{escape(password)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ws:peticion><![CDATA[{xml_payload}]]></ws:peticion>
  </soapenv:Body>
</soapenv:Envelope>
"""


async def send_to_ses(xml_content: str, tenant: Tenant) -> dict:
    """
    Envía el parte de viajeros al servicio web del SES.

    Args:
        xml_content: XML generado por generate_ses_xml.
        tenant: Establecimiento con las credenciales SES.

    Returns:
        dict con la respuesta: {"status": "sent"|"error", "detail": str}

    Raises:
        SESConfigError: Si faltan credenciales SES en el tenant.
        SESSendError: Si la petición falla a nivel de transporte.
    """
    if (
        not tenant.ses_enabled
        or not tenant.ses_establishment_code
        or not tenant.ses_username
        or not tenant.ses_password
    ):
        raise SESConfigError(
            "El establecimiento no tiene configuradas las credenciales SES."
        )

    username = tenant.ses_username
    password = decrypt_secret(tenant.ses_password)
    envelope = _build_soap_envelope(xml_content, username, password)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                SES_ENDPOINT,
                content=envelope.encode("utf-8"),
                headers={
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": "altaParteHospedaje",
                },
            )
    except httpx.HTTPError as exc:
        # No logueamos el cuerpo: contiene credenciales y datos personales
        logger.error("Error de transporte enviando parte SES: %s", exc)
        raise SESSendError("No se pudo contactar con el servicio SES.") from exc

    if response.status_code >= 400:
        logger.error(
            "El SES rechazó el parte de viajeros (HTTP %s)",
            response.status_code,
        )
        return {
            "status": "error",
            "detail": (
                f"El SES respondió con código {response.status_code}. "
                "Revisa las credenciales y el código de establecimiento."
            ),
        }

    logger.info(
        "Parte de viajeros enviado al SES correctamente (tenant %s)",
        tenant.slug,
    )
    return {"status": "sent", "detail": "Parte de viajeros enviado al SES."}
