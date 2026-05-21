"""020_accommodation_extras_pricing_photos — extras con precio y multiplicador,
reglas de precio por temporada, fotos de tipo de alojamiento.

Revision ID: 020_accommodation_extras_pricing_photos
Revises: 019_billing_manual_creditnote
Create Date: 2026-05-20
"""

from alembic import op

revision = "020_accommodation_extras_pricing_photos"
down_revision = "019_billing_manual_creditnote"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Nuevas columnas en extras ────────────────────────────────────────────
    # Usamos SQL raw con IF NOT EXISTS / ADD COLUMN IF NOT EXISTS para que la
    # migración sea idempotente aunque create_all() ya haya creado el ENUM o
    # las tablas antes de que Alembic llegue a ejecutar este upgrade.
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'multipliertype') THEN
                CREATE TYPE multipliertype AS ENUM ('fixed', 'per_person', 'per_custom');
            END IF;
        END $$
    """)
    op.execute(
        "ALTER TABLE extras ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00"
    )
    op.execute(
        "ALTER TABLE extras ADD COLUMN IF NOT EXISTS multiplier_type multipliertype NOT NULL DEFAULT 'fixed'"
    )
    op.execute(
        "ALTER TABLE extras ADD COLUMN IF NOT EXISTS multiplier_label VARCHAR(100)"
    )

    # ── 2. Tabla de reglas de precio por temporada ───────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS accommodation_price_rules (
            id          UUID         NOT NULL,
            tenant_id   UUID         NOT NULL,
            accommodation_type_id UUID NOT NULL,
            name        VARCHAR(200) NOT NULL,
            date_from   VARCHAR(5)   NOT NULL,
            date_to     VARCHAR(5)   NOT NULL,
            price_per_night NUMERIC(10,2) NOT NULL,
            min_nights  INTEGER      NOT NULL DEFAULT 1,
            priority    INTEGER      NOT NULL DEFAULT 0,
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_price_rules_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            CONSTRAINT fk_price_rules_type
                FOREIGN KEY (accommodation_type_id)
                REFERENCES accommodation_types(id) ON DELETE CASCADE
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_accommodation_price_rules_type_id
        ON accommodation_price_rules (accommodation_type_id)
        """
    )

    # ── 3. Tabla de fotos de alojamiento ────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS accommodation_photos (
            id          UUID         NOT NULL,
            tenant_id   UUID         NOT NULL,
            accommodation_type_id UUID NOT NULL,
            file_url    VARCHAR(500) NOT NULL,
            file_key    VARCHAR(500) NOT NULL,
            caption     VARCHAR(200),
            sort_order  INTEGER      NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_photos_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            CONSTRAINT fk_photos_type
                FOREIGN KEY (accommodation_type_id)
                REFERENCES accommodation_types(id) ON DELETE CASCADE
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_accommodation_photos_type_id
        ON accommodation_photos (accommodation_type_id)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_accommodation_photos_type_id", table_name="accommodation_photos")
    op.drop_table("accommodation_photos")
    op.drop_index(
        "ix_accommodation_price_rules_type_id", table_name="accommodation_price_rules"
    )
    op.drop_table("accommodation_price_rules")
    op.drop_column("extras", "multiplier_label")
    op.drop_column("extras", "multiplier_type")
    op.execute("DROP TYPE IF EXISTS multipliertype")
    op.drop_column("extras", "price")
