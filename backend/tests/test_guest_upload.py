"""
Tests de integración del flujo público de carga de documentos de viajeros.

Convención: test_[qué]_cuando_[condición]_entonces_[resultado]
"""

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.guest_upload_token import GuestUploadToken
from app.models.reservation import Reservation


@pytest.mark.asyncio
async def test_get_info_cuando_token_invalido_entonces_404(client: AsyncClient):
    """Un token inexistente devuelve 404 con código TOKEN_NOT_FOUND."""
    response = await client.get("/api/v1/public/guest-upload/token-falso")
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "TOKEN_NOT_FOUND"


@pytest.mark.asyncio
async def test_flujo_publico_cuando_token_valido_entonces_crea_y_lista_viajeros(
    client: AsyncClient,
    session: AsyncSession,
    test_reservation: Reservation,
):
    """Con un token válido se puede consultar la info, crear y listar viajeros."""
    token = GuestUploadToken(
        reservation_id=test_reservation.id,
        tenant_id=test_reservation.tenant_id,
        token="token-de-prueba-valido",
        is_active=True,
    )
    session.add(token)
    await session.commit()

    # Info de la reserva
    info_res = await client.get(
        "/api/v1/public/guest-upload/token-de-prueba-valido"
    )
    assert info_res.status_code == 200
    info = info_res.json()
    assert info["num_persons"] == 2
    assert info["guest_name"] == "Ana García"
    assert info["registered_guests"] == 0

    # Crear un viajero
    create_res = await client.post(
        "/api/v1/public/guest-upload/token-de-prueba-valido/guests",
        json={"first_name": "Ana", "last_name": "García", "doc_type": "dni"},
    )
    assert create_res.status_code == 201
    guest = create_res.json()
    assert guest["first_name"] == "Ana"
    assert guest["doc_status"] == "partial"  # faltan campos / imagen

    # Listar viajeros
    list_res = await client.get(
        "/api/v1/public/guest-upload/token-de-prueba-valido/guests"
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


@pytest.mark.asyncio
async def test_crear_viajero_cuando_supera_num_personas_entonces_409(
    client: AsyncClient,
    session: AsyncSession,
    test_reservation: Reservation,
):
    """No se pueden registrar más viajeros que num_persons de la reserva."""
    token = GuestUploadToken(
        reservation_id=test_reservation.id,
        tenant_id=test_reservation.tenant_id,
        token="token-limite",
        is_active=True,
    )
    session.add(token)
    await session.commit()

    # La reserva es para 2 personas → creamos 2 viajeros
    for _ in range(2):
        res = await client.post(
            "/api/v1/public/guest-upload/token-limite/guests",
            json={"first_name": "Viajero"},
        )
        assert res.status_code == 201

    # El tercero debe ser rechazado
    third = await client.post(
        "/api/v1/public/guest-upload/token-limite/guests",
        json={"first_name": "Extra"},
    )
    assert third.status_code == 409
    assert third.json()["detail"]["error"]["code"] == "MAX_GUESTS_REACHED"
