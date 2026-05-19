"""010_guest_docs

Crea las tablas de captación de documentos de viajeros:
  - reservation_guests: un huésped por viajero, vinculado a la reserva.
  - guest_upload_tokens: token público para que el huésped suba sus documentos.

Añade además los campos de credenciales SES (parte de viajeros, Ministerio
del Interior de España) a la tabla tenants. La contraseña SES se almacena
cifrada con app.core.crypto.encrypt_secret.

Revision ID: 010_guest_docs
Revises: 009_notification_days_before
Create Date: 2026-05-19
"""

from alembic import op

revision = "010_guest_docs"
down_revision = "009_notification_days_before"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS reservation_guests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL,
            is_main BOOLEAN NOT NULL DEFAULT FALSE,

            first_name VARCHAR(100),
            last_name VARCHAR(100),
            full_name VARCHAR(200),
            doc_type VARCHAR(20),
            doc_number VARCHAR(30),
            nationality VARCHAR(3),
            date_of_birth DATE,
            sex VARCHAR(1),
            doc_expiry_date DATE,
            address VARCHAR(300),

            id_front_url VARCHAR(500),
            id_back_url VARCHAR(500),

            ocr_status VARCHAR(20) NOT NULL DEFAULT 'pending',
            mrz_raw TEXT,

            uploaded_by VARCHAR(20),

            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_reservation_guests_reservation_id "
        "ON reservation_guests(reservation_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_reservation_guests_tenant_id "
        "ON reservation_guests(tenant_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS guest_upload_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_guest_upload_tokens_token "
        "ON guest_upload_tokens(token)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_guest_upload_tokens_reservation_id "
        "ON guest_upload_tokens(reservation_id)"
    )

    # Credenciales SES (parte de viajeros) por establecimiento
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ses_establishment_code VARCHAR(50)"
    )
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ses_username VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ses_password VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ses_enabled BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS guest_upload_tokens")
    op.execute("DROP TABLE IF EXISTS reservation_guests")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS ses_establishment_code")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS ses_username")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS ses_password")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS ses_enabled")
