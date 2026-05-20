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

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "019_billing_manual_creditnote"
down_revision = "018_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. reservation_id → nullable
    op.alter_column("invoices", "reservation_id", nullable=True, existing_nullable=False)

    # 2. Eliminar UNIQUE constraint sobre reservation_id
    op.drop_constraint("uq_invoice_reservation", "invoices", type_="unique")

    # 3. Índice parcial — sigue garantizando 1 factura por reserva cuando reservation_id IS NOT NULL
    op.execute(
        "CREATE UNIQUE INDEX uix_invoice_reservation_nonnull "
        "ON invoices (reservation_id) "
        "WHERE reservation_id IS NOT NULL AND is_credit_note = FALSE"
    )

    # 4. is_credit_note
    op.add_column(
        "invoices",
        sa.Column("is_credit_note", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 5. credit_note_for_id
    op.add_column(
        "invoices",
        sa.Column(
            "credit_note_for_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_invoice_credit_note_for",
        "invoices",
        "invoices",
        ["credit_note_for_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_invoices_credit_note_for_id", "invoices", ["credit_note_for_id"])


def downgrade() -> None:
    op.drop_index("ix_invoices_credit_note_for_id", table_name="invoices")
    op.drop_constraint("fk_invoice_credit_note_for", "invoices", type_="foreignkey")
    op.drop_column("invoices", "credit_note_for_id")
    op.drop_column("invoices", "is_credit_note")
    op.execute("DROP INDEX IF EXISTS uix_invoice_reservation_nonnull")
    op.create_unique_constraint("uq_invoice_reservation", "invoices", ["reservation_id"])
    op.alter_column("invoices", "reservation_id", nullable=False, existing_nullable=True)
