"""
Router de integración Redsys — inicio de pago y notificación IPN.

Endpoints:
- POST /redsys/initiate/{reservation_id}  — autenticado, devuelve datos de formulario.
- POST /redsys/notification               — público, recibe IPN de Redsys (form-encoded).

Seguridad IPN:
- La firma HMAC_SHA512_V2 se verifica antes de cualquier cambio de estado.
- Nunca se modifica el estado del pago desde las URLs de retorno (URLOK/URLKO).
- Siempre devuelve HTTP 200 para evitar reintentos de Redsys.
"""

import os
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.core.crypto import decrypt_secret
from app.models.billing import PaymentStatus
from app.models.reservation import Reservation
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.billing import RedsysFormData
from app.services import redsys_service

router = APIRouter(tags=["Redsys"])

ManageDep = Annotated[
    User,
    Depends(
        require_role(
            UserRole.company_admin,
            UserRole.reception,
            UserRole.super_admin,
        )
    ),
]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _resolve_tenant_id(current_user: User, tenant_id_override: str | None) -> str:
    """
    Resuelve el tenant_id efectivo para la operación, siguiendo el mismo
    patrón que el resto de routers del proyecto.
    """
    if tenant_id_override:
        if current_user.role != UserRole.super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Solo super_admin puede especificar un tenant diferente.",
                    }
                },
            )
        return tenant_id_override
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "MISSING_TENANT",
                    "message": "El usuario no tiene tenant asignado.",
                }
            },
        )
    return str(current_user.tenant_id)


# ─── POST /redsys/initiate/{reservation_id} ───────────────────────────────────


@router.post(
    "/redsys/initiate/{reservation_id}",
    response_model=RedsysFormData,
    summary="Iniciar pago Redsys",
    description=(
        "Valida la configuración Redsys del tenant, crea o actualiza el registro "
        "de pago en estado pending y devuelve los parámetros firmados para el "
        "formulario de redirección a la pasarela."
    ),
)
async def initiate_redsys_payment(
    reservation_id: str,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: str | None = Query(default=None, description="Solo para super_admin"),
) -> RedsysFormData:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)

    # Cargar reserva verificando pertenencia al tenant
    reservation_result = await session.exec(
        select(Reservation).where(
            Reservation.id == UUID(reservation_id),
            Reservation.tenant_id == UUID(effective_tenant_id),
        )
    )
    reservation = reservation_result.first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": "Reserva no encontrada.",
                }
            },
        )

    # Cargar tenant con configuración Redsys
    tenant = await session.get(Tenant, UUID(effective_tenant_id))
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "TENANT_NOT_FOUND",
                    "message": "Empresa no encontrada.",
                }
            },
        )

    backend_url = os.getenv("BACKEND_URL", "").rstrip("/")
    frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")

    result = await redsys_service.initiate_payment(
        reservation=reservation,
        tenant=tenant,
        session=session,
        backend_url=backend_url,
        frontend_url=frontend_url,
    )

    return RedsysFormData(**result)


# ─── POST /redsys/notification ────────────────────────────────────────────────


@router.post(
    "/redsys/notification",
    summary="Notificación IPN Redsys",
    description=(
        "Endpoint público que recibe la notificación IPN de Redsys en formato "
        "application/x-www-form-urlencoded. Verifica la firma HMAC_SHA512_V2 "
        "y actualiza el estado del pago. Siempre devuelve HTTP 200."
    ),
    status_code=status.HTTP_200_OK,
    # Sin modelo de respuesta — Redsys solo necesita HTTP 200
    response_model=None,
)
async def redsys_notification(
    session: SessionDep,
    ds_signature_version: Annotated[str, Form(alias="Ds_SignatureVersion")],
    ds_merchant_parameters: Annotated[str, Form(alias="Ds_MerchantParameters")],
    ds_signature: Annotated[str, Form(alias="Ds_Signature")],
) -> None:
    """
    Procesa la notificación IPN de Redsys.

    La verificación de firma es la única fuente de verdad para actualizar
    el estado del pago — nunca las URLs URLOK/URLKO del frontend.
    Devuelve siempre 200 para evitar que Redsys reintente la notificación.
    """
    # Solo procesamos la versión de firma que conocemos
    if ds_signature_version != "HMAC_SHA512_V2":
        return

    # Decodificar parámetros para extraer order y merchant code
    try:
        params = redsys_service.decode_merchant_parameters(ds_merchant_parameters)
    except Exception:
        # Si no podemos decodificar los parámetros no hay nada que hacer
        return

    ds_order = params.get("Ds_Order", "")
    ds_merchant_code = params.get("Ds_MerchantCode", "")
    ds_response = params.get("Ds_Response", "")

    if not ds_order or not ds_merchant_code:
        return

    # Buscar el tenant por merchant code
    tenant = await redsys_service.get_tenant_by_merchant_code(session, ds_merchant_code)
    if not tenant:
        return

    # Descifrar la clave Redsys del tenant
    if not tenant.redsys_secret_key:
        return

    plain_secret_key = decrypt_secret(tenant.redsys_secret_key)

    # Verificar la firma — si no es válida, ignorar la notificación
    signature_valid = redsys_service.verify_notification(
        secret_key_b64=plain_secret_key,
        merchant_params_b64=ds_merchant_parameters,
        received_signature=ds_signature,
    )

    # Buscar el pago por el código de orden
    payment = await redsys_service.get_payment_by_redsys_order(
        session, ds_order, tenant.id
    )

    if not signature_valid:
        # Firma inválida — marcar como fallido si existe el pago
        if payment:
            payment.status = PaymentStatus.failed
            payment.updated_at = datetime.utcnow()
            session.add(payment)
            await session.commit()
        return

    if not payment:
        # No encontramos el pago asociado — no podemos actualizar nada
        return

    payment_approved = redsys_service.is_payment_approved(ds_response)

    if payment_approved:
        payment.status = PaymentStatus.completed
        payment.paid_at = datetime.utcnow()
        payment.gateway_transaction_id = params.get("Ds_AuthorisationCode")
    else:
        payment.status = PaymentStatus.failed

    payment.updated_at = datetime.utcnow()
    session.add(payment)
    await session.commit()
