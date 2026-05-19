"""009_notification_days_before

Revision ID: 009_notification_days_before
Revises: 008_access_log
Create Date: 2026-05-19
"""

from alembic import op

revision = "009_notification_days_before"
down_revision = "008_access_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE mail_notification_configs ADD COLUMN IF NOT EXISTS days_before INTEGER"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE mail_notification_configs DROP COLUMN IF EXISTS days_before"
    )
