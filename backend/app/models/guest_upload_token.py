"""
Token público de carga de documentos de viajeros.

Se genera al confirmar la reserva (o on-demand al reenviar el enlace).
El huésped accede a /g/{token} sin autenticación. El token permanece
activo hasta el momento del check-in; la recepción puede desactivarlo.

El valor del token se genera con secrets.token_urlsafe(32) → ~43 chars.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class GuestUploadToken(SQLModel, table=True):
    __tablename__ = "guest_upload_tokens"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    reservation_id: UUID = Field(
        foreign_key="reservations.id", index=True, nullable=False
    )
    tenant_id: UUID = Field(nullable=False)
    token: str = Field(max_length=64, unique=True, index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
