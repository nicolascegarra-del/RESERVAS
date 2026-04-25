"""
Schemas Pydantic para políticas de cancelación y órdenes de devolución.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.cancellation import RefundOrderStatus


# ─── CancellationPolicy ──────────────────────────────────────────────────────


class CancellationPolicyCreate(BaseModel):
    accommodation_type_id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    full_refund_days: int = Field(ge=0)
    partial_refund_days: int = Field(ge=0)
    partial_refund_percentage: int = Field(ge=0, le=100)


class CancellationPolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    full_refund_days: int | None = Field(default=None, ge=0)
    partial_refund_days: int | None = Field(default=None, ge=0)
    partial_refund_percentage: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class CancellationPolicyRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID | None
    name: str
    full_refund_days: int
    partial_refund_days: int
    partial_refund_percentage: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Cálculo de reembolso (preview antes de cancelar) ────────────────────────


class RefundPreview(BaseModel):
    """Preview del reembolso antes de confirmar la cancelación."""

    reservation_id: UUID
    total_paid: Decimal
    refund_amount: Decimal
    refund_percentage: int
    days_before_checkin: int
    policy_name: str | None  # None si no hay política configurada
    tramo: str  # "full" | "partial" | "none"


# ─── RefundOrder ─────────────────────────────────────────────────────────────


class RefundOrderRead(BaseModel):
    id: UUID
    tenant_id: UUID
    reservation_id: UUID
    cancellation_policy_id: UUID | None
    total_paid: Decimal
    refund_amount: Decimal
    refund_percentage: int
    days_before_checkin: int
    cancellation_reason: str | None
    status: RefundOrderStatus
    processed_at: datetime | None
    stripe_refund_id: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RefundOrderProcess(BaseModel):
    """Body para procesar o rechazar una orden de devolución."""

    status: RefundOrderStatus = Field(
        description="Solo 'processed' o 'rejected' son válidos aquí."
    )
    notes: str | None = Field(default=None, max_length=2000)
    stripe_refund_id: str | None = Field(default=None, max_length=200)


class PaginatedRefundOrders(BaseModel):
    items: list[RefundOrderRead]
    total: int
    page: int
    pages: int


# ─── Cancelación de reserva ───────────────────────────────────────────────────


class CancelReservationRequest(BaseModel):
    """Body para cancelar una reserva."""

    cancellation_reason: str | None = Field(default=None, max_length=1000)
