"""020_accommodation_extras_pricing_photos — extras con precio y multiplicador,
reglas de precio por temporada, fotos de tipo de alojamiento.

Revision ID: 020_accommodation_extras_pricing_photos
Revises: 019_billing_manual_creditnote
Create Date: 2026-05-20
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "020_accommodation_extras_pricing_photos"
down_revision = "019_billing_manual_creditnote"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Nuevas columnas en extras ────────────────────────────────────────────
    op.add_column(
        "extras",
        sa.Column(
            "price",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0.00",
        ),
    )

    op.execute("CREATE TYPE IF NOT EXISTS multipliertype AS ENUM ('fixed', 'per_person', 'per_custom')")
    op.add_column(
        "extras",
        sa.Column(
            "multiplier_type",
            postgresql.ENUM("fixed", "per_person", "per_custom", name="multipliertype", create_type=False),
            nullable=False,
            server_default="fixed",
        ),
    )
    op.add_column(
        "extras",
        sa.Column("multiplier_label", sa.String(100), nullable=True),
    )

    # ── 2. Tabla de reglas de precio por temporada ───────────────────────────────
    op.create_table(
        "accommodation_price_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accommodation_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("date_from", sa.String(5), nullable=False),
        sa.Column("date_to", sa.String(5), nullable=False),
        sa.Column("price_per_night", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_nights", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["accommodation_type_id"], ["accommodation_types.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_accommodation_price_rules_type_id",
        "accommodation_price_rules",
        ["accommodation_type_id"],
    )

    # ── 3. Tabla de fotos de alojamiento ────────────────────────────────────────
    op.create_table(
        "accommodation_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accommodation_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_key", sa.String(500), nullable=False),
        sa.Column("caption", sa.String(200), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["accommodation_type_id"], ["accommodation_types.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_accommodation_photos_type_id",
        "accommodation_photos",
        ["accommodation_type_id"],
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
