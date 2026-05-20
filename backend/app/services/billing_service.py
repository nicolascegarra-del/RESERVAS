"""
Servicio de facturación: métodos de pago, cobros de reserva y facturas.

TODAS las operaciones filtran por tenant_id del JWT — nunca del cuerpo de la request.
La generación de número de factura usa SELECT ... FOR UPDATE para evitar
condiciones de carrera en entornos concurrentes.
"""

import math
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.billing import (
    Invoice,
    InvoiceSequence,
    PaymentMethod,
    ReservationPayment,
)
from app.models.reservation import Reservation
from app.models.tenant import Tenant
from app.schemas.billing import (
    InvoiceCreate,
    InvoiceListItem,
    InvoiceRead,
    PaginatedInvoices,
    PaymentMethodCreate,
    PaymentMethodRead,
    PaymentMethodUpdate,
    ReservationPaymentCreate,
    ReservationPaymentRead,
)


# ─── PaymentMethod ─────────────────────────────────────────────────────────────


async def list_payment_methods(
    session: AsyncSession,
    tenant_id: UUID,
) -> list[PaymentMethodRead]:
    """
    Lista todos los métodos de pago del tenant, ordenados por sort_order.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Lista de métodos de pago activos e inactivos.
    """
    result = await session.exec(
        select(PaymentMethod)
        .where(PaymentMethod.tenant_id == tenant_id)
        .order_by(PaymentMethod.sort_order, PaymentMethod.created_at)
    )
    return [PaymentMethodRead.model_validate(m) for m in result.all()]


async def create_payment_method(
    session: AsyncSession,
    data: PaymentMethodCreate,
    tenant_id: UUID,
) -> PaymentMethodRead:
    """
    Crea un nuevo método de pago para el tenant.

    Args:
        session: Sesión de BD.
        data: Datos del nuevo método.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Método de pago creado.
    """
    method = PaymentMethod(
        tenant_id=tenant_id,
        name=data.name,
        method_type=data.method_type,
        config=data.config,
        is_default=data.is_default,
        sort_order=data.sort_order,
    )
    session.add(method)
    await session.commit()
    await session.refresh(method)
    return PaymentMethodRead.model_validate(method)


async def update_payment_method(
    session: AsyncSession,
    method_id: UUID,
    data: PaymentMethodUpdate,
    tenant_id: UUID,
) -> PaymentMethodRead:
    """
    Actualiza un método de pago existente.

    Args:
        session: Sesión de BD.
        method_id: ID del método a actualizar.
        data: Campos a actualizar (todos opcionales).
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Método de pago actualizado.

    Raises:
        HTTPException 404: Si el método no pertenece al tenant.
    """
    method = await _get_payment_method_or_404(session, method_id, tenant_id)

    if data.name is not None:
        method.name = data.name
    if data.is_active is not None:
        method.is_active = data.is_active
    if data.is_default is not None:
        method.is_default = data.is_default
    if data.config is not None:
        method.config = data.config
    if data.sort_order is not None:
        method.sort_order = data.sort_order

    session.add(method)
    await session.commit()
    await session.refresh(method)
    return PaymentMethodRead.model_validate(method)


async def delete_payment_method(
    session: AsyncSession,
    method_id: UUID,
    tenant_id: UUID,
) -> None:
    """
    Elimina un método de pago (hard delete).

    Si el método tiene cobros asociados la BD lanzará un error de FK.
    En ese caso se debería usar soft delete (is_active=False).

    Args:
        session: Sesión de BD.
        method_id: ID del método a eliminar.
        tenant_id: Tenant del usuario autenticado.

    Raises:
        HTTPException 404: Si el método no pertenece al tenant.
    """
    method = await _get_payment_method_or_404(session, method_id, tenant_id)
    await session.delete(method)
    await session.commit()


async def _get_payment_method_or_404(
    session: AsyncSession,
    method_id: UUID,
    tenant_id: UUID,
) -> PaymentMethod:
    result = await session.exec(
        select(PaymentMethod).where(
            PaymentMethod.id == method_id,
            PaymentMethod.tenant_id == tenant_id,
        )
    )
    method = result.first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "PAYMENT_METHOD_NOT_FOUND",
                    "message": "Método de pago no encontrado.",
                }
            },
        )
    return method


# ─── ReservationPayment ───────────────────────────────────────────────────────


