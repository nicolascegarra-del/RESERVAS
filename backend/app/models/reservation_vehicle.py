"""Matrícula de vehículo vinculada a una reserva."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class ReservationVehicle(SQLModel, table=True):
    __tablename__ = "reservation_vehicles"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True, nullable=False)
    plate: str = Field(max_length=20)
    created_at: datetime = Field(default_factory=datetime.utcnow)
