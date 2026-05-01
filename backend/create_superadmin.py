"""
Script de bootstrap — crea el primer usuario superadmin.
Uso:
    python create_superadmin.py
"""

import asyncio
import os

import bcrypt
from sqlmodel import select
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://reservas:reservas@postgres:5432/reservas_db",
)

EMAIL = "admin@klyp.es"
PASSWORD = "KlypAdmin2025!"
FULL_NAME = "Super Admin"


async def main() -> None:
    # Import models so SQLModel knows all tables
    from app.models.user import User, UserRole  # noqa: F401

    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(engine) as session:
        existing = await session.exec(select(User).where(User.email == EMAIL))
        if existing.first():
            print(f"[!] Ya existe un usuario con email '{EMAIL}'. Sin cambios.")
            return

        hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()
        user = User(
            email=EMAIL,
            hashed_password=hashed,
            full_name=FULL_NAME,
            role=UserRole.super_admin,
            tenant_id=None,
        )
        session.add(user)
        await session.commit()

    print("✓ Superadmin creado correctamente.")
    print(f"  Email   : {EMAIL}")
    print(f"  Password: {PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
