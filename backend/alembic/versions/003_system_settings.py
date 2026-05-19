"""003_system_settings

Revision ID: 003_system_settings
Revises: 002_tenant_user_limits
Create Date: 2026-05-18
"""

from alembic import op

revision = "003_system_settings"
down_revision = "002_tenant_user_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            smtp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            smtp_host VARCHAR(255),
            smtp_port INTEGER NOT NULL DEFAULT 587,
            smtp_user VARCHAR(255),
            smtp_password VARCHAR(500),
            smtp_from VARCHAR(255),
            CONSTRAINT system_settings_singleton CHECK (id = 1)
        )
    """)
    op.execute("INSERT INTO system_settings (id, smtp_enabled, smtp_port) VALUES (1, FALSE, 587) ON CONFLICT DO NOTHING")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS system_settings")
