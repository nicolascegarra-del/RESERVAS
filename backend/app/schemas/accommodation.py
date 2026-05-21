"""
Schemas Pydantic para el módulo de alojamientos.

Cubre AccommodationType, AccommodationUnit, FieldDefinition y Extra.
Se usan para validación de requests y serialización de responses.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.accommodation import FieldType, MultiplierType


# ─── AccommodationType ──────────────────────────────────────────────────────


class AccommodationTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    iva_rate: Decimal = Field(default=Decimal("10.00"), ge=0, decimal_places=2)


class AccommodationTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None
    iva_rate: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class AccommodationTypeRead(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    is_active: bool
    iva_rate: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── AccommodationUnit ───────────────────────────────────────────────────────


class AccommodationUnitCreate(BaseModel):
    accommodation_type_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    capacity: int = Field(ge=1)
    custom_fields: dict = Field(default_factory=dict)


class AccommodationUnitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    capacity: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    custom_fields: dict | None = None


class AccommodationUnitRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    name: str
    description: str | None
    capacity: int
    is_active: bool
    custom_fields: dict
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── FieldDefinition ─────────────────────────────────────────────────────────


class FieldDefinitionCreate(BaseModel):
    accommodation_type_id: UUID
    field_key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    field_label: str = Field(min_length=1, max_length=200)
    field_type: FieldType
    options: list[str] | None = None
    is_required: bool = False
    sort_order: int = Field(default=0, ge=0)


class FieldDefinitionUpdate(BaseModel):
    field_label: str | None = Field(default=None, min_length=1, max_length=200)
    field_type: FieldType | None = None
    options: list[str] | None = None
    is_required: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class FieldDefinitionRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    field_key: str
    field_label: str
    field_type: FieldType
    options: list[str] | None
    is_required: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Extra ───────────────────────────────────────────────────────────────────


class ExtraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    iva_rate: Decimal = Field(default=Decimal("10.00"), ge=0, decimal_places=2)
    price: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    multiplier_type: MultiplierType = MultiplierType.fixed
    multiplier_label: str | None = Field(default=None, max_length=100)


class ExtraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    iva_rate: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    price: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    multiplier_type: MultiplierType | None = None
    multiplier_label: str | None = Field(default=None, max_length=100)


class ExtraRead(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    is_active: bool
    iva_rate: Decimal
    price: Decimal
    multiplier_type: MultiplierType
    multiplier_label: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── AccommodationPriceRule ────────────────────────────────────────────────────


class AccommodationPriceRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    date_from: str = Field(
        max_length=5,
        pattern=r"^\d{2}-\d{2}$",
        description="Inicio del tramo en formato MM-DD, ej: 07-01",
    )
    date_to: str = Field(
        max_length=5,
        pattern=r"^\d{2}-\d{2}$",
        description="Fin del tramo en formato MM-DD, ej: 08-31",
    )
    price_per_night: Decimal = Field(ge=0, decimal_places=2)
    min_nights: int = Field(default=1, ge=1)
    priority: int = Field(default=0)
    is_active: bool = True


class AccommodationPriceRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    date_from: str | None = Field(default=None, max_length=5, pattern=r"^\d{2}-\d{2}$")
    date_to: str | None = Field(default=None, max_length=5, pattern=r"^\d{2}-\d{2}$")
    price_per_night: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    min_nights: int | None = Field(default=None, ge=1)
    priority: int | None = None
    is_active: bool | None = None


class AccommodationPriceRuleRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    name: str
    date_from: str
    date_to: str
    price_per_night: Decimal
    min_nights: int
    priority: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── AccommodationPhoto ────────────────────────────────────────────────────────


class AccommodationPhotoRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_type_id: UUID
    file_url: str
    caption: str | None
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AccommodationPhotoUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=200)
    sort_order: int | None = None


# ─── Schemas compuestos ───────────────────────────────────────────────────────


class AccommodationTypeWithUnits(AccommodationTypeRead):
    """AccommodationType con sus unidades activas incluidas."""

    units: list[AccommodationUnitRead] = Field(default_factory=list)


class AccommodationTypeSummary(AccommodationTypeRead):
    """AccommodationType con conteo de unidades activas para listados."""

    active_unit_count: int = 0
