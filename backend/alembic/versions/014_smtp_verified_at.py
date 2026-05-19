"""014_smtp_verified_at

Añade smtp_verified_at a tenants y system_settings para registrar
la última vez que la conexión SMTP fue probada y verificada.

Revision ID: 014_smtp_verified_at
Revises: 013_timestamps_tz
Create Date: 2026-05-19
"""

from alembic import op

revision = "014_smtp_verified_at"
down_revision = "013_timestamps_tz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS smtp_verified_at TIMESTAMPTZ")
    op.execute("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS smtp_verified_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS smtp_verified_at")
    op.execute("ALTER TABLE system_settings DROP COLUMN IF EXISTS smtp_verified_at")
