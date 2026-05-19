"""005_mail_log

Revision ID: 005_mail_log
Revises: 004_reservation_history
Create Date: 2026-05-19
"""

from alembic import op

revision = "005_mail_log"
down_revision = "004_reservation_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS mail_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            reservation_id UUID,
            to_email VARCHAR(255) NOT NULL,
            subject VARCHAR(500) NOT NULL,
            email_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL,
            smtp_source VARCHAR(20) NOT NULL,
            error_message VARCHAR(500),
            sent_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_mail_logs_tenant_id ON mail_logs(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_mail_logs_sent_at ON mail_logs(sent_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS mail_logs")
