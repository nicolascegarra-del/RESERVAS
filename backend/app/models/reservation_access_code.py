"""Código alfanumérico de acceso al torno, uno por persona de la reserva."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class ReservationAccessCode(SQLModel, table=True):
    __tablename__ = "reservation_access_codes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True, nullable=False)
    # 6 caracteres alfanuméricos en mayúsculas, ej: A3F8K2
    code: str = Field(max_length=10)
    # Índice de persona (1-based): persona 1, 2, 3…
    person_index: int = Field(default=1, ge=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
