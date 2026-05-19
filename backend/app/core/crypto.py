"""
Cifrado simétrico para secretos almacenados en base de datos.

Usa Fernet (AES-128-CBC + HMAC-SHA256) derivando la clave de app_secret_key.
Prefijo "enc:" distingue valores ya cifrados de los que aún son texto plano
(backwards-compatible durante la migración).
"""

import base64
import hashlib
from typing import TYPE_CHECKING

from cryptography.fernet import Fernet

if TYPE_CHECKING:
    pass

_PREFIX = "enc:"
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        from app.core.config import settings
        key = hashlib.sha256(settings.app_secret_key.encode()).digest()
        _fernet = Fernet(base64.urlsafe_b64encode(key))
    return _fernet


def encrypt_secret(value: str) -> str:
    """Cifra un secreto. Valores vacíos se devuelven sin modificar."""
    if not value:
        return value
    encrypted = _get_fernet().encrypt(value.encode()).decode()
    return f"{_PREFIX}{encrypted}"


def decrypt_secret(value: str) -> str:
    """
    Descifra un secreto. Si el valor no tiene el prefijo 'enc:' (texto plano
    anterior al cifrado), se devuelve tal cual para compatibilidad retroactiva.
    """
    if not value:
        return value
    if value.startswith(_PREFIX):
        return _get_fernet().decrypt(value[len(_PREFIX):].encode()).decode()
    return value
