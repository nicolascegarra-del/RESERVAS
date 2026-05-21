"""
Modelos de inventario de alojamientos.

Cubre AccommodationType (tipos), AccommodationUnit (unidades),
FieldDefinition (campos personalizados por tipo) y Extra (servicios adicionales).
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, Numeric
from sqlalchemy import Enum as SAEnum
from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class FieldType(str, Enum):
    """Tipo de dato de un campo personalizado."""

    text = "text"
    number = "number"
    boolean = "boolean"
    select = "select"


class AccommodationType(SQLModel, table=True):
    """
    Tipo de alojamiento definido por el tenant.

    Agrupa unidades del mismo tipo (ej: 'Parcelas de camping', 'Apartamentos').
    """

    __tablename__ = "accommodation_types"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool = Field(default=True)
    iva_rate: Decimal = Field(
        default=Decimal("10.00"),
        sa_column=Column(Numeric(5, 2), nullable=False, server_default="10.00"),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AccommodationUnit(SQLModel, table=True):
    """
    Unidad individual de alojamiento.

    Ejemplo: 'Parcela A1', 'Apartamento 201', 'Cabaña del Bosque'.
    El campo custom_fields almacena los valores de los FieldDefinitions del tipo.
    """

    __tablename__ = "accommodation_units"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    capacity: int = Field(ge=1)
    is_active: bool = Field(default=True)
    # JSONB: almacena valores de campos personalizados definidos por el tenant
    custom_fields: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FieldDefinition(SQLModel, table=True):
    """
    Definición de un campo personalizado asociado a un AccommodationType.

    Permite al tenant extender la ficha de cada unidad con campos propios.
    Los valores de estos campos se guardan en AccommodationUnit.metadata.
    """

    __tablename__ = "field_definitions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )
    # Clave interna usada como key en el JSON de metadata (ej: "num_rooms")
    field_key: str = Field(max_length=100)
    # Etiqueta visible en la UI (ej: "Número de habitaciones")
    field_label: str = Field(max_length=200)
    field_type: FieldType = Field(
        sa_column=Column(
            SAEnum(FieldType, name="fieldtype"),
            nullable=False,
        )
    )
    # Solo para field_type="select": lista de opciones disponibles
    options: list | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    is_required: bool = Field(default=False)
    # Orden de presentación en formularios
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MultiplierType(str, Enum):
    """Tipo de multiplicador para calcular el precio de un extra."""

    fixed = "fixed"                               # Precio fijo por reserva
    per_person = "per_person"                     # Precio × personas
    per_person_night = "per_person_night"         # Precio × personas × noches
    per_night = "per_night"                       # Precio × noches


class Extra(SQLModel, table=True):
    """
    Servicio adicional configurable por tenant.

    Se seleccionan al hacer una reserva. Ej: Electricidad, Agua, Wifi.
    El campo multiplier_type determina cómo se calcula el precio total.
    """

    __tablename__ = "extras"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    iva_rate: Decimal = Field(
        default=Decimal("10.00"),
        sa_column=Column(Numeric(5, 2), nullable=False, server_default="10.00"),
    )
    # Precio base del extra (antes de IVA)
    price: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False, server_default="0.00"),
    )
    # Cómo se multiplica el precio
    multiplier_type: MultiplierType = Field(
        default=MultiplierType.fixed,
        sa_column=Column(
            SAEnum(MultiplierType, name="multipliertype"),
            nullable=False,
            server_default="fixed",
        ),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AccommodationPriceRule(SQLModel, table=True):
    """
    Regla de precio por tramo de fechas para un tipo de alojamiento.

    Permite definir tarifas de temporada (alta, media, baja) por tipo.
    Los solapamientos de fechas se previenen en la capa de servicio.
    """

    __tablename__ = "accommodation_price_rules"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )
    name: str = Field(max_length=200)
    date_from: str = Field(max_length=5)   # MM-DD, ej: "07-01"
    date_to: str = Field(max_length=5)     # MM-DD, ej: "08-31"
    price_per_night: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False)
    )
    min_nights: int = Field(default=1, ge=1)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AccommodationPhoto(SQLModel, table=True):
    """
    Foto de un tipo de alojamiento, almacenada en MinIO.
    """

    __tablename__ = "accommodation_photos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )
    file_url: str = Field(max_length=500)
    file_key: str = Field(max_length=500)
    caption: str | None = Field(default=None, max_length=200)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
