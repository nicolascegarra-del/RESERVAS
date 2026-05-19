"""
Modelo de reserva multi-tenant.

Una reserva captura un snapshot del precio al momento de su creación.
El precio no cambia aunque el admin modifique tarifas después.

Estados: pending_payment → confirmed → checked_in → checked_out
                                  ↘ cancelled / no_show
"""

import uuid as uuid_lib
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy import JSON, Numeric
from sqlmodel import Field, SQLModel


class ReservationStatus(str, Enum):
    """Estados posibles de una reserva."""

    pending_payment = "pending_payment"
    confirmed = "confirmed"
    checked_in = "checked_in"
    checked_out = "checked_out"
    cancelled = "cancelled"
    no_show = "no_show"


class Reservation(SQLModel, table=True):
    """
    Reserva de una unidad de alojamiento.

    El precio almacenado es un snapshot del momento de creación —
    no se ve afectado por cambios posteriores en la configuración de precios.
    Los estados cancelled y no_show no bloquean disponibilidad.
    """

    __tablename__ = "reservations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Multi-tenancy — siempre del JWT, nunca del body
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)

    # Alojamiento reservado
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )
    unit_id: UUID = Field(
        foreign_key="accommodation_units.id", index=True, nullable=False
    )

    # Datos del huésped
    guest_name: str = Field(max_length=200)
    guest_email: str = Field(max_length=254)
    guest_phone: str | None = Field(default=None, max_length=30)

    # Identificación
    guest_id_type: str | None = Field(default=None, max_length=20)   # dni|nie|passport|other
    guest_id_number: str | None = Field(default=None, max_length=30)

    # Dirección
    guest_address: str | None = Field(default=None, max_length=255)
    guest_postal_code: str | None = Field(default=None, max_length=10)
    guest_city: str | None = Field(default=None, max_length=100)
    guest_region: str | None = Field(default=None, max_length=100)
    guest_country: str | None = Field(default="España", max_length=100)

    # Fechas de la estancia
    check_in: date = Field(nullable=False, index=True)
    check_out: date = Field(nullable=False, index=True)  # Exclusivo
    num_persons: int = Field(ge=1)

    # Snapshot de precio al momento de crear la reserva
    nights: int
    base_price: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    extras_price: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    total_price: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    currency: str = Field(default="EUR", max_length=3)

    # Extras seleccionados — lista de UUIDs como JSON
    selected_extra_ids: list = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )

    # Estado de la reserva
    status: ReservationStatus = Field(
        default=ReservationStatus.confirmed,
        sa_column=Column(
            SAEnum(ReservationStatus, name="reservationstatus"), nullable=False
        ),
    )

    # Notas internas — solo visibles por el equipo del tenant
    internal_notes: str | None = Field(default=None)

    # ─── Tokens públicos para cancelación y confirmación ─────────────────────
    cancel_token: UUID = Field(default_factory=uuid_lib.uuid4)
    confirm_token: UUID = Field(default_factory=uuid_lib.uuid4)
    reminder_sent: bool = Field(default=False)
    stripe_session_id: str | None = Field(default=None, max_length=255)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
