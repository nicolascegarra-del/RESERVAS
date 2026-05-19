"""reservation vehicles and access codes

Revision ID: 011_vehicles_codes
Revises: 010_guest_docs
Create Date: 2026-05-19
"""

from alembic import op

revision = "011_vehicles_codes"
down_revision = "010_guest_docs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS reservation_vehicles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            reservation_id UUID NOT NULL REFERENCES reservations(id),
            plate VARCHAR(20) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_vehicles_tenant ON reservation_vehicles (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_vehicles_reservation ON reservation_vehicles (reservation_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS reservation_access_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            reservation_id UUID NOT NULL REFERENCES reservations(id),
            code VARCHAR(10) NOT NULL,
            person_index INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_access_codes_tenant ON reservation_access_codes (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reservation_access_codes_reservation ON reservation_access_codes (reservation_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_reservation_access_codes_person ON reservation_access_codes (reservation_id, person_index)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_reservation_access_codes_person")
    op.execute("DROP INDEX IF EXISTS ix_reservation_access_codes_reservation")
    op.execute("DROP INDEX IF EXISTS ix_reservation_access_codes_tenant")
    op.execute("DROP TABLE IF EXISTS reservation_access_codes")
    op.execute("DROP INDEX IF EXISTS ix_reservation_vehicles_reservation")
    op.execute("DROP INDEX IF EXISTS ix_reservation_vehicles_tenant")
    op.execute("DROP TABLE IF EXISTS reservation_vehicles")
