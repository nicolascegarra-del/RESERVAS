"""013_timestamps_to_timestamptz

Convierte todas las columnas TIMESTAMP WITHOUT TIME ZONE a TIMESTAMPTZ
para que sean compatibles con los datetime timezone-aware que genera Python.

Revision ID: 013_timestamps_tz
Revises: 012_tenant_branding_ses
Create Date: 2026-05-19
"""

from alembic import op

revision = "013_timestamps_tz"
down_revision = "012_tenant_branding_ses"
branch_labels = None
depends_on = None

# Mapa tabla → columnas a convertir
_COLUMNS: list[tuple[str, str]] = [
    ("tenants", "created_at"),
    ("users", "created_at"),
    ("accommodation_types", "created_at"),
    ("accommodation_units", "created_at"),
    ("field_definitions", "created_at"),
    ("extras", "created_at"),
    ("cancellation_policies", "created_at"),
    ("cancellation_policies", "updated_at"),
    ("refund_orders", "created_at"),
    ("refund_orders", "updated_at"),
    ("reservation_change_requests", "created_at"),
    ("guest_upload_tokens", "created_at"),
    ("mail_logs", "sent_at"),
    ("mail_notification_configs", "updated_at"),
    ("pricing_models", "created_at"),
    ("pricing_models", "updated_at"),
    ("seasons", "created_at"),
    ("extra_prices", "created_at"),
    ("reservations", "created_at"),
    ("reservations", "updated_at"),
    ("reservation_guests", "created_at"),
    ("reservation_guests", "updated_at"),
    ("reservation_history", "created_at"),
    ("access_logs", "accessed_at"),
]


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {column} TYPE TIMESTAMPTZ "
            f"USING {column} AT TIME ZONE 'UTC'"
        )


def downgrade() -> None:
    for table, column in _COLUMNS:
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {column} TYPE TIMESTAMP WITHOUT TIME ZONE "
            f"USING {column} AT TIME ZONE 'UTC'"
        )
