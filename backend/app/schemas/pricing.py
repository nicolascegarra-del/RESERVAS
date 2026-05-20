"""
Schemas Pydantic para el módulo de precios y temporadas.

Cubre PricingModel, Season, ExtraPrice y la calculadora de precios.
Los campos Decimal se serializan como str para compatibilidad JSON estricta.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ─── PricingModel ─────────────────────────────────────────────────────────────


class PricingModelCreate(BaseModel):
    """Datos para crear o actualizar el pricing model de un AccommodationType."""

    unit_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    plot_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    person_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    currency: str = Field(default="EUR", min_length=3, max_length=3)


class PricingModelUpdate(BaseModel):
    """Actualización parcial del pricing model."""

    unit_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    plot_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    person_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class PricingModelRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    unit_price_per_night: Decimal | None
    plot_price_per_night: Decimal | None
    person_price_per_night: Decimal | None
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Season ───────────────────────────────────────────────────────────────────


class SeasonCreate(BaseModel):
    """Datos para crear una temporada de un AccommodationType."""

    name: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    priority: int = Field(default=0, ge=0)
    unit_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    plot_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    person_price_per_night: Decimal | None = Field(
        default=None, ge=0, decimal_places=2
    )
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "SeasonCreate":
        """Garantiza que end_date sea posterior a start_date."""
        if self.end_date <= self.start_date:
            raise ValueError("end_date debe ser posterior a start_date.")
        return self


class SeasonUpdate(BaseModel):
    """Actualización parcial de una temporada."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    priority: int | None = Field(default=None, ge=0)
    unit_price_per_night: Decimal | None = None
    plot_price_per_night: Decimal | None = None
    person_price_per_night: Decimal | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "SeasonUpdate":
        """Valida las fechas solo si se actualizan ambas."""
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date <= self.start_date
        ):
            raise ValueError("end_date debe ser posterior a start_date.")
        return self


class SeasonRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    name: str
    start_date: date
    end_date: date
    priority: int
    unit_price_per_night: Decimal | None
    plot_price_per_night: Decimal | None
    person_price_per_night: Decimal | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── ExtraPrice ───────────────────────────────────────────────────────────────


class ExtraPriceCreate(BaseModel):
    """Datos para crear o actualizar el precio de un extra."""

    price_per_night: Decimal = Field(ge=0, decimal_places=2)


class ExtraPriceUpdate(BaseModel):
    """Actualización parcial del precio de un extra."""

    price_per_night: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class ExtraPriceRead(BaseModel):
    id: UUID
    tenant_id: UUID
    pricing_model_id: UUID
    extra_id: UUID
    price_per_night: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Schemas compuestos ───────────────────────────────────────────────────────


class PricingModelWithExtras(PricingModelRead):
    """PricingModel completo con extras y temporadas incluidas."""

    extra_prices: list[ExtraPriceRead] = Field(default_factory=list)
    seasons: list[SeasonRead] = Field(default_factory=list)


# ─── Calculadora de precios ───────────────────────────────────────────────────


class PriceCalculationRequest(BaseModel):
    """Input de la calculadora de precio de una reserva."""

    accommodation_type_id: UUID
    unit_id: UUID | None = None  # Reservado para Sprint 4
    check_in: date
    check_out: date  # Exclusivo: no se cobra la noche de check-out
    num_persons: int = Field(default=1, ge=1)
    extra_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self) -> "PriceCalculationRequest":
        """
        Garantiza que check_out > check_in y que la diferencia sea >= 1 noche.
        check_out es exclusivo: lunes→miércoles = 2 noches (lun, mar).
        """
        if self.check_out <= self.check_in:
            raise ValueError("check_out debe ser posterior a check_in.")
        nights = (self.check_out - self.check_in).days
        if nights < 1:
            raise ValueError("La estancia debe ser de al menos 1 noche.")
        return self


class PriceBreakdownItem(BaseModel):
    """Detalle de precio para un tramo de noches consecutivas con el mismo precio."""

    dates: str  # Ej: "2025-07-01 → 2025-07-14"
    nights: int
    price_per_night: Decimal
    season: str | None = None  # Nombre de la temporada aplicada


class IvaBreakdownItem(BaseModel):
    """Desglose de IVA para un tipo impositivo concreto."""

    rate: Decimal
    base_imponible: Decimal
    iva_amount: Decimal


class PriceCalculationResult(BaseModel):
    """Resultado completo del cálculo de precio de una reserva."""

    nights: int
    base_price: Decimal
    extras_price: Decimal
    total_price: Decimal
    iva_breakdown: list[IvaBreakdownItem]
    total_iva: Decimal
    total_with_iva: Decimal
    currency: str
    breakdown: list[PriceBreakdownItem]
    applied_season: str | None  # Nombre de la temporada si toda la estancia usa una
