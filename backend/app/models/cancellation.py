"""
Modelos de políticas de cancelación y órdenes de devolución.

CancellationPolicy: reglas configurables por tenant (y opcionalmente por tipo
de alojamiento). Define los tramos de reembolso según los días de antelación.

RefundOrder: registro de cada devolución generada al cancelar una reserva.
Puede procesarse manualmente o (Sprint 6) vía Stripe.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric
from sqlmodel import Field, SQLModel


class RefundOrderStatus(str, Enum):
    """Estado de una orden de devolución."""

    pending = "pending"       # Pendiente de procesar
    processed = "processed"   # Reembolso ejecutado
    rejected = "rejected"     # Rechazado (sin reembolso)


class CancellationPolicy(SQLModel, table=True):
    """
    Política de cancelación configurable por tenant.

    Define tres tramos de reembolso según los días de antelación:
      - Tramo 1: ≥ full_refund_days  → 100% de reembolso
      - Tramo 2: ≥ partial_refund_days (y < full_refund_days) → partial_refund_percentage%
      - Tramo 3: < partial_refund_days → 0% de reembolso

    Si accommodation_type_id es None, aplica a todos los tipos del tenant.
    Cuando hay política específica de tipo Y política global, gana la específica.
    """

    __tablename__ = "cancellation_policies"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)

    # None = política global del tenant; con valor = política por tipo
    accommodation_type_id: UUID | None = Field(
        default=None, foreign_key="accommodation_types.id", index=True, nullable=True
    )

    name: str = Field(max_length=200)

    # Tramo 1: días de antelación mínimos para reembolso completo
    full_refund_days: int = Field(ge=0)

    # Tramo 2: días de antelación para reembolso parcial
    partial_refund_days: int = Field(ge=0)

    # Porcentaje a reembolsar en el tramo 2 (0-100)
    partial_refund_percentage: int = Field(ge=0, le=100)

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())


class RefundOrder(SQLModel, table=True):
    """
    Orden de devolución generada al cancelar una reserva con política activa.

    Registra el importe a reembolsar y su estado de procesado.
    En Sprint 6 se añadirá stripe_refund_id para el flujo automático.
    """

    __tablename__ = "refund_orders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    reservation_id: UUID = Field(
        foreign_key="reservations.id", index=True, nullable=False
    )

    # Política aplicada (None si no había política configurada)
    cancellation_policy_id: UUID | None = Field(
        default=None, foreign_key="cancellation_policies.id", nullable=True
    )

    # Snapshot del cálculo de reembolso
    total_paid: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    refund_amount: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    refund_percentage: int = Field(ge=0, le=100)

    # Contexto de la cancelación
    days_before_checkin: int  # días entre cancelación y check_in
    cancellation_reason: str | None = Field(default=None, max_length=1000)

    # Estado de procesado
    status: RefundOrderStatus = Field(
        default=RefundOrderStatus.pending,
        sa_column=Column(
            SAEnum(RefundOrderStatus, name="refundorderstatus"), nullable=False
        ),
    )
    processed_at: datetime | None = Field(default=None, nullable=True)

    # Preparado para Stripe (Sprint 6)
    stripe_refund_id: str | None = Field(default=None, max_length=200)

    notes: str | None = Field(default=None, max_length=2000)

    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
