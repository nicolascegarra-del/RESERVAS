"""
Configuración compartida de tests: BD en memoria SQLite, cliente HTTP de pruebas.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.security import hash_password
from app.main import app
from app.models.tenant import Tenant
from app.models.user import User, UserRole

# SQLite en memoria para tests — no afecta a la BD real
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)


async def get_test_session():
    async with AsyncSession(test_engine) as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Crea las tablas antes de cada test y las elimina después."""
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture
async def session():
    """Sesión de BD de test."""
    async with AsyncSession(test_engine) as s:
        yield s


@pytest_asyncio.fixture
async def client():
    """Cliente HTTP de test con la BD de test inyectada."""
    app.dependency_overrides[get_session] = get_test_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_tenant(session: AsyncSession) -> Tenant:
    """Tenant de prueba."""
    tenant = Tenant(name="Empresa Test", slug="empresa-test")
    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def active_user(session: AsyncSession, test_tenant: Tenant) -> User:
    """Usuario activo de prueba."""
    user = User(
        email="test@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test User",
        role=UserRole.reception,
        tenant_id=test_tenant.id,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(session: AsyncSession, test_tenant: Tenant) -> User:
    """Usuario inactivo de prueba."""
    user = User(
        email="inactive@example.com",
        hashed_password=hash_password("password123"),
        full_name="Inactive User",
        role=UserRole.reception,
        tenant_id=test_tenant.id,
        is_active=False,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_reservation(session: AsyncSession, test_tenant: Tenant):
    """Reserva confirmada de prueba para 2 viajeros."""
    from datetime import date
    from decimal import Decimal
    from uuid import uuid4

    from app.models.reservation import Reservation, ReservationStatus

    reservation = Reservation(
        tenant_id=test_tenant.id,
        accommodation_type_id=uuid4(),
        unit_id=uuid4(),
        guest_name="Ana García",
        guest_email="ana@example.com",
        check_in=date(2026, 7, 1),
        check_out=date(2026, 7, 5),
        num_persons=2,
        nights=4,
        base_price=Decimal("400.00"),
        extras_price=Decimal("0.00"),
        total_price=Decimal("400.00"),
        currency="EUR",
        selected_extra_ids=[],
        status=ReservationStatus.confirmed,
    )
    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    return reservation


@pytest_asyncio.fixture
async def super_admin_user(session: AsyncSession) -> User:
    """Super admin de prueba (sin tenant)."""
    user = User(
        email="admin@klyp.com",
        hashed_password=hash_password("adminpass123"),
        full_name="Super Admin",
        role=UserRole.super_admin,
        tenant_id=None,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
