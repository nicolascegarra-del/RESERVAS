"""Configuración de notificaciones de email por tenant."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class MailNotificationConfig(SQLModel, table=True):
    __tablename__ = "mail_notification_configs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", index=True)
    notification_type: str = Field(max_length=50, index=True)
    enabled: bool = Field(default=True)
    subject: str = Field(default="", max_length=500)
    body_text: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    days_before: int | None = Field(default=None)  # Para notificaciones basadas en tiempo (días antes del check-in)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
