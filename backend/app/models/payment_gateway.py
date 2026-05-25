"""
Modelo TenantPaymentGateway — pasarelas de pago configuradas por empresa.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class TenantPaymentGateway(SQLModel, table=True):
    __tablename__ = "tenant_payment_gateways"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)

    # "stripe" | "redsys"
    type: str = Field(max_length=20)
    name: str = Field(max_length=255)
    is_active: bool = Field(default=False)

    # ─── Stripe ──────────────────────────────────────────────────────────────
    stripe_secret_key: str | None = Field(default=None, max_length=500)
    stripe_webhook_secret: str | None = Field(default=None, max_length=500)
    stripe_currency: str = Field(default="eur", max_length=3)

    # ─── Redsys ──────────────────────────────────────────────────────────────
    redsys_merchant_code: str | None = Field(default=None, max_length=15)
    redsys_terminal: str | None = Field(default=None, max_length=3)
    redsys_secret_key: str | None = Field(default=None, max_length=500)
    redsys_currency: str = Field(default="978", max_length=3)
    redsys_environment: str = Field(default="sandbox", max_length=20)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
