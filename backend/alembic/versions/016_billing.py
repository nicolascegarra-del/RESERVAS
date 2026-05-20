"""016_billing — tablas de facturación y columnas Redsys en tenants

Revision ID: 016_billing
Revises: 015_iva_fields
Create Date: 2026-05-20
"""

from alembic import op

revision = "016_billing"
down_revision = "015_iva_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payment_methods ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS payment_methods (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            method_type VARCHAR(50) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            config JSONB,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_payment_methods_tenant_id ON payment_methods(tenant_id)"
    )

    # ── reservation_payments ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS reservation_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
            payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
            payment_method_name VARCHAR(200) NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            gateway_transaction_id VARCHAR(255),
            paid_at TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(reservation_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_reservation_payments_tenant_id ON reservation_payments(tenant_id)"
    )

    # ── invoices ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
            invoice_number VARCHAR(50) NOT NULL,
            invoice_series VARCHAR(20) NOT NULL DEFAULT 'FAC',
            invoice_year INTEGER NOT NULL,
            invoice_sequence INTEGER NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'issued',
            issuer_name VARCHAR(255),
            issuer_cif VARCHAR(30),
            issuer_address TEXT,
            recipient_name VARCHAR(255) NOT NULL,
            recipient_nif VARCHAR(30),
            recipient_address TEXT,
            recipient_email VARCHAR(254),
            lines JSONB NOT NULL DEFAULT '[]',
            base_imponible NUMERIC(10,2) NOT NULL DEFAULT 0,
            total_iva NUMERIC(10,2) NOT NULL DEFAULT 0,
            total_with_iva NUMERIC(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
            payment_method_name VARCHAR(200),
            pdf_url VARCHAR(500),
            issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(tenant_id, invoice_number),
            UNIQUE(reservation_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_invoices_tenant_id ON invoices(tenant_id)"
    )

    # ── invoice_sequences ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS invoice_sequences (
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            last_sequence INTEGER NOT NULL DEFAULT 0,
            invoice_series VARCHAR(20) NOT NULL DEFAULT 'FAC',
            PRIMARY KEY (tenant_id, year)
        )
    """)

    # ── Columnas Redsys en tenants ────────────────────────────────────────────
    for col_def in [
        "ADD COLUMN IF NOT EXISTS redsys_merchant_code VARCHAR(15)",
        "ADD COLUMN IF NOT EXISTS redsys_terminal VARCHAR(3)",
        "ADD COLUMN IF NOT EXISTS redsys_secret_key VARCHAR(500)",
        "ADD COLUMN IF NOT EXISTS redsys_currency VARCHAR(3) NOT NULL DEFAULT '978'",
        "ADD COLUMN IF NOT EXISTS redsys_environment VARCHAR(20) NOT NULL DEFAULT 'sandbox'",
        "ADD COLUMN IF NOT EXISTS redsys_enabled BOOLEAN NOT NULL DEFAULT FALSE",
    ]:
        op.execute(f"ALTER TABLE tenants {col_def}")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS invoice_sequences")
    op.execute("DROP TABLE IF EXISTS invoices")
    op.execute("DROP TABLE IF EXISTS reservation_payments")
    op.execute("DROP TABLE IF EXISTS payment_methods")
    for col_name in [
        "redsys_merchant_code",
        "redsys_terminal",
        "redsys_secret_key",
        "redsys_currency",
        "redsys_environment",
        "redsys_enabled",
    ]:
        op.execute(f"ALTER TABLE tenants DROP COLUMN IF EXISTS {col_name}")
