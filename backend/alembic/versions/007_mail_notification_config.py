"""007_mail_notification_config

Revision ID: 007_mail_notification_config
Revises: 006_rename_categories
Create Date: 2026-05-19
"""

from alembic import op

revision = "007_mail_notification_config"
down_revision = "006_rename_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS mail_notification_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            notification_type VARCHAR(50) NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            subject VARCHAR(500) NOT NULL DEFAULT '',
            body_text TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE (tenant_id, notification_type)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_mail_notification_configs_tenant_id ON mail_notification_configs(tenant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS mail_notification_configs")
