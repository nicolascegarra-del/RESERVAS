"""
Solicitudes de cambio de estado o precio sobre una reserva.

Flujo:
  - Recepcionista crea la solicitud (status=pending) con un comentario.
  - Admin la ve en /solicitudes, la aprueba (aplica el cambio) o la rechaza.
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, Numeric
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, SQLModel


class ChangeRequestType(str, Enum):
    status_change = "status_change"
    price_change = "price_change"


class ChangeRequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReservationChangeRequest(SQLModel, table=True):
    __tablename__ = "reservation_change_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)
    reservation_id: UUID = Field(foreign_key="reservations.id", index=True)

    # Quién lo solicitó
    requested_by: UUID = Field(foreign_key="users.id")
    requested_by_name: str = Field(max_length=255)

    # Tipo y valores solicitados
    type: ChangeRequestType = Field(
        sa_column=Column(SAEnum(ChangeRequestType, name="changerequesttype"), nullable=False)
    )
    requested_status: str | None = Field(default=None, max_length=50)
    requested_price: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(10, 2), nullable=True)
    )
    comment: str = Field(max_length=1000)

    # Estado de la solicitud
    status: ChangeRequestStatus = Field(
        default=ChangeRequestStatus.pending,
        sa_column=Column(
            SAEnum(ChangeRequestStatus, name="changerequeststatus"), nullable=False
        ),
    )

    # Revisión por el admin
    reviewed_by: UUID | None = Field(default=None, foreign_key="users.id")
    reviewed_by_name: str | None = Field(default=None, max_length=255)
    review_comment: str | None = Field(default=None, max_length=1000)
    reviewed_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
