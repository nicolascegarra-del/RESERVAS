"""019_billing_manual_creditnote — facturas manuales y rectificativas

- reservation_id nullable en invoices (para facturas sin reserva)
- Elimina UNIQUE constraint sobre reservation_id (era solo 1 factura por reserva;
  ahora se usa índice parcial WHERE reservation_id IS NOT NULL)
- Añade is_credit_note (BOOLEAN DEFAULT FALSE NOT NULL)
- Añade credit_note_for_id (UUID nullable, FK → invoices.id)

Revision ID: 019_billing_manual_creditnote
Revises: 018_user_preferences
Create Date: 2026-05-20
"""

from alembic import op

revision = "019_billing_manual_creditnote"
down_revision = "018_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. reservation_id → nullable
    # DROP NOT NULL es no-op en PostgreSQL si la columna ya es nullable (idempotente)
    op.execute(
        "ALTER TABLE invoices ALTER COLUMN reservation_id DROP NOT NULL"
    )

    # 2. Eliminar UNIQUE constraint sobre reservation_id (puede no existir si
    # create_all() creó la tabla con el modelo actual que ya no tiene esa constraint)
    op.execute(
        "ALTER TABLE invoices DROP CONSTRAINT IF EXISTS uq_invoice_reservation"
    )

    # 3. Índice parcial — garantiza 1 factura por reserva cuando hay reservation_id
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uix_invoice_reservation_nonnull
        ON invoices (reservation_id)
        WHERE reservation_id IS NOT NULL AND is_credit_note = FALSE
    """)

    # 4. is_credit_note
    op.execute(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_credit_note BOOLEAN NOT NULL DEFAULT false"
    )

    # 5. credit_note_for_id
    op.execute(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_note_for_id UUID"
    )

    # 6. FK condicional para idempotencia
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_invoice_credit_note_for'
                  AND table_name = 'invoices'
            ) THEN
                ALTER TABLE invoices
                    ADD CONSTRAINT fk_invoice_credit_note_for
                    FOREIGN KEY (credit_note_for_id) REFERENCES invoices(id) ON DELETE SET NULL;
            END IF;
        END $$
    """)

    # 7. Índice en credit_note_for_id
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_invoices_credit_note_for_id ON invoices (credit_note_for_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_invoices_credit_note_for_id")
    op.execute("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoice_credit_note_for")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS credit_note_for_id")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS is_credit_note")
    op.execute("DROP INDEX IF EXISTS uix_invoice_reservation_nonnull")
    op.execute("ALTER TABLE invoices ALTER COLUMN reservation_id SET NOT NULL")
