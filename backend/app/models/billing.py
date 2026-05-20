"""
Modelos de facturación: métodos de pago, cobros de reserva, facturas y secuencias.

IMPORTANTE: Una reserva tiene como máximo un cobro y una factura (constraint UNIQUE).
El tenant_id se propaga en todos los modelos para el aislamiento multi-tenant.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, Numeric, String, UniqueConstraint
from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class PaymentMethodType(str, Enum):
    """Tipo de método de pago disponible."""

    cash = "cash"
    bank_transfer = "bank_transfer"
    tpv_manual = "tpv_manual"
    redsys = "redsys"
    stripe = "stripe"


class PaymentStatus(str, Enum):
    """Estado de un cobro de reserva."""

    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"


class InvoiceStatus(str, Enum):
    """Estado de una factura."""

    draft = "draft"
    issued = "issued"
    sent = "sent"
    cancelled = "cancelled"


class PaymentMethod(SQLModel, table=True):
    """
    Método de pago configurado por el tenant.

    Los tipos redsys y stripe se gestionan desde el panel de superadmin.
    Los métodos manuales (cash, bank_transfer, tpv_manual) los configura
    el company_admin desde su panel de configuración.
    """

    __tablename__ = "payment_methods"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)
    name: str = Field(max_length=200)
    method_type: PaymentMethodType = Field(sa_column=Column(String(50), nullable=False))
    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)
    # Configuración adicional: p.ej. {"iban": "ES12...", "bank_name": "Banco Ejemplo"}
    config: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReservationPayment(SQLModel, table=True):
    """
    Registro único de cobro asociado a una reserva.

    El constraint UNIQUE sobre reservation_id garantiza un solo cobro por reserva.
    El campo payment_method_name es un snapshot del nombre en el momento del cobro.
    """

    __tablename__ = "reservation_payments"
    __table_args__ = (
        UniqueConstraint("reservation_id", name="uq_reservation_payment"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True)
    payment_method_id: UUID = Field(foreign_key="payment_methods.id")
    # Snapshot del nombre del método al momento del cobro
    payment_method_name: str = Field(max_length=200)
    amount: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    status: PaymentStatus = Field(
        default=PaymentStatus.pending,
        sa_column=Column(String(30), nullable=False),
    )
    gateway_transaction_id: str | None = Field(default=None, max_length=255)
    # Código de orden enviado a Redsys (12 chars hex del UUID de reserva).
    # Se usa para correlacionar la notificación IPN con el pago.
    redsys_order: str | None = Field(default=None, max_length=12)
    paid_at: datetime | None = Field(default=None)
    notes: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Invoice(SQLModel, table=True):
    """
    Factura emitida para una reserva.

    La numeración sigue el formato {series}-{year}-{sequence:04d}, por ejemplo FAC-2025-0001.
    Los datos del emisor y receptor son snapshots en el momento de la emisión.
    Las líneas contienen el desglose de base imponible e IVA.
    """

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoice_number"),
        UniqueConstraint("reservation_id", name="uq_invoice_reservation"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True)
    invoice_number: str = Field(max_length=50)
    invoice_series: str = Field(max_length=20, default="FAC")
    invoice_year: int
    invoice_sequence: int
    status: InvoiceStatus = Field(
        default=InvoiceStatus.issued,
        sa_column=Column(String(30), nullable=False),
    )
    # Snapshot del emisor (datos fiscales del tenant)
    issuer_name: str | None = Field(default=None, max_length=255)
    issuer_cif: str | None = Field(default=None, max_length=30)
    issuer_address: str | None = Field(default=None)
    # Datos del receptor (cliente)
    recipient_name: str = Field(max_length=255)
    recipient_nif: str | None = Field(default=None, max_length=30)
    recipient_address: str | None = Field(default=None)
    # Solo para envío, no aparece impreso en la factura
    recipient_email: str | None = Field(default=None, max_length=254)
    # Líneas de factura: [{description, quantity, unit_price_net, iva_rate,
    #                       iva_amount, line_total_net, line_total_with_iva}]
    lines: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    base_imponible: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    total_iva: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    total_with_iva: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    currency: str = Field(default="EUR", max_length=3)
    payment_method_name: str | None = Field(default=None, max_length=200)
    pdf_url: str | None = Field(default=None, max_length=500)
    issued_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InvoiceSequence(SQLModel, table=True):
    """
    Contador de secuencia de facturas por tenant y año.

    La clave primaria compuesta (tenant_id, year) garantiza una secuencia
    independiente por empresa y ejercicio fiscal.
    El acceso con SELECT ... FOR UPDATE previene condiciones de carrera.
    """

    __tablename__ = "invoice_sequences"

    tenant_id: UUID = Field(foreign_key="tenants.id", primary_key=True)
    year: int = Field(primary_key=True)
    last_sequence: int = Field(default=0)
    invoice_series: str = Field(default="FAC", max_length=20)
