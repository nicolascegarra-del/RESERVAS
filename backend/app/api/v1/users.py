"""
Router de gestión de usuarios — solo accesible por super_admin.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserReadList, UserUpdate
from app.services.user_service import (
    create_user,
    delete_user,
    get_user_by_id,
    list_users,
    update_user,
)

router = APIRouter(prefix="/users", tags=["Usuarios"])

SuperAdminDep = Annotated[User, Depends(require_role(UserRole.super_admin))]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get(
    "",
    response_model=UserReadList,
    summary="Listar usuarios",
    description="Devuelve todos los usuarios con paginación. Solo super_admin.",
)
async def list_users_endpoint(
    _: SuperAdminDep,
    session: SessionDep,
    page: int = Query(default=1, ge=1, description="Número de página"),
    page_size: int = Query(default=20, ge=1, le=100, description="Usuarios por página"),
) -> UserReadList:
    return await list_users(session, page=page, page_size=page_size)


@router.post(
    "",
    response_model=UserRead,
    status_code=201,
    summary="Crear usuario",
    description="Crea un nuevo usuario en el sistema. Solo super_admin.",
)
async def create_user_endpoint(
    data: UserCreate,
    _: SuperAdminDep,
    session: SessionDep,
) -> UserRead:
    return await create_user(data, session)


@router.get(
    "/{user_id}",
    response_model=UserRead,
    summary="Obtener usuario",
    description="Devuelve los datos de un usuario por su ID. Solo super_admin.",
)
async def get_user_endpoint(
    user_id: UUID,
    _: SuperAdminDep,
    session: SessionDep,
) -> UserRead:
    return await get_user_by_id(user_id, session)


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="Actualizar usuario",
    description="Actualiza campos del usuario. Solo super_admin.",
)
async def update_user_endpoint(
    user_id: UUID,
    data: UserUpdate,
    _: SuperAdminDep,
    session: SessionDep,
) -> UserRead:
    return await update_user(user_id, data, session)


@router.delete(
    "/{user_id}",
    status_code=204,
    summary="Eliminar usuario",
    description="Elimina un usuario del sistema. Solo super_admin.",
)
async def delete_user_endpoint(
    user_id: UUID,
    _: SuperAdminDep,
    session: SessionDep,
) -> None:
    await delete_user(user_id, session)
