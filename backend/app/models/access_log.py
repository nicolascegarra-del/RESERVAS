"""Registro de accesos y autenticaciones al sistema."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class AccessLog(SQLModel, table=True):
    __tablename__ = "access_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID | None = Field(default=None)
    user_email: str = Field(max_length=255)
    user_role: str | None = Field(default=None, max_length=50)
    tenant_id: UUID | None = Field(default=None, index=True)
    ip_address: str | None = Field(default=None, max_length=45)
    event_type: str = Field(max_length=50)   # "login_success", "login_failure", "logout"
    detail: str | None = Field(default=None, max_length=255)
    accessed_at: datetime = Field(default_factory=datetime.utcnow, index=True)
