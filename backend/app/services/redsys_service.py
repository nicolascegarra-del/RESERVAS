"""
Servicio de integración con Redsys — algoritmo HMAC_SHA512_V2.

Todas las funciones criptográficas son puras (sin acceso a BD).
La función principal `initiate_payment` orquesta la creación del pago y
la firma de los parámetros necesarios para el formulario de redirección.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from Crypto.Cipher import AES
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.crypto import decrypt_secret
from app.models.billing import PaymentMethod, PaymentMethodType, PaymentStatus, ReservationPayment
from app.models.reservation import Reservation
from app.models.tenant import Tenant

# ─── URLs de pasarela ─────────────────────────────────────────────────────────

_REDSYS_URL_TEST = "https://sis-t.redsys.es:25443/sis/realizarPago"
_REDSYS_URL_PROD = "https://sis.redsys.es/sis/realizarPago"


def get_redsys_url(environment: str) -> str:
    """
    Devuelve la URL de Redsys según el entorno configurado en el tenant.

    Args:
        environment: "test" | "sandbox" → test; cualquier otro → producción.
    """
    if environment in ("test", "sandbox"):
        return _REDSYS_URL_TEST
    return _REDSYS_URL_PROD


# ─── Criptografía Redsys ──────────────────────────────────────────────────────


def _derive_key(secret_key_b64: str, order: str) -> bytes:
    """
    Deriva la clave de firma a partir de la clave secreta Redsys y el número de orden.

    Proceso:
    1. Decodificar la clave de Base64 estándar → raw bytes (clave AES de 24 bytes).
    2. Padear el order a múltiplo de 16 con bytes nulos.
    3. Cifrar con AES-CBC, IV = 16 bytes nulos.

    Args:
        secret_key_b64: Clave Redsys del tenant tal como la proporcionan (Base64 estándar).
        order: Código de orden (DS_MERCHANT_ORDER).

    Returns:
        Clave derivada en bytes.
    """
    raw_key = base64.b64decode(secret_key_b64)
    iv = bytes(16)

    order_bytes = order.encode("utf-8")
    # Padding nulo al múltiplo de 16 más cercano
    pad_length = 16 - (len(order_bytes) % 16)
    padded_order = order_bytes + bytes(pad_length)

    cipher = AES.new(raw_key, AES.MODE_CBC, iv)
    return cipher.encrypt(padded_order)


def build_merchant_parameters(params: dict) -> str:
    """
    Serializa el diccionario de parámetros a JSON y lo codifica en Base64 URL-safe sin padding.

    Args:
        params: Diccionario con los parámetros DS_MERCHANT_*.

    Returns:
        String Base64 URL-safe sin padding (Ds_MerchantParameters).
    """
    json_bytes = json.dumps(params, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(json_bytes).rstrip(b"=").decode("utf-8")


def sign_request(secret_key_b64: str, merchant_params: str, order: str) -> str:
    """
    Calcula la firma HMAC-SHA512 de los parámetros usando la clave derivada.

    Args:
        secret_key_b64: Clave Redsys del tenant (Base64 estándar).
        merchant_params: Valor de Ds_MerchantParameters ya codificado en Base64.
        order: Código de orden para derivar la clave.

    Returns:
        Firma en Base64 URL-safe sin padding (Ds_Signature).
    """
    derived = _derive_key(secret_key_b64, order)
    mac = hmac.new(derived, merchant_params.encode("utf-8"), hashlib.sha512)
    return base64.urlsafe_b64encode(mac.digest()).rstrip(b"=").decode("utf-8")


def verify_notification(
    secret_key_b64: str,
    merchant_params_b64: str,
    received_signature: str,
) -> bool:
    """
    Verifica que la firma de una notificación IPN de Redsys es válida.

    Extrae el order de los parámetros decodificados, recalcula la firma
    y la compara de forma segura con la recibida.

    Args:
        secret_key_b64: Clave Redsys del tenant (Base64 estándar).
        merchant_params_b64: Valor Ds_MerchantParameters recibido de Redsys.
        received_signature: Valor Ds_Signature recibido de Redsys.

    Returns:
        True si la firma es válida, False en caso contrario.
    """
    try:
        params = decode_merchant_parameters(merchant_params_b64)
        order = params.get("Ds_Order", "")
        expected = sign_request(secret_key_b64, merchant_params_b64, order)
        # Normalizar padding para la comparación (Redsys puede enviar con o sin '=')
        expected_bytes = expected.encode("utf-8")
        received_bytes = received_signature.strip().encode("utf-8")
        return hmac.compare_digest(expected_bytes, received_bytes)
    except Exception:
        return False


def decode_merchant_parameters(merchant_params_b64: str) -> dict:
    """
    Decodifica Ds_MerchantParameters de Base64 URL-safe a diccionario.

    Añade el padding necesario antes de decodificar, ya que Redsys
    puede enviar el valor sin caracteres '='.

    Args:
        merchant_params_b64: Valor de Ds_MerchantParameters.

    Returns:
        Diccionario con los parámetros de la notificación.
    """
    missing = len(merchant_params_b64) % 4
    padded = merchant_params_b64 + "=" * (4 - missing) if missing else merchant_params_b64
    json_bytes = base64.urlsafe_b64decode(padded)
    return json.loads(json_bytes.decode("utf-8"))


def is_payment_approved(ds_response: str) -> bool:
    """
    Determina si la respuesta Redsys indica pago aprobado.

    Redsys aprueba con códigos 0000–0099.

    Args:
        ds_response: Valor del campo Ds_Response de la notificación.

    Returns:
        True si el pago está aprobado.
    """
    try:
        code = int(ds_response)
        return 0 <= code <= 99
    except (ValueError, TypeError):
        return False


# ─── Función principal ────────────────────────────────────────────────────────


async def initiate_payment(
    reservation: Reservation,
    tenant: Tenant,
    session: AsyncSession,
    backend_url: str,
    frontend_url: str,
) -> dict:
    """
    Valida la configuración Redsys del tenant, busca o crea el ReservationPayment
    en estado pending y construye los parámetros firmados para el formulario POST.

    Args:
        reservation: Reserva a pagar.
        tenant: Tenant con la configuración Redsys.
        session: Sesión de BD asíncrona.
        backend_url: URL base del backend para la URL de notificación IPN.
        frontend_url: URL base del frontend para las URLs de retorno OK/KO.

    Returns:
        Diccionario con: redsys_url, Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature.

    Raises:
        HTTPException 422: Si Redsys no está habilitado o mal configurado.
    """
    # ── Validar configuración Redsys ─────────────────────────────────────────
    if not tenant.redsys_enabled:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "REDSYS_NOT_ENABLED",
                    "message": "Redsys no está habilitado para esta empresa.",
                }
            },
        )
    if not tenant.redsys_merchant_code or not tenant.redsys_terminal or not tenant.redsys_secret_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "REDSYS_NOT_CONFIGURED",
                    "message": "La configuración de Redsys está incompleta. Contacte con el administrador.",
                }
            },
        )

    # ── Descifrar clave secreta ───────────────────────────────────────────────
    plain_secret_key = decrypt_secret(tenant.redsys_secret_key)

    # ── Construir el código de orden (12 chars hex del UUID) ─────────────────
    order_code = str(reservation.id).replace("-", "")[:12]

    # ── Buscar o crear el ReservationPayment ─────────────────────────────────
    existing_result = await session.exec(
        select(ReservationPayment).where(
            ReservationPayment.reservation_id == reservation.id,
        )
    )
    existing_payment = existing_result.first()

    if existing_payment:
        # Si ya existe un pago completado no iniciamos otro proceso
        if existing_payment.status == PaymentStatus.completed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "PAYMENT_ALREADY_COMPLETED",
                        "message": "Esta reserva ya tiene un pago completado.",
                    }
                },
            )
        # Si existe en pending o failed, reutilizamos el registro actualizando el order
        existing_payment.redsys_order = order_code
        existing_payment.status = PaymentStatus.pending
        existing_payment.updated_at = datetime.utcnow()
        session.add(existing_payment)
    else:
        # Buscar el método de pago Redsys activo del tenant
        pm_result = await session.exec(
            select(PaymentMethod).where(
                PaymentMethod.tenant_id == tenant.id,
                PaymentMethod.method_type == PaymentMethodType.redsys,
                PaymentMethod.is_active == True,  # noqa: E712
            )
        )
        redsys_method = pm_result.first()
        if not redsys_method:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "REDSYS_PAYMENT_METHOD_NOT_FOUND",
                        "message": "No hay un método de pago Redsys activo configurado.",
                    }
                },
            )

        now = datetime.utcnow()
        existing_payment = ReservationPayment(
            tenant_id=tenant.id,
            reservation_id=reservation.id,
            payment_method_id=redsys_method.id,
            payment_method_name=redsys_method.name,
            amount=reservation.total_with_iva,
            status=PaymentStatus.pending,
            redsys_order=order_code,
            created_at=now,
            updated_at=now,
        )
        session.add(existing_payment)

    await session.commit()

    # ── Construir parámetros del formulario ──────────────────────────────────
    amount_cents = str(int(reservation.total_with_iva * Decimal("100")))

    params = {
        "DS_MERCHANT_AMOUNT": amount_cents,
        "DS_MERCHANT_ORDER": order_code,
        "DS_MERCHANT_MERCHANTCODE": tenant.redsys_merchant_code,
        "DS_MERCHANT_CURRENCY": tenant.redsys_currency,
        "DS_MERCHANT_TRANSACTIONTYPE": "0",
        "DS_MERCHANT_TERMINAL": tenant.redsys_terminal,
        "DS_MERCHANT_MERCHANTURL": f"{backend_url}/api/v1/redsys/notification",
        "DS_MERCHANT_URLOK": f"{frontend_url}/pago/ok?reserva={reservation.id}",
        "DS_MERCHANT_URLKO": f"{frontend_url}/pago/ko?reserva={reservation.id}",
    }
    if getattr(tenant, "redsys_bizum_enabled", False):
        params["DS_MERCHANT_PAYMETHODS"] = "xz"

    merchant_params = build_merchant_parameters(params)
    signature = sign_request(plain_secret_key, merchant_params, order_code)

    return {
        "redsys_url": get_redsys_url(tenant.redsys_environment),
        "Ds_SignatureVersion": "HMAC_SHA512_V2",
        "Ds_MerchantParameters": merchant_params,
        "Ds_Signature": signature,
    }


# ─── Lookup de tenant por merchant code ───────────────────────────────────────


async def get_tenant_by_merchant_code(
    session: AsyncSession,
    merchant_code: str,
) -> Tenant | None:
    """
    Busca el tenant que tiene configurado el merchant code de Redsys indicado.

    Se usa en el IPN para identificar el tenant sin autenticación JWT.

    Args:
        session: Sesión de BD asíncrona.
        merchant_code: Código de comercio Redsys recibido en la notificación.

    Returns:
        Tenant encontrado o None.
    """
    result = await session.exec(
        select(Tenant).where(
            Tenant.redsys_merchant_code == merchant_code,
            Tenant.redsys_enabled == True,  # noqa: E712
        )
    )
    return result.first()


async def get_payment_by_redsys_order(
    session: AsyncSession,
    redsys_order: str,
    tenant_id: UUID,
) -> ReservationPayment | None:
    """
    Busca el ReservationPayment por el código de orden Redsys y tenant_id.

    Args:
        session: Sesión de BD asíncrona.
        redsys_order: Código de orden (DS_MERCHANT_ORDER).
        tenant_id: UUID del tenant para aislar la búsqueda.

    Returns:
        ReservationPayment encontrado o None.
    """
    result = await session.exec(
        select(ReservationPayment).where(
            ReservationPayment.redsys_order == redsys_order,
            ReservationPayment.tenant_id == tenant_id,
        )
    )
    return result.first()
