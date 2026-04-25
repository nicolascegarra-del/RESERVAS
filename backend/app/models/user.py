"""
Modelo User — usuario del sistema con rol y tenant asociado.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    super_admin = "super_admin"
    company_admin = "company_admin"
    reception = "reception"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(max_length=255, unique=True, index=True)
    hashed_password: str = Field(max_length=255)
    full_name: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.reception)
    # nullable: super_admin no pertenece a ningún tenant
    tenant_id: UUID | None = Field(default=None, foreign_key="tenants.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
