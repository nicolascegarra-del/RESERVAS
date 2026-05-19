"""
Modelo de huésped/viajero asociado a una reserva.

Cada reserva tiene tantos ReservationGuest como viajeros (num_persons).
Los perfiles NO son permanentes entre reservas: si el mismo viajero
vuelve, se crea un nuevo registro vinculado a la nueva reserva.

El estado del OCR (ocr_status) controla el flujo de captación:
  pending     → aún no se ha subido ningún documento
  processing  → OCR en curso (tarea Celery)
  completed   → OCR leído correctamente, datos pre-rellenados
  failed      → OCR no pudo leer la MRZ → corrección manual
  manual      → datos introducidos/confirmados manualmente
"""

from datetime import UTC, date, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class OCRStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    manual = "manual"


class DocType(str, Enum):
    dni = "dni"
    passport = "passport"
    nie = "nie"


class UploadedBy(str, Enum):
    guest_self = "guest_self"
    reception = "reception"


class ReservationGuest(SQLModel, table=True):
    __tablename__ = "reservation_guests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    reservation_id: UUID = Field(
        foreign_key="reservations.id", index=True, nullable=False
    )
    # Multi-tenancy — siempre derivado de la reserva, nunca del body
    tenant_id: UUID = Field(index=True, nullable=False)
    is_main: bool = Field(default=False)

    # Datos personales — todos opcionales hasta completar la captación
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    full_name: str | None = Field(default=None, max_length=200)
    doc_type: str | None = Field(default=None, max_length=20)
    doc_number: str | None = Field(default=None, max_length=30)
    nationality: str | None = Field(default=None, max_length=3)  # ISO 3166-1 alpha-3
    date_of_birth: date | None = Field(default=None)
    sex: str | None = Field(default=None, max_length=1)  # 'M' | 'F'
    doc_expiry_date: date | None = Field(default=None)
    address: str | None = Field(default=None, max_length=300)

    # Documentos almacenados en /app/media/guest_docs (servidos en /media)
    id_front_url: str | None = Field(default=None, max_length=500)
    id_back_url: str | None = Field(default=None, max_length=500)

    # Estado del OCR
    ocr_status: str = Field(default=OCRStatus.pending.value, max_length=20)
    mrz_raw: str | None = Field(default=None)

    uploaded_by: str | None = Field(default=None, max_length=20)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
