"""
Configuración centralizada de la aplicación usando pydantic-settings.
Lee variables de entorno y .env automáticamente.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "reservas-backend"
    app_env: str = "development"
    app_secret_key: str = "changeme-use-openssl-rand-hex-32"
    debug: bool = True

    # Base de datos
    database_url: str = "postgresql+asyncpg://reservas:reservas@localhost:5432/reservas_db"
    database_pool_size: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "changeme-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Frontend URL (para enlaces en emails)
    frontend_url: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsea la lista de orígenes CORS desde la variable de entorno."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
