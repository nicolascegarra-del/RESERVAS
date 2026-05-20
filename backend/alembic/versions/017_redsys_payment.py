"""017_redsys_payment — columna redsys_order en reservation_payments

Revision ID: 017_redsys_payment
Revises: 016_billing
Create Date: 2026-05-20
"""

from alembic import op

revision = "017_redsys_payment"
down_revision = "016_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Añadir columna redsys_order para correlacionar la notificación IPN
    # con el pago sin necesidad de buscar por reservation_id (que no llega en el IPN).
    op.execute("""
        ALTER TABLE reservation_payments
        ADD COLUMN IF NOT EXISTS redsys_order VARCHAR(12)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_reservation_payments_redsys_order
        ON reservation_payments(redsys_order)
        WHERE redsys_order IS NOT NULL
    """)


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS ix_reservation_payments_redsys_order"
    )
    op.execute(
        "ALTER TABLE reservation_payments DROP COLUMN IF EXISTS redsys_order"
    )
