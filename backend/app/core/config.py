"""
Configuración centralizada de la aplicación usando pydantic-settings.
Lee variables de entorno y .env automáticamente.
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULT = "changeme-use-openssl-rand-hex-32"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @model_validator(mode="after")
    def validate_secrets_in_production(self) -> "Settings":
        if self.app_env == "production":
            if self.jwt_secret_key == _INSECURE_DEFAULT:
                raise ValueError(
                    "JWT_SECRET_KEY tiene el valor por defecto inseguro. "
                    "Define JWT_SECRET_KEY en las variables de entorno de producción."
                )
            if self.app_secret_key == _INSECURE_DEFAULT:
                raise ValueError(
                    "APP_SECRET_KEY tiene el valor por defecto inseguro. "
                    "Define APP_SECRET_KEY en las variables de entorno de producción."
                )
        return self

    # App
    app_name: str = "reservas-backend"
    app_env: str = "development"
    app_secret_key: str = _INSECURE_DEFAULT
    debug: bool = True

    # Base de datos
    database_url: str = "postgresql+asyncpg://reservas:reservas@localhost:5432/reservas_db"
    database_pool_size: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = _INSECURE_DEFAULT
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Frontend URL (para enlaces en emails)
    frontend_url: str = "http://localhost:3000"

    # MinIO / S3-compatible storage
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "kotis"
    minio_use_ssl: bool = False
    minio_public_url: str = ""  # URL pública base; si vacío se construye con endpoint

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsea la lista de orígenes CORS desde la variable de entorno."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
