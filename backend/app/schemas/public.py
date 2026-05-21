"""
Schemas Pydantic para endpoints públicos (sin autenticación).

Estos endpoints permiten a los clientes finales consultar disponibilidad
y precios sin necesidad de estar autenticados.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.schemas.pricing import PriceCalculationResult


class PublicAvailabilityRequest(BaseModel):
    """Parámetros para la búsqueda pública de disponibilidad."""

    accommodation_type_id: UUID | None = Field(
        default=None,
        description="Si es null, se buscan todos los tipos del tenant.",
    )
    check_in: date
    check_out: date
    num_persons: int = Field(default=1, ge=1, le=50)

    @model_validator(mode="after")
    def validate_dates(self) -> "PublicAvailabilityRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out debe ser posterior a check_in.")
        return self


class PublicUnitAvailability(BaseModel):
    """Disponibilidad de una unidad en la búsqueda pública."""

    unit_id: UUID
    unit_name: str
    capacity: int
    is_available: bool


class PublicTypeAvailability(BaseModel):
    """Resultado de disponibilidad para un tipo de alojamiento."""

    type_id: UUID
    type_name: str
    description: str | None

    # Unidades con capacidad >= num_persons (disponibles y no disponibles)
    available_units: list[PublicUnitAvailability]

    # Preview de precio para las fechas/personas solicitadas
    price_preview: PriceCalculationResult | None

    # Precio mínimo por noche (primer tramo del breakdown, o None si sin tarifas)
    min_price_per_night: Decimal | None

    # Rango de capacidad de las unidades del tipo (para info al cliente)
    min_capacity: int
    max_capacity: int


class PublicAccommodationType(BaseModel):
    """Tipo de alojamiento para el listado público (sin info de precios)."""

    id: UUID
    name: str
    description: str | None
    active_unit_count: int


# ─── Schemas para reserva pública (sin autenticación) ────────────────────────


class PublicReservationCreate(BaseModel):
    """Datos para crear una reserva desde la landing pública."""

    unit_id: UUID
    accommodation_type_id: UUID
    guest_name: str = Field(max_length=200)
    guest_email: EmailStr = Field(max_length=254)
    guest_phone: str | None = Field(default=None, max_length=50)
    guest_id_type: str | None = Field(default=None, max_length=20)
    guest_id_number: str | None = Field(default=None, max_length=30)
    guest_address: str | None = Field(default=None, max_length=255)
    guest_postal_code: str | None = Field(default=None, max_length=10)
    guest_city: str | None = Field(default=None, max_length=100)
    guest_region: str | None = Field(default=None, max_length=100)
    guest_country: str | None = Field(default=None, max_length=100)
    check_in: date
    check_out: date
    num_persons: int = Field(ge=1, le=50)

    @model_validator(mode="after")
    def validate_dates(self) -> "PublicReservationCreate":
        if self.check_out <= self.check_in:
            raise ValueError("check_out debe ser posterior a check_in.")
        return self


class PublicReservationResponse(BaseModel):
    """Respuesta tras crear una reserva — incluye URL de pago de Stripe."""

    reservation_id: UUID
    stripe_checkout_url: str


class PublicCancelPreview(BaseModel):
    """Preview de cancelación: datos de la reserva + política + reembolso."""

    reservation_id: UUID
    guest_name: str
    guest_email: str
    check_in: date
    check_out: date
    num_persons: int
    total_price: Decimal
    currency: str
    status: str

    # Política de cancelación aplicada (None si no hay política configurada)
    policy_name: str | None
    full_refund_days: int | None
    partial_refund_days: int | None
    partial_refund_percentage: int | None

    # Reembolso estimado según la política
    days_until_checkin: int
    estimated_refund: Decimal
    refund_description: str


class PublicConfirmInfo(BaseModel):
    """Información de la reserva para la página de confirmación de asistencia."""

    reservation_id: UUID
    guest_name: str
    check_in: date
    check_out: date
    num_persons: int
    status: str
    already_confirmed: bool
