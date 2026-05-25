"""
Lógica de negocio de autenticación.
Separado del router para mantener la capa de servicio limpia y testeable.
"""

import logging

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.access_log import AccessLog
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse


async def _log_access(
    user_email: str,
    event_type: str,
    user: User | None = None,
    ip_address: str | None = None,
    detail: str | None = None,
) -> None:
    # Sesión propia e independiente para que el log persista
    # aunque la sesión principal sea revertida por un error de autenticación.
    try:
        async with AsyncSession(engine) as log_session:
            log = AccessLog(
                user_id=user.id if user else None,
                user_email=user_email,
                user_role=user.role.value if user else None,
                tenant_id=user.tenant_id if user else None,
                ip_address=ip_address,
                event_type=event_type,
                detail=detail,
            )
            log_session.add(log)
            await log_session.commit()
    except Exception as e:
        logging.getLogger(__name__).error("ACCESS LOG ERROR: %s", e, exc_info=True)


async def login_user(
    credentials: LoginRequest,
    session: AsyncSession,
    ip_address: str | None = None,
) -> tuple[TokenResponse, str]:
    """
    Autentica un usuario con email y contraseña.

    Returns:
        Tupla de (TokenResponse con access_token, refresh_token string).

    Raises:
        HTTPException 401: Si las credenciales son inválidas o la cuenta está inactiva.
    """
    result = await session.exec(select(User).where(User.email == credentials.email))
    user = result.first()

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
        await _log_access(credentials.email, "login_failure", ip_address=ip_address, detail="Usuario no encontrado")
        raise invalid_credentials_error

    if not verify_password(credentials.password, user.hashed_password):
        await _log_access(credentials.email, "login_failure", user=user, ip_address=ip_address, detail="Contraseña incorrecta")
        raise invalid_credentials_error

    if not user.is_active:
        await _log_access(credentials.email, "login_failure", user=user, ip_address=ip_address, detail="Cuenta desactivada")
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
        full_name=user.full_name or "",
    )
    refresh_token = create_refresh_token(user_id=user.id)

    await _log_access(credentials.email, "login_success", user=user, ip_address=ip_address)

    return TokenResponse(access_token=access_token), refresh_token
