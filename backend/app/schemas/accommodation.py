"""
Schemas Pydantic para el módulo de alojamientos.

Cubre AccommodationType, AccommodationUnit, FieldDefinition y Extra.
Se usan para validación de requests y serialización de responses.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.accommodation import AccommodationCategory, FieldType


# ─── AccommodationType ──────────────────────────────────────────────────────


class AccommodationTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type_category: AccommodationCategory
    description: str | None = Field(default=None, max_length=1000)


class AccommodationTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class AccommodationTypeRead(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    type_category: AccommodationCategory
    description: str | None
    is_active: bool
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


class ExtraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class ExtraRead(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Schemas compuestos ───────────────────────────────────────────────────────


class AccommodationTypeWithUnits(AccommodationTypeRead):
    """AccommodationType con sus unidades activas incluidas."""

    units: list[AccommodationUnitRead] = Field(default_factory=list)


class AccommodationTypeSummary(AccommodationTypeRead):
    """AccommodationType con conteo de unidades activas para listados."""

    active_unit_count: int = 0
