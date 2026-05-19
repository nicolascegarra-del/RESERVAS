"""Configuración global del sistema — singleton (id=1 siempre)."""

from sqlmodel import Field, SQLModel


class SystemSettings(SQLModel, table=True):
    __tablename__ = "system_settings"

    id: int = Field(default=1, primary_key=True)

    # SMTP de fallback (usado cuando el tenant no tiene SMTP propio)
    smtp_enabled: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int = Field(default=587, sa_column_kwargs={"server_default": "587"})
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=500)
    smtp_from: str | None = Field(default=None, max_length=255)
