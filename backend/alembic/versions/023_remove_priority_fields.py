"""023_remove_priority_fields — elimina priority de accommodation_price_rules y seasons.

Revision ID: 023_remove_priority_fields
Revises: 022_update_multiplier_type
Create Date: 2026-05-21
"""

from alembic import op

revision = "023_remove_priority_fields"
down_revision = "022_update_multiplier_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'accommodation_price_rules' AND column_name = 'priority'
            ) THEN
                ALTER TABLE accommodation_price_rules DROP COLUMN priority;
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'seasons' AND column_name = 'priority'
            ) THEN
                ALTER TABLE seasons DROP COLUMN priority;
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
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'accommodation_price_rules' AND column_name = 'priority'
            ) THEN
                ALTER TABLE accommodation_price_rules ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'seasons' AND column_name = 'priority'
            ) THEN
                ALTER TABLE seasons ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
            END IF;
        END$$;
        """
    )
