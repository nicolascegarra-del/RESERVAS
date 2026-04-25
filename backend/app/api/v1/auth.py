"""
Router de autenticación: login, refresh token y logout.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.dependencies import get_refresh_token_user
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import login_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.jwt_refresh_expire_days * 24 * 60 * 60


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    description="Autentica con email y contraseña. Devuelve access_token en JSON y establece refresh_token en HttpOnly cookie.",
)
async def login(
    credentials: LoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    token_response, refresh_token = await login_user(credentials, session)

    # Refresh token en HttpOnly cookie — nunca expuesto al JS del cliente
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=settings.app_env != "development",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )

    return token_response


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refrescar access token",
    description="Usa el refresh_token de la cookie HttpOnly para generar un nuevo access_token.",
)
async def refresh_token(
    current_user: Annotated[User, Depends(get_refresh_token_user)],
) -> TokenResponse:
    new_access_token = create_access_token(
        user_id=current_user.id,
        role=current_user.role.value,
        tenant_id=current_user.tenant_id,
    )
    return TokenResponse(access_token=new_access_token)


@router.post(
    "/logout",
    status_code=204,
    summary="Cerrar sesión",
    description="Elimina el refresh_token de la cookie. El access_token expira por sí solo en 15 min.",
)
async def logout(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        samesite="strict",
        httponly=True,
    )
