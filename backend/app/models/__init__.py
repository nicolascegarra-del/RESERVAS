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
from app.models.reservation_guest import (
    DocType,
    OCRStatus,
    ReservationGuest,
    UploadedBy,
)
from app.models.guest_upload_token import GuestUploadToken
from app.models.access_log import AccessLog
from app.models.mail_log import MailLog
from app.models.mail_notification_config import MailNotificationConfig
from app.models.reservation_history import ReservationHistory
from app.models.role_permission import RolePermission
from app.models.system_settings import SystemSettings
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
    "ReservationGuest",
    "OCRStatus",
    "DocType",
    "UploadedBy",
    "GuestUploadToken",
    "AccessLog",
    "MailLog",
    "MailNotificationConfig",
    "ReservationHistory",
    "CancellationPolicy",
    "RefundOrder",
    "RefundOrderStatus",
    "RolePermission",
    "SystemSettings",
]
