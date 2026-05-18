"""add tenant user limits

Revision ID: 002_tenant_user_limits
Revises: 001_fiscal_roles
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "002_tenant_user_limits"
down_revision = "001_fiscal_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("max_company_admins", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "tenants",
        sa.Column("max_reception_users", sa.Integer(), nullable=False, server_default="20"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "max_reception_users")
    op.drop_column("tenants", "max_company_admins")
