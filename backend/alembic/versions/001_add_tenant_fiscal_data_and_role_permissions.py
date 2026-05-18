"""add tenant fiscal data and role permissions table

Revision ID: 001_fiscal_roles
Revises:
Create Date: 2026-05-18
"""

from alembic import op

revision = "001_fiscal_roles"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS hace la migración idempotente:
    # en BD nueva init_db() ya creó las columnas, aquí las salteamos sin error.
    for col_def in [
        "legal_name VARCHAR(255)",
        "cif VARCHAR(20)",
        "address VARCHAR(500)",
        "postal_code VARCHAR(10)",
        "municipality VARCHAR(255)",
        "province VARCHAR(255)",
        "contact_email VARCHAR(255)",
        "contact_phone VARCHAR(50)",
        "bank_account VARCHAR(50)",
    ]:
        op.execute(f"ALTER TABLE tenants ADD COLUMN IF NOT EXISTS {col_def}")

    op.execute("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY,
            role VARCHAR(50) NOT NULL,
            permission_key VARCHAR(100) NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT true,
            CONSTRAINT uq_role_permission UNIQUE (role, permission_key)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_role_permissions_role ON role_permissions (role)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_role_permissions_role")
    op.execute("DROP TABLE IF EXISTS role_permissions")
    for col in ("bank_account", "contact_phone", "contact_email", "province", "municipality", "postal_code", "address", "cif", "legal_name"):
        op.execute(f"ALTER TABLE tenants DROP COLUMN IF EXISTS {col}")
