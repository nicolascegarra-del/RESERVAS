"""018_user_preferences — tabla de preferencias de usuario (config de widgets)

Revision ID: 018_user_preferences
Revises: 017_redsys_payment
Create Date: 2026-05-20
"""

from alembic import op

revision = "018_user_preferences"
down_revision = "017_redsys_payment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            widget_config JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT uq_user_preference_user_id UNIQUE (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_preferences_user_id ON user_preferences (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_preferences_user_id")
    op.execute("DROP TABLE IF EXISTS user_preferences")
