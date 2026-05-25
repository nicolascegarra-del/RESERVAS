"""026_payment_gateways — tabla de pasarelas de pago por empresa.

Revision ID: 026_payment_gateways
Revises: 025_mail_log_body_html
Create Date: 2026-05-25
"""

from alembic import op

revision = "026_payment_gateways"
down_revision = "025_mail_log_body_html"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            type            VARCHAR(20) NOT NULL,
            name            VARCHAR(255) NOT NULL,
            is_active       BOOLEAN NOT NULL DEFAULT FALSE,
            stripe_secret_key       VARCHAR(500),
            stripe_webhook_secret   VARCHAR(500),
            stripe_currency         VARCHAR(3) NOT NULL DEFAULT 'eur',
            redsys_merchant_code    VARCHAR(15),
            redsys_terminal         VARCHAR(3),
            redsys_secret_key       VARCHAR(500),
            redsys_currency         VARCHAR(3) NOT NULL DEFAULT '978',
            redsys_environment      VARCHAR(20) NOT NULL DEFAULT 'sandbox',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'tenant_payment_gateways'
                  AND indexname = 'ix_tenant_payment_gateways_tenant_id'
            ) THEN
                CREATE INDEX ix_tenant_payment_gateways_tenant_id
                    ON tenant_payment_gateways(tenant_id);
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tenant_payment_gateways;")
