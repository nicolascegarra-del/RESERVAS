"""
Servicio de integración con Stripe.

Lee las claves del tenant — cada empresa usa sus propias claves.
Si stripe_enabled=False o faltan claves, lanza un error descriptivo.
"""

import logging
from decimal import Decimal

import stripe

from app.models.reservation import Reservation
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


def _get_stripe_client(tenant: Tenant) -> stripe.StripeClient:
    """Devuelve un cliente Stripe configurado para el tenant."""
    if not tenant.stripe_enabled or not tenant.stripe_secret_key:
        raise ValueError(
            f"Stripe no está configurado o habilitado para '{tenant.slug}'. "
            "Configura stripe_secret_key y activa stripe_enabled desde el panel de super admin."
        )
    return stripe.StripeClient(api_key=tenant.stripe_secret_key)


def create_checkout_session(
    reservation: Reservation,
    tenant: Tenant,
    unit_name: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """
    Crea una Stripe Checkout Session para el pago de una reserva.

    Returns:
        URL de la página de pago de Stripe.

    Raises:
        ValueError: Si Stripe no está configurado para el tenant.
        stripe.StripeError: Si hay un error en la API de Stripe.
    """
    client = _get_stripe_client(tenant)

    # Convertir a céntimos (Stripe usa enteros)
    amount_cents = int(Decimal(str(reservation.total_price)) * 100)

    nights = (reservation.check_out - reservation.check_in).days
    description = (
        f"{unit_name} · {reservation.check_in.strftime('%d/%m/%Y')} → "
        f"{reservation.check_out.strftime('%d/%m/%Y')} · {nights} noche{'s' if nights != 1 else ''}"
    )

    session = client.checkout.sessions.create(
        params={
            "payment_method_types": ["card", "paypal"],
            "line_items": [
                {
                    "price_data": {
                        "currency": tenant.stripe_currency or "eur",
                        "unit_amount": amount_cents,
                        "product_data": {
                            "name": f"Reserva — {tenant.brand_name or tenant.name}",
                            "description": description,
                        },
                    },
                    "quantity": 1,
                }
            ],
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "customer_email": reservation.guest_email,
            "metadata": {
                "reservation_id": str(reservation.id),
                "tenant_slug": tenant.slug,
            },
        }
    )

    return session.url  # type: ignore[return-value]


def verify_webhook_signature(
    payload: bytes,
    sig_header: str,
    tenant: Tenant,
) -> stripe.Event:
    """
    Verifica la firma del webhook de Stripe y devuelve el evento.

    Raises:
        stripe.SignatureVerificationError: Si la firma no es válida.
        ValueError: Si no hay webhook secret configurado.
    """
    if not tenant.stripe_webhook_secret:
        raise ValueError(f"Stripe webhook secret no configurado para '{tenant.slug}'.")

    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=sig_header,
        secret=tenant.stripe_webhook_secret,
    )
