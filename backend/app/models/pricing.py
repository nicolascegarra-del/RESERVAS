"""
Modelos de precios y temporadas para AccommodationType.

Cubre PricingModel (precio base del tipo), Season (tramos de temporada)
y ExtraPrice (precio por noche de cada extra dentro de un pricing model).
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Column, Numeric, UniqueConstraint
from sqlmodel import Field, SQLModel


class PricingModel(SQLModel, table=True):
    """
    Configuración de precio base de un AccommodationType.

    Existe exactamente UNO por AccommodationType (constraint unique).
    Los precios relevantes dependen de la categoría del tipo:
    - apartment / cabin: unit_price_per_night
    - camping: plot_price_per_night + person_price_per_night
    """

    __tablename__ = "pricing_models"
    __table_args__ = (
        UniqueConstraint(
            "accommodation_type_id",
            name="uq_pricing_model_accommodation_type",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", nullable=False
    )

    # Apartment / Cabin — precio por unidad por noche
    unit_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )

    # Camping — precio base de la parcela por noche
    plot_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )

    # Camping — precio adicional por persona por noche
    person_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )

    currency: str = Field(default="EUR", max_length=3)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Season(SQLModel, table=True):
    """
    Tramo de temporada con precios propios para un AccommodationType.

    Si varias temporadas activas se solapan en una fecha, prevalece
    la de mayor valor de `priority` (mayor número = mayor prioridad).
    Los precios de la temporada sobrescriben los del PricingModel base.
    """

    __tablename__ = "seasons"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    accommodation_type_id: UUID = Field(
        foreign_key="accommodation_types.id", index=True, nullable=False
    )

    name: str = Field(max_length=200)
    start_date: date = Field(nullable=False)
    end_date: date = Field(nullable=False)
    # Mayor número = mayor prioridad en solapamientos
    priority: int = Field(default=0)

    # Precios de temporada (sobrescriben PricingModel base si no son None)
    unit_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )
    plot_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )
    person_price_per_night: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ExtraPrice(SQLModel, table=True):
    """
    Precio por noche de un Extra dentro de un PricingModel.

    Permite price_per_night = 0 (extra gratuito incluido en la reserva).
    """

    __tablename__ = "extra_prices"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True, nullable=False)
    pricing_model_id: UUID = Field(
        foreign_key="pricing_models.id", index=True, nullable=False
    )
    extra_id: UUID = Field(foreign_key="extras.id", index=True, nullable=False)

    price_per_night: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
