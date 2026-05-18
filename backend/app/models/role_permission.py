"""
Modelo RolePermission — permisos configurables por rol (global, gestión del superadmin).
"""

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

PERMISSION_DEFAULTS: dict[str, dict[str, bool]] = {
    "company_admin": {
        "manage_accommodations": True,
        "manage_pricing": True,
        "manage_users": True,
        "manage_cancellation_policies": True,
        "manage_settings": True,
        "view_reports": True,
        "process_refunds": True,
        "manage_reservations": True,
        "handle_change_requests": True,
    },
    "reception": {
        "create_reservations": True,
        "view_reservations": True,
        "checkin_checkout": True,
        "cancel_reservations": False,
        "process_refunds": False,
        "view_accommodations": True,
        "handle_change_requests": True,
    },
}

PERMISSION_LABELS: dict[str, str] = {
    "manage_accommodations": "Gestionar alojamientos (tipos, unidades, extras)",
    "manage_pricing": "Configurar precios y temporadas",
    "manage_users": "Gestionar usuarios de la empresa",
    "manage_cancellation_policies": "Gestionar políticas de cancelación",
    "manage_settings": "Configurar ajustes (branding, SMTP, Stripe)",
    "view_reports": "Ver informes y estadísticas",
    "process_refunds": "Procesar devoluciones",
    "manage_reservations": "Gestionar reservas (crear, editar, cancelar)",
    "handle_change_requests": "Gestionar solicitudes de cambio",
    "create_reservations": "Crear nuevas reservas",
    "view_reservations": "Ver listado y detalle de reservas",
    "checkin_checkout": "Realizar check-in y check-out",
    "cancel_reservations": "Cancelar reservas existentes",
    "view_accommodations": "Ver alojamientos (solo consulta)",
}


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role", "permission_key", name="uq_role_permission"),)

    id: int | None = Field(default=None, primary_key=True)
    role: str = Field(max_length=50, index=True)
    permission_key: str = Field(max_length=100)
    is_enabled: bool = Field(default=True)
