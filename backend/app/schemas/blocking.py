"""Schemas Pydantic para el módulo de bloqueos."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class BlockingCreate(BaseModel):
    """Datos para crear uno o varios bloqueos (un bloqueo por unidad seleccionada)."""

    unit_ids: list[UUID] = Field(min_length=1, description="IDs de las unidades a bloquear")
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_dates(self) -> "BlockingCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date debe ser igual o posterior a start_date.")
        return self


class BlockingRead(BaseModel):
    id: UUID
    tenant_id: UUID
    accommodation_unit_id: UUID
    unit_name: str
    type_name: str
    start_date: date
    end_date: date
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BlockingConflictReservation(BaseModel):
    id: UUID
    guest_name: str
    check_in: date
    check_out: date
    status: str


class BlockingConflict(BaseModel):
    unit_id: UUID
    unit_name: str
    reservations: list[BlockingConflictReservation]
