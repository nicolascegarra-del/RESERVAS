"""025_mail_log_body_html — add body_html column to mail_logs.

Revision ID: 025_mail_log_body_html
Revises: 024_create_blockings
Create Date: 2026-05-21
"""

from alembic import op

revision = "025_mail_log_body_html"
down_revision = "024_create_blockings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'mail_logs' AND column_name = 'body_html'
            ) THEN
                ALTER TABLE mail_logs ADD COLUMN body_html TEXT;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'mail_logs' AND column_name = 'body_html'
            ) THEN
                ALTER TABLE mail_logs DROP COLUMN body_html;
            END IF;
        END$$;
        """
    )
