"""015_iva_fields

Añade tipo de IVA (iva_rate) a accommodation_types y extras,
e iva_amount / total_with_iva a reservations para el desglose fiscal.

Revision ID: 015_iva_fields
Revises: 014_smtp_verified_at
Create Date: 2026-05-20
"""

from alembic import op

revision = "015_iva_fields"
down_revision = "014_smtp_verified_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE accommodation_types "
        "ADD COLUMN IF NOT EXISTS iva_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00"
    )
    op.execute(
        "ALTER TABLE extras "
        "ADD COLUMN IF NOT EXISTS iva_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00"
    )
    op.execute(
        "ALTER TABLE reservations "
        "ADD COLUMN IF NOT EXISTS iva_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00"
    )
    op.execute(
        "ALTER TABLE reservations "
        "ADD COLUMN IF NOT EXISTS total_with_iva NUMERIC(10,2) NOT NULL DEFAULT 0.00"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE accommodation_types DROP COLUMN IF EXISTS iva_rate")
    op.execute("ALTER TABLE extras DROP COLUMN IF EXISTS iva_rate")
    op.execute("ALTER TABLE reservations DROP COLUMN IF EXISTS iva_amount")
    op.execute("ALTER TABLE reservations DROP COLUMN IF EXISTS total_with_iva")
