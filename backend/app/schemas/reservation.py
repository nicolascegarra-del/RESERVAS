"""
Schemas Pydantic para el módulo de reservas.

Cubre creación, lectura, actualización de datos de huésped,
cambio de estado y consulta de disponibilidad.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.reservation import ReservationStatus
from app.schemas.pricing import PriceCalculationResult


# ─── Disponibilidad ───────────────────────────────────────────────────────────


class AvailabilityRequest(BaseModel):
    """Parámetros para consultar disponibilidad de un tipo de alojamiento."""

    accommodation_type_id: UUID
    check_in: date
    check_out: date
    num_persons: int = Field(default=1, ge=1)
    selected_extra_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self) -> "AvailabilityRequest":
        """Garantiza que check_out > check_in."""
        if self.check_out <= self.check_in:
            raise ValueError("check_out debe ser posterior a check_in.")
        if (self.check_out - self.check_in).days < 1:
            raise ValueError("La estancia debe ser de al menos 1 noche.")
        return self


class UnitAvailability(BaseModel):
    """Disponibilidad de una unidad concreta para el rango solicitado."""

    unit_id: UUID
    unit_name: str
    capacity: int
    is_available: bool


class AvailabilityResult(BaseModel):
    """Resultado de la consulta de disponibilidad con preview de precio."""

    available_units: list[UnitAvailability]
    price_preview: PriceCalculationResult | None  # None si no hay pricing model


# ─── Reserva ─────────────────────────────────────────────────────────────────


class ReservationCreate(BaseModel):
    """Datos para crear una nueva reserva."""

    accommodation_type_id: UUID
    unit_id: UUID
    guest_name: str = Field(min_length=2, max_length=200)
    guest_email: EmailStr
    guest_phone: str | None = Field(default=None, max_length=30)
    guest_id_type: str | None = Field(default=None, max_length=20)
    guest_id_number: str | None = Field(default=None, max_length=30)
    guest_address: str | None = Field(default=None, max_length=255)
    guest_postal_code: str | None = Field(default=None, max_length=10)
    guest_city: str | None = Field(default=None, max_length=100)
    guest_region: str | None = Field(default=None, max_length=100)
    guest_country: str | None = Field(default=None, max_length=100)
    check_in: date
    check_out: date
    num_persons: int = Field(ge=1, default=1)
    selected_extra_ids: list[UUID] = Field(default_factory=list)
    internal_notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ReservationCreate":
        """Garantiza que check_out > check_in."""
        if self.check_out <= self.check_in:
            raise ValueError("check_out debe ser posterior a check_in.")
        if (self.check_out - self.check_in).days < 1:
            raise ValueError("La estancia debe ser de al menos 1 noche.")
        return self


class ReservationRead(BaseModel):
    """Representación completa de una reserva para respuestas de API."""

    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    unit_id: UUID
    guest_name: str
    guest_email: str
    guest_phone: str | None
    guest_id_type: str | None
    guest_id_number: str | None
    guest_address: str | None
    guest_postal_code: str | None
    guest_city: str | None
    guest_region: str | None
    guest_country: str | None
    check_in: date
    check_out: date
    num_persons: int
    nights: int
    base_price: Decimal
    extras_price: Decimal
    total_price: Decimal
    currency: str
    selected_extra_ids: list[str]
    status: ReservationStatus
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReservationUpdate(BaseModel):
    """
    Campos editables de una reserva confirmada.

    Excluye deliberadamente: fechas, unidad, precios y estado.
    Esos campos se modifican por endpoints especializados.
    """

    guest_name: str | None = Field(default=None, min_length=2, max_length=200)
    guest_email: EmailStr | None = None
    guest_phone: str | None = Field(default=None, max_length=30)
    guest_id_type: str | None = Field(default=None, max_length=20)
    guest_id_number: str | None = Field(default=None, max_length=30)
    guest_address: str | None = Field(default=None, max_length=255)
    guest_postal_code: str | None = Field(default=None, max_length=10)
    guest_city: str | None = Field(default=None, max_length=100)
    guest_region: str | None = Field(default=None, max_length=100)
    guest_country: str | None = Field(default=None, max_length=100)
    internal_notes: str | None = None


class ReservationStatusUpdate(BaseModel):
    """Cambio de estado de una reserva con nota opcional."""

    status: ReservationStatus
    internal_notes: str | None = None


# ─── Historial de auditoría ───────────────────────────────────────────────────


class ReservationHistoryEntry(BaseModel):
    """Entrada del historial de cambios de una reserva."""

    id: UUID
    user_name: str
    user_role: str
    action: str
    description: str
    changes: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Paginación ───────────────────────────────────────────────────────────────


class PaginatedReservations(BaseModel):
    """Respuesta paginada de listado de reservas."""

    items: list[ReservationRead]
    total: int
    page: int
    pages: int
