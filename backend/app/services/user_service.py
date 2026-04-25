"""
Lógica de negocio para la gestión de usuarios (solo super_admin).
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserReadList, UserUpdate


async def create_user(data: UserCreate, session: AsyncSession) -> UserRead:
    """
    Crea un nuevo usuario verificando que el email no esté en uso.

    Args:
        data: Datos del nuevo usuario.
        session: Sesión de BD.

    Returns:
        UserRead con los datos del usuario creado.

    Raises:
        HTTPException 409: Si el email ya está registrado.
    """
    existing = await session.exec(select(User).where(User.email == data.email))
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": f"El email {data.email} ya está registrado.",
                    "field": "email",
                }
            },
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        tenant_id=data.tenant_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


async def get_user_by_id(user_id: UUID, session: AsyncSession) -> UserRead:
    """
    Obtiene un usuario por su ID.

    Args:
        user_id: UUID del usuario.
        session: Sesión de BD.

    Returns:
        UserRead con los datos del usuario.

    Raises:
        HTTPException 404: Si el usuario no existe.
    """
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": f"Usuario {user_id} no encontrado.",
                }
            },
        )
    return UserRead.model_validate(user)


async def list_users(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> UserReadList:
    """
    Lista todos los usuarios con paginación offset.

    Args:
        session: Sesión de BD.
        page: Número de página (base 1).
        page_size: Usuarios por página (máximo 100).

    Returns:
        UserReadList con items y metadatos de paginación.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    total_result = await session.exec(select(func.count()).select_from(User))
    total = total_result.one()

    users_result = await session.exec(
        select(User).offset(offset).limit(page_size).order_by(User.created_at.desc())
    )
    users = users_result.all()

    return UserReadList(
        items=[UserRead.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


async def update_user(
    user_id: UUID,
    data: UserUpdate,
    session: AsyncSession,
) -> UserRead:
    """
    Actualiza los campos proporcionados de un usuario.

    Args:
        user_id: UUID del usuario a actualizar.
        data: Campos a modificar (solo los que no son None).
        session: Sesión de BD.

    Returns:
        UserRead actualizado.

    Raises:
        HTTPException 404: Si el usuario no existe.
        HTTPException 409: Si el nuevo email ya está en uso.
    """
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": f"Usuario {user_id} no encontrado.",
                }
            },
        )

    update_data = data.model_dump(exclude_none=True)

    if "email" in update_data and update_data["email"] != user.email:
        existing = await session.exec(
            select(User).where(User.email == update_data["email"])
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "EMAIL_ALREADY_EXISTS",
                        "message": f"El email {update_data['email']} ya está registrado.",
                        "field": "email",
                    }
                },
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


async def delete_user(user_id: UUID, session: AsyncSession) -> None:
    """
    Elimina un usuario por su ID.

    Args:
        user_id: UUID del usuario a eliminar.
        session: Sesión de BD.

    Raises:
        HTTPException 404: Si el usuario no existe.
    """
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": f"Usuario {user_id} no encontrado.",
                }
            },
        )
    await session.delete(user)
    await session.commit()
