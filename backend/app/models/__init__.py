"""Modelos SQLModel — importar aquí para que Alembic los detecte."""

from app.models.accommodation import (
    AccommodationCategory,
    AccommodationType,
    AccommodationUnit,
    Extra,
    FieldDefinition,
    FieldType,
)
from app.models.cancellation import CancellationPolicy, RefundOrder, RefundOrderStatus
from app.models.pricing import ExtraPrice, PricingModel, Season
from app.models.change_request import ChangeRequestStatus, ChangeRequestType, ReservationChangeRequest
from app.models.reservation import Reservation, ReservationStatus
from app.models.tenant import Tenant
from app.models.user import User, UserRole

__all__ = [
    "Tenant",
    "User",
    "UserRole",
    "AccommodationCategory",
    "AccommodationType",
    "AccommodationUnit",
    "FieldDefinition",
    "FieldType",
    "Extra",
    "PricingModel",
    "Season",
    "ExtraPrice",
    "ReservationChangeRequest",
    "ChangeRequestType",
    "ChangeRequestStatus",
    "Reservation",
    "ReservationStatus",
    "CancellationPolicy",
    "RefundOrder",
    "RefundOrderStatus",
]
