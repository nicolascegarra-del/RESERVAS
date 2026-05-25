"""027_bizum_gateway — añade bizum_enabled a pasarelas y redsys_bizum_enabled a tenants.

Revision ID: 027_bizum_gateway
Revises: 026_payment_gateways
Create Date: 2026-05-25
"""

from alembic import op

revision = "027_bizum_gateway"
down_revision = "026_payment_gateways"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE tenant_payment_gateways
            ADD COLUMN IF NOT EXISTS bizum_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )
    op.execute(
        """
        ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS redsys_bizum_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE tenant_payment_gateways DROP COLUMN IF EXISTS bizum_enabled;"
    )
    op.execute(
        "ALTER TABLE tenants DROP COLUMN IF EXISTS redsys_bizum_enabled;"
    )
