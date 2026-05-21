"""Registro de emails enviados por el sistema."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class MailLog(SQLModel, table=True):
    __tablename__ = "mail_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(index=True)
    reservation_id: UUID | None = Field(default=None)

    to_email: str = Field(max_length=255)
    subject: str = Field(max_length=500)
    email_type: str = Field(max_length=50)   # "confirmation", "reminder"
    status: str = Field(max_length=20)        # "sent", "failed", "no_smtp"
    smtp_source: str = Field(max_length=20)   # "tenant", "system", "none"
    error_message: str | None = Field(default=None, max_length=500)
    body_html: str | None = Field(default=None, sa_column_kwargs={"nullable": True})
    sent_at: datetime = Field(default_factory=datetime.utcnow, index=True)
