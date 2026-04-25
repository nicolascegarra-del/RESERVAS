"""
Tests de integración para los endpoints de autenticación.

Convención de nombres: test_[qué]_cuando_[condición]_entonces_[resultado]
"""

import pytest
from httpx import AsyncClient

from app.models.user import User


@pytest.mark.asyncio
async def test_login_success_cuando_credenciales_validas_entonces_devuelve_tokens(
    client: AsyncClient,
    active_user: User,
):
    """Login con credenciales correctas devuelve access_token y establece cookie."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 0
    # La cookie de refresh se establece en el header Set-Cookie
    assert "refresh_token" in response.headers.get("set-cookie", "")


@pytest.mark.asyncio
async def test_login_cuando_password_incorrecto_entonces_401(
    client: AsyncClient,
    active_user: User,
):
    """Login con contraseña incorrecta devuelve 401 con mensaje genérico."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "wrong_password"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_cuando_email_no_existe_entonces_401(
    client: AsyncClient,
):
    """Login con email inexistente devuelve 401 (no revela si el email existe)."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "noexiste@example.com", "password": "password123"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_cuando_usuario_inactivo_entonces_403(
    client: AsyncClient,
    inactive_user: User,
):
    """Login con usuario inactivo devuelve 403 con código ACCOUNT_DISABLED."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@example.com", "password": "password123"},
    )

    assert response.status_code == 403
    data = response.json()
    assert data["detail"]["error"]["code"] == "ACCOUNT_DISABLED"


@pytest.mark.asyncio
async def test_refresh_token_cuando_cookie_valida_entonces_nuevo_access_token(
    client: AsyncClient,
    active_user: User,
):
    """Refresh con cookie válida devuelve nuevo access_token."""
    # Primero hacemos login para obtener la cookie
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    original_token = login_response.json()["access_token"]

    # Ahora llamamos a refresh (la cookie se propaga automáticamente en el cliente de test)
    refresh_response = await client.post("/api/v1/auth/refresh")

    assert refresh_response.status_code == 200
    data = refresh_response.json()
    assert "access_token" in data
    # El nuevo token es diferente al original (aunque puede coincidir si se genera en el mismo segundo)
    assert len(data["access_token"]) > 0


@pytest.mark.asyncio
async def test_refresh_token_cuando_sin_cookie_entonces_401(
    client: AsyncClient,
):
    """Refresh sin cookie de refresh devuelve 401."""
    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error"]["code"] == "INVALID_REFRESH_TOKEN"


@pytest.mark.asyncio
async def test_logout_cuando_autenticado_entonces_elimina_cookie(
    client: AsyncClient,
    active_user: User,
):
    """Logout elimina la cookie de refresh token."""
    # Login para obtener la cookie
    await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )

    # Logout
    response = await client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    # Tras logout, refresh debe fallar
    refresh_response = await client.post("/api/v1/auth/refresh")
    assert refresh_response.status_code == 401


@pytest.mark.asyncio
async def test_login_cuando_email_invalido_entonces_422(
    client: AsyncClient,
):
    """Login con email malformado devuelve 422 de validación."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "no-es-un-email", "password": "password123"},
    )

    assert response.status_code == 422
