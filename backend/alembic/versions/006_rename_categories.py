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
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'camping' TO 'parcela'")
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'apartment' TO 'apartamento'")
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'cabin' TO 'albergue'")


def downgrade() -> None:
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'parcela' TO 'camping'")
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'apartamento' TO 'apartment'")
    op.execute("ALTER TYPE accommodationcategory RENAME VALUE 'albergue' TO 'cabin'")
