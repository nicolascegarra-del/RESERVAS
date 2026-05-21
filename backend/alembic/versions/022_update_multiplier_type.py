"""022_update_multiplier_type — replace per_custom with per_person_night/per_night and drop multiplier_label.

Revision ID: 022_update_multiplier_type
Revises: 021_drop_type_category
Create Date: 2026-05-21
"""

from alembic import op

revision = "022_update_multiplier_type"
down_revision = "021_drop_type_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Recreate multipliertype enum with new values, removing per_custom
    op.execute(
        """
        DO $$
        BEGIN
            -- Only run full recreation if per_custom still exists
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'multipliertype' AND e.enumlabel = 'per_custom'
            ) THEN
                -- Migrate per_custom records to fixed before recreating enum
                UPDATE extras SET multiplier_type = 'fixed'
                WHERE multiplier_type = 'per_custom';

                -- Create new enum with desired values
                CREATE TYPE multipliertype_new AS ENUM
                    ('fixed', 'per_person', 'per_person_night', 'per_night');

                -- Switch column to new type
                ALTER TABLE extras
                    ALTER COLUMN multiplier_type TYPE multipliertype_new
                    USING multiplier_type::text::multipliertype_new;

                -- Drop old type and rename new
                DROP TYPE multipliertype;
                ALTER TYPE multipliertype_new RENAME TO multipliertype;
            ELSE
                -- Add missing values if enum already partially updated
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'multipliertype' AND e.enumlabel = 'per_person_night'
                ) THEN
                    ALTER TYPE multipliertype ADD VALUE 'per_person_night';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'multipliertype' AND e.enumlabel = 'per_night'
                ) THEN
                    ALTER TYPE multipliertype ADD VALUE 'per_night';
                END IF;
            END IF;
        END$$;
        """
    )

    # Step 2: Drop multiplier_label column
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'extras' AND column_name = 'multiplier_label'
            ) THEN
                ALTER TABLE extras DROP COLUMN multiplier_label;
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
                WHERE table_name = 'extras' AND column_name = 'multiplier_label'
            ) THEN
                ALTER TABLE extras ADD COLUMN multiplier_label VARCHAR(100);
            END IF;
        END$$;
        """
    )
