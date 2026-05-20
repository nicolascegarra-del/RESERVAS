"""
Router de facturación — métodos de pago, cobros y facturas.

Control de acceso:
- GET (lectura): cualquier rol autenticado del tenant.
- POST / PUT / DELETE (escritura): company_admin, reception y super_admin.

El tenant_id SIEMPRE se extrae del JWT (current_user.tenant_id).
El super_admin puede operar sobre cualquier tenant pasando ?tenant_id=<uuid>.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
import io
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user, require_role
from app.models.billing import Invoice
from app.models.user import User, UserRole
from app.schemas.billing import (
    InvoiceCreate,
    InvoiceCreateManual,
    InvoiceRead,
    PaginatedInvoices,
    PaymentMethodCreate,
    PaymentMethodRead,
    PaymentMethodUpdate,
    ReservationPaymentCreate,
    ReservationPaymentRead,
)
from app.services import billing_service

router = APIRouter(tags=["Facturación"])

AnyAuthDep = Annotated[User, Depends(get_current_user)]
ManageDep = Annotated[
    User,
    Depends(
        require_role(
            UserRole.company_admin,
            UserRole.reception,
            UserRole.super_admin,
        )
    ),
]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _resolve_tenant_id(current_user: User, tenant_id_override: UUID | None) -> UUID:
    """
    Resuelve el tenant_id efectivo para la operación.

    El super_admin puede pasar ?tenant_id=<uuid> para operar sobre otro tenant.
    El resto de roles usa siempre su propio tenant_id del JWT.
    """
    if tenant_id_override and current_user.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Solo super_admin puede especificar un tenant diferente.",
                }
            },
        )
    if tenant_id_override:
        return tenant_id_override
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "MISSING_TENANT",
                    "message": "El usuario no tiene tenant asignado.",
                }
            },
        )
    return current_user.tenant_id


# ─── Métodos de pago ──────────────────────────────────────────────────────────


@router.get(
    "/billing/payment-methods",
    response_model=list[PaymentMethodRead],
    summary="Listar métodos de pago",
    description="Devuelve todos los métodos de pago configurados para el tenant.",
)
async def list_payment_methods(
    current_user: AnyAuthDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> list[PaymentMethodRead]:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.list_payment_methods(session, effective_tenant_id)


@router.post(
    "/billing/payment-methods",
    response_model=PaymentMethodRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear método de pago",
    description="Crea un nuevo método de pago para el tenant.",
)
async def create_payment_method(
    data: PaymentMethodCreate,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PaymentMethodRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.create_payment_method(session, data, effective_tenant_id)


@router.put(
    "/billing/payment-methods/{method_id}",
    response_model=PaymentMethodRead,
    summary="Actualizar método de pago",
    description="Actualiza los datos de un método de pago existente.",
)
async def update_payment_method(
    method_id: UUID,
    data: PaymentMethodUpdate,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> PaymentMethodRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.update_payment_method(
        session, method_id, data, effective_tenant_id
    )


@router.delete(
    "/billing/payment-methods/{method_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar método de pago",
    description="Elimina un método de pago del tenant.",
)
async def delete_payment_method(
    method_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    await billing_service.delete_payment_method(session, method_id, effective_tenant_id)


# ─── Cobros de reserva ────────────────────────────────────────────────────────


@router.get(
    "/billing/reservations/{reservation_id}/payment",
    response_model=ReservationPaymentRead | None,
    summary="Obtener cobro de reserva",
    description="Devuelve el cobro registrado para la reserva, o null si no existe.",
)
async def get_reservation_payment(
    reservation_id: UUID,
    current_user: AnyAuthDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationPaymentRead | None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.get_reservation_payment(
        session, reservation_id, effective_tenant_id
    )


@router.post(
    "/billing/reservations/{reservation_id}/payment",
    response_model=ReservationPaymentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar cobro de reserva",
    description="Registra el cobro de una reserva. Solo se permite un cobro por reserva.",
)
async def create_reservation_payment(
    reservation_id: UUID,
    data: ReservationPaymentCreate,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> ReservationPaymentRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.create_reservation_payment(
        session, reservation_id, data, effective_tenant_id
    )


# ─── Facturas ─────────────────────────────────────────────────────────────────


@router.get(
    "/billing/reservations/{reservation_id}/invoice",
    response_model=InvoiceRead | None,
    summary="Obtener factura de reserva",
    description="Devuelve la factura emitida para la reserva, o null si no existe.",
)
async def get_reservation_invoice(
    reservation_id: UUID,
    current_user: AnyAuthDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead | None:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await session.exec(
        select(Invoice).where(
            Invoice.reservation_id == reservation_id,
            Invoice.tenant_id == effective_tenant_id,
        )
    )
    invoice = result.first()
    if not invoice:
        return None
    return InvoiceRead.model_validate(invoice)


@router.post(
    "/billing/reservations/{reservation_id}/invoice",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Emitir factura de reserva",
    description=(
        "Emite una factura para la reserva. La factura refleja el estado actual "
        "de la reserva incluyendo todos los extras añadidos durante la estancia. "
        "Solo se permite una factura por reserva."
    ),
)
async def generate_invoice(
    reservation_id: UUID,
    data: InvoiceCreate,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.generate_invoice(
        session, reservation_id, data, effective_tenant_id
    )


@router.get(
    "/billing/invoices",
    response_model=PaginatedInvoices,
    summary="Listar facturas",
    description="Lista todas las facturas del tenant con paginación y filtro por estado.",
)
async def list_invoices(
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    invoice_status: str | None = Query(default=None, alias="status"),
) -> PaginatedInvoices:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.list_invoices(
        session,
        effective_tenant_id,
        page=page,
        page_size=page_size,
        status_filter=invoice_status,
    )


@router.post(
    "/billing/invoices/manual",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear factura manual",
    description="Crea una factura sin reserva asociada (cliente directo).",
)
async def create_manual_invoice(
    data: InvoiceCreateManual,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.create_manual_invoice(session, data, effective_tenant_id)


@router.get(
    "/billing/invoices/{invoice_id}",
    response_model=InvoiceRead,
    summary="Obtener factura por ID",
)
async def get_invoice(
    invoice_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    invoice = await billing_service.get_invoice_or_404(session, invoice_id, effective_tenant_id)
    return InvoiceRead.model_validate(invoice)


@router.get(
    "/billing/invoices/{invoice_id}/pdf",
    summary="Descargar PDF de factura",
    response_class=StreamingResponse,
)
async def download_invoice_pdf(
    invoice_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> StreamingResponse:
    from app.services.pdf_service import generate_invoice_pdf

    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    invoice = await billing_service.get_invoice_or_404(session, invoice_id, effective_tenant_id)
    pdf_bytes = generate_invoice_pdf(invoice)
    filename = f"{invoice.invoice_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/billing/invoices/{invoice_id}/cancel",
    response_model=InvoiceRead,
    summary="Cancelar factura",
)
async def cancel_invoice(
    invoice_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.cancel_invoice(session, invoice_id, effective_tenant_id)


@router.post(
    "/billing/invoices/{invoice_id}/mark-sent",
    response_model=InvoiceRead,
    summary="Marcar factura como enviada",
)
async def mark_invoice_sent(
    invoice_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.mark_invoice_sent(session, invoice_id, effective_tenant_id)


@router.post(
    "/billing/invoices/{invoice_id}/credit-note",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Emitir nota de crédito (factura rectificativa)",
    description=(
        "Genera una factura rectificativa (RECT) con importes negativos, "
        "cancela la factura original y la vincula mediante credit_note_for_id."
    ),
)
async def create_credit_note(
    invoice_id: UUID,
    current_user: ManageDep,
    session: SessionDep,
    tenant_id: UUID | None = Query(default=None, description="Solo para super_admin"),
) -> InvoiceRead:
    effective_tenant_id = _resolve_tenant_id(current_user, tenant_id)
    return await billing_service.create_credit_note(session, invoice_id, effective_tenant_id)
