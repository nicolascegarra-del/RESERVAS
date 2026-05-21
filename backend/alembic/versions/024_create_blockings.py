"""024_create_blockings — tabla de bloqueos de unidades de alojamiento.

Revision ID: 024_create_blockings
Revises: 023_remove_priority_fields
Create Date: 2026-05-21
"""

from alembic import op

revision = "024_create_blockings"
down_revision = "023_remove_priority_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'blockings'
            ) THEN
                CREATE TABLE blockings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL REFERENCES tenants(id),
                    accommodation_unit_id UUID NOT NULL REFERENCES accommodation_units(id),
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    reason VARCHAR(500),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX idx_blockings_tenant ON blockings(tenant_id);
                CREATE INDEX idx_blockings_unit ON blockings(accommodation_unit_id);
                CREATE INDEX idx_blockings_dates ON blockings(start_date, end_date);
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
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'blockings'
            ) THEN
                DROP TABLE blockings;
            END IF;
        END$$;
        """
    )
