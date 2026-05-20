"""
Servicio de almacenamiento de ficheros en MinIO (S3-compatible).

Uso: subir fotos de alojamientos.
Devuelve la URL pública del fichero subido.
"""

import uuid
from pathlib import Path

from minio import Minio  # type: ignore[import-untyped]
from minio.error import S3Error  # type: ignore[import-untyped]

from app.core.config import settings


def _client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )


def _ensure_bucket(client: Minio) -> None:
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error:
        pass


def _public_url(object_key: str) -> str:
    if settings.minio_public_url:
        base = settings.minio_public_url.rstrip("/")
        return f"{base}/{settings.minio_bucket}/{object_key}"
    proto = "https" if settings.minio_use_ssl else "http"
    return f"{proto}://{settings.minio_endpoint}/{settings.minio_bucket}/{object_key}"


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def upload_accommodation_photo(
    file_bytes: bytes,
    content_type: str,
    original_filename: str,
    tenant_id: str,
    type_id: str,
) -> tuple[str, str]:
    """
    Sube una foto al bucket de MinIO.

    Returns:
        (file_url, file_key) — URL pública y clave del objeto para borrado futuro.

    Raises:
        ValueError: Si el tipo de contenido no está permitido o el fichero es demasiado grande.
        S3Error: Si falla la comunicación con MinIO.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Tipo de fichero no permitido: {content_type}")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("El fichero supera el límite de 10 MB.")

    ext = Path(original_filename).suffix.lower() or ".jpg"
    object_key = f"alojamientos/{tenant_id}/{type_id}/{uuid.uuid4().hex}{ext}"

    client = _client()
    _ensure_bucket(client)

    import io
    client.put_object(
        settings.minio_bucket,
        object_key,
        io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )

    return _public_url(object_key), object_key


def delete_object(file_key: str) -> None:
    """Elimina un objeto del bucket. Ignora errores si ya no existe."""
    try:
        client = _client()
        client.remove_object(settings.minio_bucket, file_key)
    except S3Error:
        pass
