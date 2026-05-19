"""Historial de cambios de reservas — auditoría por usuario."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ReservationHistory(SQLModel, table=True):
    __tablename__ = "reservation_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)

    user_id: UUID | None = Field(default=None)
    user_name: str = Field(max_length=255)
    user_role: str = Field(max_length=50)

    action: str = Field(max_length=50)
    description: str = Field(max_length=500)
    changes: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