async def get_reservation_payment(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> ReservationPaymentRead | None:
    """
    Obtiene el cobro de una reserva, o None si no existe.

    Args:
        session: Sesión de BD.
        reservation_id: ID de la reserva.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Cobro de la reserva o None.
    """
    result = await session.exec(
        select(ReservationPayment).where(
            ReservationPayment.reservation_id == reservation_id,
            ReservationPayment.tenant_id == tenant_id,
        )
    )
    payment = result.first()
    if not payment:
        return None
    return ReservationPaymentRead.model_validate(payment)


async def create_reservation_payment(
    session: AsyncSession,
    reservation_id: UUID,
    data: ReservationPaymentCreate,
    tenant_id: UUID,
) -> ReservationPaymentRead:
    """
    Registra el cobro de una reserva.

    Solo se permite un cobro por reserva. El pago queda inmediatamente
    como completed con paid_at = ahora.

    Args:
        session: Sesión de BD.
        reservation_id: ID de la reserva a cobrar.
        data: Método de pago, importe y notas.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Cobro creado con estado completed.

    Raises:
        HTTPException 404: Si la reserva o el método de pago no existen.
        HTTPException 409: Si ya existe un cobro para esta reserva.
    """
    # Verificar que la reserva pertenece al tenant
    await _get_reservation_or_404(session, reservation_id, tenant_id)

    # Verificar que el método de pago pertenece al tenant
    payment_method = await _get_payment_method_or_404(session, data.payment_method_id, tenant_id)

    # Verificar que no existe ya un cobro
    existing = await session.exec(
        select(ReservationPayment).where(
            ReservationPayment.reservation_id == reservation_id,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "PAYMENT_ALREADY_EXISTS",
                    "message": "Esta reserva ya tiene un cobro registrado.",
                }
            },
        )

    now = datetime.utcnow()
    payment = ReservationPayment(
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        payment_method_id=data.payment_method_id,
        payment_method_name=payment_method.name,
        amount=data.amount,
        status="completed",
        paid_at=now,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )
    session.add(payment)
    await session.commit()
    await session.refresh(payment)
    return ReservationPaymentRead.model_validate(payment)


# ─── Invoice ──────────────────────────────────────────────────────────────────


async def get_next_invoice_sequence(
    session: AsyncSession,
    tenant_id: UUID,
    year: int,
) -> tuple[int, str]:
    """
    Incrementa y devuelve el siguiente número de secuencia de factura.

    Usa SELECT ... FOR UPDATE para prevenir condiciones de carrera cuando
    se emiten varias facturas concurrentemente para el mismo tenant.

    Args:
        session: Sesión de BD (debe estar en una transacción activa).
        tenant_id: Tenant para el que se genera la secuencia.
        year: Año fiscal de la secuencia.

    Returns:
        Tupla (nuevo_numero_secuencia, serie_factura).
    """
    result = await session.exec(
        select(InvoiceSequence)
        .where(
            InvoiceSequence.tenant_id == tenant_id,
            InvoiceSequence.year == year,
        )
        .with_for_update()
    )
    seq = result.first()

    if not seq:
        seq = InvoiceSequence(tenant_id=tenant_id, year=year, last_sequence=0)

    seq.last_sequence += 1
    session.add(seq)
    await session.flush()
    return seq.last_sequence, seq.invoice_series


