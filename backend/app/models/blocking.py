"""Modelo de bloqueos de unidades de alojamiento."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Blocking(SQLModel, table=True):
    """
    Bloqueo de una unidad de alojamiento para un rango de fechas.

    Impide crear reservas sobre la unidad en las fechas bloqueadas.
    start_date y end_date son ambos inclusivos.
    """

    __tablename__ = "blockings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_unit_id: UUID = Field(
        foreign_key="accommodation_units.id", index=True, nullable=False
    )
    start_date: date = Field(nullable=False)
    end_date: date = Field(nullable=False)
    reason: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
