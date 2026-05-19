"""012_tenant_branding_and_ses_columns

Añade las columnas de branding y SES al modelo Tenant que no tenían migración.

Revision ID: 012_tenant_branding_ses
Revises: 011_vehicles_codes
Create Date: 2026-05-19
"""

from alembic import op

revision = "012_tenant_branding_ses"
down_revision = "011_vehicles_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for col_def in [
        "brand_name VARCHAR(255)",
        "primary_color VARCHAR(7)",
        "accent_color VARCHAR(7)",
        "tagline VARCHAR(500)",
        "ses_establishment_code VARCHAR(50)",
        "ses_username VARCHAR(255)",
        "ses_password VARCHAR(500)",
        "ses_enabled BOOLEAN NOT NULL DEFAULT false",
    ]:
        op.execute(f"ALTER TABLE tenants ADD COLUMN IF NOT EXISTS {col_def}")


def downgrade() -> None:
    for col in (
        "ses_enabled",
        "ses_password",
        "ses_username",
        "ses_establishment_code",
        "tagline",
        "accent_color",
        "primary_color",
        "brand_name",
    ):
        op.execute(f"ALTER TABLE tenants DROP COLUMN IF EXISTS {col}")
