"""004_reservation_history

Revision ID: 004_reservation_history
Revises: 003_system_settings
Create Date: 2026-05-19
"""

from alembic import op

revision = "004_reservation_history"
down_revision = "003_system_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS reservation_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID,
            user_name VARCHAR(255) NOT NULL,
            user_role VARCHAR(50) NOT NULL,
            action VARCHAR(50) NOT NULL,
            description VARCHAR(500) NOT NULL,
            changes JSONB,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_history_reservation_id ON reservation_history(reservation_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_history_tenant_id ON reservation_history(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_history_created_at ON reservation_history(created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS reservation_history")
