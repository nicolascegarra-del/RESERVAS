"""
Modelo UserPreference — configuración persistente por usuario (widgets del dashboard, etc.).
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class UserPreference(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", unique=True, index=True)
    widget_config: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, server_default="{}"),
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)
