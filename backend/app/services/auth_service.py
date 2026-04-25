"""
Lógica de negocio de autenticación.
Separado del router para mantener la capa de servicio limpia y testeable.
"""

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse


async def login_user(
    credentials: LoginRequest,
    session: AsyncSession,
) -> tuple[TokenResponse, str]:
    """
    Autentica un usuario con email y contraseña.

    Args:
        credentials: Email y contraseña del usuario.
        session: Sesión de BD.

    Returns:
        Tupla de (TokenResponse con access_token, refresh_token string).

    Raises:
        HTTPException 401: Si las credenciales son inválidas o la cuenta está inactiva.
    """
    # Buscar usuario por email
    result = await session.exec(select(User).where(User.email == credentials.email))
    user = result.first()

    # Usamos el mismo mensaje genérico para no revelar si el email existe
    invalid_credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error": {
                "code": "INVALID_CREDENTIALS",
                "message": "Email o contraseña incorrectos.",
            }
        },
    )

    if not user:
        raise invalid_credentials_error

    if not verify_password(credentials.password, user.hashed_password):
        raise invalid_credentials_error

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "Esta cuenta está desactivada. Contacta con el administrador.",
                }
            },
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        tenant_id=user.tenant_id,
    )
    refresh_token = create_refresh_token(user_id=user.id)

    return TokenResponse(access_token=access_token), refresh_token
