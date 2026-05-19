"""
Schemas Pydantic para la captación de documentos de viajeros.

Cubre la representación de un huésped, su creación/actualización (tanto
desde el dashboard como desde la página pública del huésped) y el cálculo
del estado agregado de documentación de una reserva.
"""

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class DocStatus(str, Enum):
    """Estado agregado de la documentación de un huésped o de la reserva."""

    none = "none"  # sin ningún documento ni dato
    partial = "partial"  # faltan campos o falta un lado del documento
    complete = "complete"  # datos obligatorios + documento(s) presentes


# ─── Huésped ─────────────────────────────────────────────────────────────────


class GuestRead(BaseModel):
    """Representación completa de un viajero para respuestas de API."""

    id: UUID
    reservation_id: UUID
    tenant_id: UUID
    is_main: bool
    first_name: str | None
    last_name: str | None
    full_name: str | None
    doc_type: str | None
    doc_number: str | None
    nationality: str | None
    date_of_birth: date | None
    sex: str | None
    doc_expiry_date: date | None
    address: str | None
    id_front_url: str | None
    id_back_url: str | None
    ocr_status: str
    uploaded_by: str | None
    doc_status: DocStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GuestCreate(BaseModel):
    """Datos para crear un viajero manualmente. Todos opcionales salvo nada."""

    is_main: bool = False
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    full_name: str | None = Field(default=None, max_length=200)
    doc_type: str | None = Field(default=None, max_length=20)
    doc_number: str | None = Field(default=None, max_length=30)
    nationality: str | None = Field(default=None, max_length=3)
    date_of_birth: date | None = None
    sex: str | None = Field(default=None, max_length=1)
    doc_expiry_date: date | None = None
    address: str | None = Field(default=None, max_length=300)


class GuestUpdate(BaseModel):
    """Campos editables de un viajero (corrección de datos OCR o manual)."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    full_name: str | None = Field(default=None, max_length=200)
    doc_type: str | None = Field(default=None, max_length=20)
    doc_number: str | None = Field(default=None, max_length=30)
    nationality: str | None = Field(default=None, max_length=3)
    date_of_birth: date | None = None
    sex: str | None = Field(default=None, max_length=1)
    doc_expiry_date: date | None = None
    address: str | None = Field(default=None, max_length=300)
    # Marca explícita: el huésped confirma los datos como definitivos
    mark_manual: bool = False


# ─── Info pública de la reserva (página /g/[token]) ──────────────────────────


class PublicGuestUploadInfo(BaseModel):
    """Datos mínimos de la reserva para la página pública de carga."""

    reservation_id: UUID
    guest_name: str  # nombre de quien hizo la reserva
    accommodation_name: str
    check_in: date
    check_out: date
    num_persons: int
    brand_name: str
    primary_color: str | None
    accent_color: str | None
    logo_url: str | None
    registered_guests: int
    completed_guests: int


# ─── Acción sobre el enlace ──────────────────────────────────────────────────


class SendDocsLinkResponse(BaseModel):
    """Resultado de enviar/reenviar el enlace de documentos."""

    token: str
    upload_url: str
    email_status: str  # 'sent' | 'failed' | 'no_smtp'


class ReservationDocsStatus(BaseModel):
    """Estado agregado de documentación de una reserva (para tabla/banner)."""

    reservation_id: UUID
    num_persons: int
    registered_guests: int
    completed_guests: int
    status: DocStatus
