"""add tenant fiscal data and role permissions table

Revision ID: 001_fiscal_roles
Revises:
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "001_fiscal_roles"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("legal_name", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("cif", sa.String(20), nullable=True))
    op.add_column("tenants", sa.Column("address", sa.String(500), nullable=True))
    op.add_column("tenants", sa.Column("postal_code", sa.String(10), nullable=True))
    op.add_column("tenants", sa.Column("municipality", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("province", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("contact_email", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("contact_phone", sa.String(50), nullable=True))
    op.add_column("tenants", sa.Column("bank_account", sa.String(50), nullable=True))

    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("permission_key", sa.String(100), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role", "permission_key", name="uq_role_permission"),
    )
    op.create_index("ix_role_permissions_role", "role_permissions", ["role"])


def downgrade() -> None:
    op.drop_index("ix_role_permissions_role", table_name="role_permissions")
    op.drop_table("role_permissions")
    for col in ("bank_account", "contact_phone", "contact_email", "province", "municipality", "postal_code", "address", "cif", "legal_name"):
        op.drop_column("tenants", col)
