"""
Utilidades de seguridad: hashing de contraseñas y gestión de JWT.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# Cost factor 12 (estándar Klyp)
_BCRYPT_ROUNDS = 12


def hash_password(plain_password: str) -> str:
    """
    Genera el hash bcrypt de una contraseña en texto plano.

    Args:
        plain_password: Contraseña sin cifrar.

    Returns:
        Hash bcrypt listo para almacenar en BD.
    """
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con su hash.

    Args:
        plain_password: Contraseña introducida por el usuario.
        hashed_password: Hash almacenado en BD.

    Returns:
        True si la contraseña es correcta.
    """
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(
    user_id: UUID,
    role: str,
    tenant_id: UUID | None = None,
    full_name: str = "",
) -> str:
    """
    Crea un JWT de acceso con expiración corta (15 min por defecto).

    Args:
        user_id: ID del usuario autenticado.
        role: Rol del usuario (super_admin, company_admin, reception).
        tenant_id: ID del tenant al que pertenece el usuario (None para super_admin).
        full_name: Nombre completo del usuario para mostrar en la UI.

    Returns:
        JWT firmado como string.
    """
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "full_name": full_name,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: UUID) -> str:
    """
    Crea un JWT de refresco con expiración larga (7 días por defecto).
    Se almacena en HttpOnly cookie — no expone rol ni tenant.

    Args:
        user_id: ID del usuario autenticado.

    Returns:
        JWT firmado como string.
    """
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_expire_days)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodifica y valida un JWT. Lanza JWTError si es inválido o expirado.

    Args:
        token: JWT en formato string.

    Returns:
        Payload decodificado del token.

    Raises:
        JWTError: Si el token es inválido, expirado o malformado.
    """
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