async def generate_invoice(
    session: AsyncSession,
    reservation_id: UUID,
    data: InvoiceCreate,
    tenant_id: UUID,
) -> InvoiceRead:
    """
    Emite una factura para una reserva.

    La factura refleja el estado actual de la reserva (incluyendo extras
    añadidos durante la estancia), no el estado inicial de la reserva.
    Se genera una línea por alojamiento y una línea por extras (si los hay).

    Args:
        session: Sesión de BD.
        reservation_id: ID de la reserva a facturar.
        data: Datos del receptor de la factura.
        tenant_id: Tenant del usuario autenticado.

    Returns:
        Factura emitida.

    Raises:
        HTTPException 404: Si la reserva no pertenece al tenant.
        HTTPException 409: Si ya existe una factura para esta reserva.
    """
    # Verificar que no existe ya una factura
    existing = await session.exec(
        select(Invoice).where(Invoice.reservation_id == reservation_id)
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "INVOICE_ALREADY_EXISTS",
                    "message": "Esta reserva ya tiene una factura emitida.",
                }
            },
        )

    # Cargar reserva (verifica pertenencia al tenant)
    reservation = await _get_reservation_or_404(session, reservation_id, tenant_id)

    # Cargar tenant para datos del emisor
    tenant = await session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": "Empresa no encontrada."}},
        )

    # Cargar cobro si existe (para nombre del método de pago)
    payment_result = await session.exec(
        select(ReservationPayment).where(
            ReservationPayment.reservation_id == reservation_id,
            ReservationPayment.tenant_id == tenant_id,
        )
    )
    existing_payment = payment_result.first()

    # Calcular IVA efectivo a partir del snapshot de la reserva
    base_imponible = reservation.total_price
    total_iva = reservation.iva_amount
    total_with_iva = reservation.total_with_iva

    _cent = Decimal("0.01")

    # Calcular tipo de IVA medio para el desglose de líneas
    iva_rate = (
        (total_iva / base_imponible * 100).quantize(_cent)
        if base_imponible and base_imponible > 0
        else Decimal("0.00")
    )

    # Construir líneas de la factura
    lines: list[dict] = []

    # Línea de alojamiento
    accommodation_base = reservation.base_price
    accommodation_iva_amount = (
        accommodation_base * iva_rate / 100
    ).quantize(_cent)
    accommodation_total = accommodation_base + accommodation_iva_amount

    lines.append({
        "description": f"Alojamiento — {reservation.nights} noche(s)",
        "quantity": 1,
        "unit_price_net": str(accommodation_base),
        "iva_rate": str(iva_rate),
        "iva_amount": str(accommodation_iva_amount),
        "line_total_net": str(accommodation_base),
        "line_total_with_iva": str(accommodation_total),
    })

    # Línea de extras (si existen)
    extras_base = reservation.extras_price
    if extras_base and extras_base > 0:
        extras_iva_amount = (
            extras_base * iva_rate / 100
        ).quantize(_cent)
        extras_total = extras_base + extras_iva_amount
        lines.append({
            "description": "Servicios adicionales (extras)",
            "quantity": 1,
            "unit_price_net": str(extras_base),
            "iva_rate": str(iva_rate),
            "iva_amount": str(extras_iva_amount),
            "line_total_net": str(extras_base),
            "line_total_with_iva": str(extras_total),
        })

    # Obtener número de secuencia
    year = datetime.utcnow().year
    sequence_number, invoice_series = await get_next_invoice_sequence(
        session, tenant_id, year
    )
    invoice_number = f"{invoice_series}-{year}-{sequence_number:04d}"

    # Construir dirección del emisor
    issuer_address_parts = [
        part for part in [
            tenant.address,
            tenant.postal_code,
            tenant.municipality,
            tenant.province,
        ]
        if part
    ]
    issuer_address = ", ".join(issuer_address_parts) if issuer_address_parts else None

    now = datetime.utcnow()
    invoice = Invoice(
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        invoice_number=invoice_number,
        invoice_series=invoice_series,
        invoice_year=year,
        invoice_sequence=sequence_number,
        status="issued",
        issuer_name=tenant.legal_name or tenant.name,
        issuer_cif=tenant.cif,
        issuer_address=issuer_address,
        recipient_name=data.recipient_name,
        recipient_nif=data.recipient_nif,
        recipient_address=data.recipient_address,
        recipient_email=data.recipient_email,
        lines=lines,
        base_imponible=base_imponible,
        total_iva=total_iva,
        total_with_iva=total_with_iva,
        currency=reservation.currency,
        payment_method_name=existing_payment.payment_method_name if existing_payment else None,
        issued_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(invoice)
    await session.commit()
    await session.refresh(invoice)
    return InvoiceRead.model_validate(invoice)


async def list_invoices(
    session: AsyncSession,
    tenant_id: UUID,
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
) -> PaginatedInvoices:
    """
    Lista facturas del tenant con paginación.

    Args:
        session: Sesión de BD.
        tenant_id: Tenant del usuario autenticado.
        page: Página actual (base 1).
        page_size: Registros por página.
        status_filter: Filtro opcional por estado de factura.

    Returns:
        Listado paginado de facturas.
    """
    query = select(Invoice).where(Invoice.tenant_id == tenant_id)
    if status_filter:
        query = query.where(Invoice.status == status_filter)

    count_query = select(func.count()).select_from(
        query.subquery()
    )
    count_result = await session.exec(count_query)
    total = count_result.one()

    items_query = (
        query.order_by(col(Invoice.issued_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items_result = await session.exec(items_query)
    items = [InvoiceListItem.model_validate(inv) for inv in items_result.all()]

    pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedInvoices(items=items, total=total, page=page, pages=pages)


# ─── Helpers internos ─────────────────────────────────────────────────────────


async def _get_reservation_or_404(
    session: AsyncSession,
    reservation_id: UUID,
    tenant_id: UUID,
) -> Reservation:
    """
    Obtiene una reserva verificando que pertenece al tenant, o lanza 404.

    Raises:
        HTTPException 404: Si la reserva no existe o no pertenece al tenant.
    """
    result = await session.exec(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
        )
    )
    reservation = result.first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": "Reserva no encontrada.",
                }
            },
        )
    return reservation
