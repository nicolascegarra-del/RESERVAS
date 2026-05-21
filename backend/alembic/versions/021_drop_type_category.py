"""021_drop_type_category — elimina type_category de accommodation_types y el tipo enum accommodationcategory.

Revision ID: 021_drop_type_category
Revises: 020_accommodation_extras_pricing_photos
Create Date: 2026-05-21
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "021_drop_type_category"
down_revision = "020_extras_pricing_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'accommodation_types'
                  AND column_name = 'type_category'
            ) THEN
                ALTER TABLE accommodation_types DROP COLUMN type_category;
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'accommodationcategory'
            ) THEN
                DROP TYPE accommodationcategory;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'accommodationcategory'
            ) THEN
                CREATE TYPE accommodationcategory AS ENUM ('parcela', 'apartamento', 'albergue');
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'accommodation_types'
                  AND column_name = 'type_category'
            ) THEN
                ALTER TABLE accommodation_types
                    ADD COLUMN type_category accommodationcategory NOT NULL DEFAULT 'parcela';
            END IF;
        END$$;
        """
    )
