"""
Schemas Pydantic para el CRUD de usuarios.
Nunca se expone hashed_password en respuestas.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.reception
    tenant_id: UUID | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: UserRole | None = None
    tenant_id: UUID | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    tenant_id: UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserReadList(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int
