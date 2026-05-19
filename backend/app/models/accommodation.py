"""
Modelos de inventario de alojamientos.

Cubre AccommodationType (tipos), AccommodationUnit (unidades),
FieldDefinition (campos personalizados por tipo) y Extra (servicios adicionales).
"""

from datetime import UTC, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class AccommodationCategory(str, Enum):
    """Categoría funcional del tipo de alojamiento."""

    parcela = "parcela"
    apartamento = "apartamento"
    albergue = "albergue"


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
    type_category: AccommodationCategory = Field(
        sa_column=Column(
            SAEnum(AccommodationCategory, name="accommodationcategory"),
            nullable=False,
        )
    )
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Extra(SQLModel, table=True):
    """
    Servicio adicional configurable por tenant.

    Se seleccionan al hacer una reserva. Typical: Electricidad, Agua, Wifi.
    El precio se definirá en Sprint 3.
    """

    __tablename__ = "extras"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
