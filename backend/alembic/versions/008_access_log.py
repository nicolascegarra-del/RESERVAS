"""008_access_log

Revision ID: 008_access_log
Revises: 007_mail_notification_config
Create Date: 2026-05-19
"""

from alembic import op

revision = "008_access_log"
down_revision = "007_mail_notification_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS access_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            user_email VARCHAR(255) NOT NULL,
            user_role VARCHAR(50),
            tenant_id UUID,
            ip_address VARCHAR(45),
            event_type VARCHAR(50) NOT NULL,
            detail VARCHAR(255),
            accessed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_logs_tenant_id ON access_logs(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_logs_accessed_at ON access_logs(accessed_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_logs_user_email ON access_logs(user_email)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS access_logs")
