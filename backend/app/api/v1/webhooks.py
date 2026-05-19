"""
Router de webhooks externos.

POST /webhooks/stripe/{tenant_slug}
  Recibe eventos de Stripe y actualiza el estado de la reserva.
  La URL incluye el slug del tenant para resolver las claves correctas.

IMPORTANTE: Este endpoint debe recibir el body RAW (sin parsear por FastAPI)
para que la verificación de firma de Stripe funcione correctamente.
"""

import logging
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models.reservation import Reservation, ReservationStatus
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant
from app.services.email_service import send_confirmation_email
from app.services.stripe_service import verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "/stripe/{tenant_slug}",
    status_code=status.HTTP_200_OK,
    summary="Webhook de Stripe por empresa",
)
async def stripe_webhook(
    tenant_slug: str,
    request: Request,
    session: SessionDep,
) -> dict:
    """
    Procesa eventos de Stripe para un tenant específico.

    Evento manejado:
    - checkout.session.completed → reserva confirmed + email de confirmación
    """
    # Resolver tenant
    result = await session.exec(
        select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active == True)  # noqa: E712
    )
    tenant = result.first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant '{tenant_slug}' no encontrado."}},
        )

    # Leer body raw para verificar la firma
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = verify_webhook_signature(payload, sig_header, tenant)
    except stripe.SignatureVerificationError:
        logger.warning("Firma Stripe inválida para tenant %s", tenant_slug)
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_SIGNATURE", "message": "Firma del webhook inválida."}})
    except ValueError as exc:
        logger.error("Error verificando webhook Stripe: %s", exc)
        raise HTTPException(status_code=400, detail={"error": {"code": "WEBHOOK_ERROR", "message": str(exc)}})

    # Procesar el evento
    if event["type"] == "checkout.session.completed":
        session_data = event["data"]["object"]
        metadata = session_data.get("metadata", {})
        reservation_id = metadata.get("reservation_id")

        if not reservation_id:
            logger.warning("Webhook sin reservation_id en metadata")
            return {"status": "ignored"}

        try:
            from uuid import UUID
            res_uuid = UUID(reservation_id)
        except ValueError:
            logger.error("reservation_id inválido: %s", reservation_id)
            return {"status": "error"}

        res_result = await session.exec(
            select(Reservation).where(
                Reservation.id == res_uuid,
                Reservation.tenant_id == tenant.id,
            )
        )
        reservation = res_result.first()

        if not reservation:
            logger.warning("Reserva %s no encontrada para tenant %s", reservation_id, tenant_slug)
            return {"status": "not_found"}

        if reservation.status == ReservationStatus.pending_payment:
            # Guardar el stripe session id
            stripe_session_id = session_data.get("id")
            reservation.stripe_session_id = stripe_session_id
            reservation.status = ReservationStatus.confirmed
            session.add(reservation)
            await session.commit()
            await session.refresh(reservation)

            # Enviar email de confirmación (sincrónico — si falla no afecta al webhook)
            try:
                system_smtp = await session.get(SystemSettings, 1)
                send_confirmation_email(reservation, tenant, settings.frontend_url, system_smtp)
            except Exception as email_exc:
                logger.error("Error enviando email de confirmación: %s", email_exc)

            # Generar el token de carga de documentos y enviar su email.
            try:
                from app.services import guest_doc_service

                token = await guest_doc_service.get_or_create_token(session, reservation)
                await session.commit()
                await session.refresh(token)
                await guest_doc_service.send_docs_link_email(
                    session, reservation, tenant, token.token
                )
            except Exception as docs_exc:  # noqa: BLE001
                logger.error("Error enviando email de documentos: %s", docs_exc)

            logger.info("Reserva %s confirmada via Stripe webhook", reservation_id)

    return {"status": "ok"}
