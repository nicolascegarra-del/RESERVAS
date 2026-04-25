"""
Configuración de la conexión a PostgreSQL usando SQLModel + asyncpg.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=settings.database_pool_size,
    max_overflow=20,
)


async def init_db() -> None:
    """
    Crea todas las tablas en la BD si no existen.
    En producción usar Alembic — esto es solo para desarrollo/tests.
    """
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia FastAPI que provee una sesión de BD por request.
    La sesión se cierra automáticamente al terminar el request.
    """
    async with AsyncSession(engine) as session:
        yield session
