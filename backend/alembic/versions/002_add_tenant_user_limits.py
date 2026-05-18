"""add tenant user limits

Revision ID: 002_tenant_user_limits
Revises: 001_fiscal_roles
Create Date: 2026-05-18
"""

from alembic import op

revision = "002_tenant_user_limits"
down_revision = "001_fiscal_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_company_admins INTEGER NOT NULL DEFAULT 5")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_reception_users INTEGER NOT NULL DEFAULT 20")


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS max_reception_users")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS max_company_admins")
