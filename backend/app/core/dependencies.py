"""
Dependencias FastAPI reutilizables: autenticación y autorización.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.security import decode_token
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """
    Extrae y verifica el access token del header Authorization: Bearer.
    Devuelve el usuario autenticado o lanza 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error": {
                "code": "UNAUTHORIZED",
                "message": "No autenticado o token inválido.",
            }
        },
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    try:
        payload = decode_token(credentials.credentials)
        token_type: str = payload.get("type", "")
        if token_type != "access":
            raise credentials_exception
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await session.get(User, user_id)
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "Esta cuenta está desactivada.",
                }
            },
        )

    return user


def require_role(*roles: UserRole):
    """
    Factory de dependencia que verifica que el usuario tenga uno de los roles indicados.

    Uso: Depends(require_role(UserRole.super_admin, UserRole.company_admin))
    """

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "No tienes permisos para realizar esta acción.",
                    }
                },
            )
        return current_user

    return role_checker


async def get_refresh_token_user(
    refresh_token: Annotated[str | None, Cookie(alias="refresh_token")] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Extrae y verifica el refresh token de la HttpOnly cookie.
    Devuelve el usuario o lanza 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error": {
                "code": "INVALID_REFRESH_TOKEN",
                "message": "Refresh token inválido o expirado.",
            }
        },
    )

    if not refresh_token:
        raise credentials_exception

    try:
        payload = decode_token(refresh_token)
        token_type: str = payload.get("type", "")
        if token_type != "refresh":
            raise credentials_exception
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await session.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    return user
