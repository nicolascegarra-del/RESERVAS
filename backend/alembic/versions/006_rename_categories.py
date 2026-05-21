"""006_rename_categories

Revision ID: 006_rename_categories
Revises: 005_mail_log
Create Date: 2026-05-19
"""

from alembic import op

revision = "006_rename_categories"
down_revision = "005_mail_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # RENAME VALUE falla si el label ya no existe (create_all() crea el ENUM con
    # los valores actuales). Cada renombrado es condicional.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'camping'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'camping' TO 'parcela';
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'apartment'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'apartment' TO 'apartamento';
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'cabin'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'cabin' TO 'albergue';
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'parcela'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'parcela' TO 'camping';
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'apartamento'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'apartamento' TO 'apartment';
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'accommodationcategory' AND e.enumlabel = 'albergue'
            ) THEN
                ALTER TYPE accommodationcategory RENAME VALUE 'albergue' TO 'cabin';
            END IF;
        END $$
    """)
