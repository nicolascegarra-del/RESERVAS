"""
Schemas Pydantic para el módulo de facturación.

Cubre PaymentMethod, ReservationPayment, Invoice y paginación de facturas.
Los campos Decimal se serializan como str para compatibilidad JSON estricta.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.billing import InvoiceStatus, PaymentMethodType, PaymentStatus


# ─── PaymentMethod ────────────────────────────────────────────────────────────


class PaymentMethodCreate(BaseModel):
    """Datos para crear un método de pago manual."""

    name: str = Field(min_length=1, max_length=200)
    method_type: PaymentMethodType
    config: dict | None = None
    is_default: bool = False
    sort_order: int = Field(default=0, ge=0)


class PaymentMethodUpdate(BaseModel):
    """Actualización parcial de un método de pago."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None
    is_default: bool | None = None
    config: dict | None = None
    sort_order: int | None = Field(default=None, ge=0)


class PaymentMethodRead(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    method_type: PaymentMethodType
    is_active: bool
    is_default: bool
    config: dict | None
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── ReservationPayment ───────────────────────────────────────────────────────


class ReservationPaymentCreate(BaseModel):
    """Datos para registrar un cobro en una reserva."""

    payment_method_id: UUID
    amount: Decimal = Field(ge=0, decimal_places=2)
    notes: str | None = None


class ReservationPaymentRead(BaseModel):
    id: UUID
    tenant_id: UUID
    reservation_id: UUID
    payment_method_id: UUID
    payment_method_name: str
    amount: Decimal
    status: PaymentStatus
    gateway_transaction_id: str | None
    redsys_order: str | None
    paid_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Invoice ──────────────────────────────────────────────────────────────────


class InvoiceCreate(BaseModel):
    """Datos del receptor para generar una factura."""

    recipient_name: str = Field(min_length=1, max_length=255)
    recipient_nif: str | None = Field(default=None, max_length=30)
    recipient_address: str | None = None
    recipient_email: str | None = Field(default=None, max_length=254)


class InvoiceRead(BaseModel):
    id: UUID
    tenant_id: UUID
    reservation_id: UUID
    invoice_number: str
    invoice_series: str
    invoice_year: int
    invoice_sequence: int
    status: InvoiceStatus
    issuer_name: str | None
    issuer_cif: str | None
    issuer_address: str | None
    recipient_name: str
    recipient_nif: str | None
    recipient_address: str | None
    recipient_email: str | None
    lines: list
    base_imponible: Decimal
    total_iva: Decimal
    total_with_iva: Decimal
    currency: str
    payment_method_name: str | None
    pdf_url: str | None
    issued_at: datetime
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListItem(BaseModel):
    """Resumen de factura para listados paginados."""

    id: UUID
    invoice_number: str
    reservation_id: UUID
    status: InvoiceStatus
    recipient_name: str
    total_with_iva: Decimal
    issued_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedInvoices(BaseModel):
    items: list[InvoiceListItem]
    total: int
    page: int
    pages: int


# ─── Redsys ───────────────────────────────────────────────────────────────────


class RedsysFormData(BaseModel):
    """Datos necesarios para construir el formulario POST de redirección a Redsys."""

    redsys_url: str
    Ds_SignatureVersion: str
    Ds_MerchantParameters: str
    Ds_Signature: str
