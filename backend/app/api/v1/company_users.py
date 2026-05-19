"""
Endpoints de gestión de usuarios accesibles por company_admin.
Scoped al tenant del usuario autenticado.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User, UserRole

router = APIRouter(prefix="/company", tags=["Empresa - Usuarios"])

CompanyAdminDep = Annotated[User, Depends(require_role(UserRole.company_admin))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CompanyUserRead(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


class CompanyUserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole


class CompanyUserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str


class TenantLimits(BaseModel):
    max_company_admins: int
    max_reception_users: int
    active_company_admins: int
    active_reception_users: int


def _to_read(u: User) -> CompanyUserRead:
    return CompanyUserRead(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at.isoformat(),
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get(
    "/limits",
    response_model=TenantLimits,
    summary="Límites de usuarios del tenant",
)
async def get_tenant_limits(current_user: CompanyAdminDep, session: SessionDep) -> TenantLimits:
    tenant = await session.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}},
        )

    admins_result = await session.exec(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.role == UserRole.company_admin,
            User.is_active == True,  # noqa: E712
        )
    )
    reception_result = await session.exec(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.role == UserRole.reception,
            User.is_active == True,  # noqa: E712
        )
    )
    return TenantLimits(
        max_company_admins=tenant.max_company_admins,
        max_reception_users=tenant.max_reception_users,
        active_company_admins=len(admins_result.all()),
        active_reception_users=len(reception_result.all()),
    )


@router.get(
    "/users",
    response_model=list[CompanyUserRead],
    summary="Listar usuarios del tenant",
)
async def list_company_users(current_user: CompanyAdminDep, session: SessionDep) -> list[CompanyUserRead]:
    result = await session.exec(
        select(User)
        .where(User.tenant_id == current_user.tenant_id)
        .where(User.role != UserRole.super_admin)
        .order_by(User.full_name)
    )
    return [_to_read(u) for u in result.all()]


@router.post(
    "/users",
    response_model=CompanyUserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario en el tenant",
)
async def create_company_user(
    data: CompanyUserCreate, current_user: CompanyAdminDep, session: SessionDep
) -> CompanyUserRead:
    if data.role not in (UserRole.company_admin, UserRole.reception):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_ROLE", "message": "Solo se pueden crear usuarios de tipo Admin Empresa o Gestión."}},
        )

    tenant = await session.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}},
        )

    existing = await session.exec(select(User).where(User.email == str(data.email)))
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "EMAIL_TAKEN", "message": "El email ya está registrado.", "field": "email"}},
        )

    count_result = await session.exec(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.role == data.role,
            User.is_active == True,  # noqa: E712
        )
    )
    current_count = len(count_result.all())

    if data.role == UserRole.company_admin and current_count >= tenant.max_company_admins:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "USER_LIMIT_REACHED", "message": f"Has alcanzado el límite de {tenant.max_company_admins} admin(s) de empresa."}},
        )
    if data.role == UserRole.reception and current_count >= tenant.max_reception_users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "USER_LIMIT_REACHED", "message": f"Has alcanzado el límite de {tenant.max_reception_users} usuario(s) de gestión."}},
        )

    user = User(
        email=str(data.email),
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
        tenant_id=current_user.tenant_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _to_read(user)


@router.patch(
    "/users/{user_id}",
    response_model=CompanyUserRead,
    summary="Actualizar usuario del tenant",
)
async def update_company_user(
    user_id: UUID, data: CompanyUserUpdate, current_user: CompanyAdminDep, session: SessionDep
) -> CompanyUserRead:
    user = await session.get(User, user_id)
    if not user or user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}},
        )

    if data.role is not None and data.role not in (UserRole.company_admin, UserRole.reception):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_ROLE", "message": "Rol no válido."}},
        )

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _to_read(user)


@router.post(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cambiar contraseña de usuario del tenant",
)
async def reset_company_user_password(
    user_id: UUID, data: PasswordReset, current_user: CompanyAdminDep, session: SessionDep
) -> None:
    user = await session.get(User, user_id)
    if not user or user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "USER_NOT_FOUND", "message": "Usuario no encontrado."}},
        )

    user.hashed_password = hash_password(data.new_password)
    session.add(user)
    await session.commit()
