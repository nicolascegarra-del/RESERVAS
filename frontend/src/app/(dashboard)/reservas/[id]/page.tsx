"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Loader2, Save, Pencil, X, History, Users,
  ShieldCheck, FileText, CreditCard, User, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ReservationStatusBadge } from "@/components/reservations/ReservationStatusBadge";
import { PriceBreakdown } from "@/components/reservations/PriceBreakdown";
import { CancelReservationDialog } from "@/components/reservations/CancelReservationDialog";
import { RequestChangeDialog } from "@/components/reservations/RequestChangeDialog";
import { GuestForm, type GuestFormValues } from "@/components/reservations/GuestForm";
import { GuestDocsTab } from "@/components/reservations/GuestDocsTab";
import { VehiclesAndAccessTab } from "@/components/reservations/VehiclesAndAccessTab";
import { reservationsApi, billingApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { extractApiErrorMessage } from "@/lib/utils";
import type {
  Reservation, ReservationHistoryEntry, ReservationStatus,
  PaymentMethod, ReservationPayment, Invoice,
} from "@/types";
import {
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Acciones disponibles según estado (excluyendo cancelación) ──────────────

interface StatusAction {
  label: string;
  targetStatus: ReservationStatus;
  variant: "default" | "destructive" | "outline";
  className?: string;
}

function getActionsForStatus(
  status: ReservationStatus,
  isAdmin: boolean,
): StatusAction[] {
  if (!isAdmin) return [];

  switch (status) {
    case "confirmed":
      return [
        {
          label: "Check-in",
          targetStatus: "checked_in",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700 text-white",
        },
        // Cancelación se gestiona con diálogo dedicado — ver CancelReservationDialog
      ];
    case "checked_in":
      return [
        {
          label: "Check-out",
          targetStatus: "checked_out",
          variant: "default",
          className: "bg-klyp-accent hover:bg-klyp-accent/90 text-white",
        },
        {
          label: "No Show",
          targetStatus: "no_show",
          variant: "outline",
          className: "border-orange-400 text-orange-600 hover:bg-orange-50",
        },
      ];
    case "cancelled":
      return [
        {
          label: "Reactivar",
          targetStatus: "confirmed",
          variant: "outline",
          className: "border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10",
        },
      ];
    default:
      return [];
  }
}

// Si el estado permite cancelación directa
function isCancellable(status: ReservationStatus): boolean {
  return status === "confirmed" || status === "pending_payment";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReservaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params["id"] as string;

  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === "company_admin" || user?.role === "super_admin";

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Historial
  const [history, setHistory] = useState<ReservationHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Estado de notas internas editables
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Estado de acciones de cambio de estado
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Diálogo de cancelación con política
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Diálogo de solicitud de cambio (recepcionista)
  const [showRequestChange, setShowRequestChange] = useState(false);

  // Pago
  const [payment, setPayment] = useState<ReservationPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_method_id: "",
    amount: "",
    notes: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Factura
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    recipient_name: "",
    recipient_nif: "",
    recipient_address: "",
    recipient_email: "",
  });
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Edición inline de datos del huésped
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [isSavingGuest, setIsSavingGuest] = useState(false);
  const [guestSaveError, setGuestSaveError] = useState<string | null>(null);

  const fetchReservation = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await reservationsApi.get(reservationId);
      setReservation(response.data);
      setNotes(response.data.internal_notes ?? "");
    } catch {
      setLoadError("No se pudo cargar la reserva. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoading(true);
    try {
      const res = await reservationsApi.getHistory(reservationId);
      setHistory(res.data);
      setHistoryLoaded(true);
    } catch {
      // silencioso
    } finally {
      setHistoryLoading(false);
    }
  }, [reservationId, historyLoaded]);

  useEffect(() => {
    void fetchReservation();
  }, [fetchReservation]);

  // Cargar pago e factura en paralelo cuando la reserva está disponible
  useEffect(() => {
    if (!reservation) return;

    const loadBillingData = async () => {
      setPaymentLoading(true);
      setInvoiceLoading(true);
      try {
        const [paymentRes, invoiceRes] = await Promise.allSettled([
          billingApi.getReservationPayment(reservation.id),
          billingApi.getReservationInvoice(reservation.id),
        ]);
        if (paymentRes.status === "fulfilled") {
          setPayment(paymentRes.value.data ?? null);
        }
        if (invoiceRes.status === "fulfilled") {
          setInvoice(invoiceRes.value.data ?? null);
        }
      } finally {
        setPaymentLoading(false);
        setInvoiceLoading(false);
      }
    };

    void loadBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id]);

  const handleOpenPaymentDialog = async () => {
    try {
      const res = await billingApi.listPaymentMethods();
      setPaymentMethods(res.data.filter((m) => m.is_active));
      const defaultMethod = res.data.find((m) => m.is_active && m.is_default);
      setPaymentForm({
        payment_method_id: defaultMethod?.id ?? (res.data[0]?.id ?? ""),
        amount: reservation ? parseFloat(reservation.total_with_iva).toFixed(2) : "",
        notes: "",
      });
    } catch {
      // silencioso — el diálogo mostrará lista vacía
    }
    setShowPaymentDialog(true);
  };

  const handleCreatePayment = async () => {
    if (!reservation || !paymentForm.payment_method_id) {
      setPaymentError("Selecciona un método de pago.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      const res = await billingApi.createReservationPayment(reservation.id, {
        payment_method_id: paymentForm.payment_method_id,
        amount: parseFloat(paymentForm.amount),
        notes: paymentForm.notes || undefined,
      });
      setPayment(res.data);
      setShowPaymentDialog(false);
    } catch (e) {
      setPaymentError(extractApiErrorMessage(e));
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleOpenInvoiceDialog = () => {
    setInvoiceForm({
      recipient_name: reservation?.guest_name ?? "",
      recipient_nif: "",
      recipient_address: reservation?.guest_address
        ? [
            reservation.guest_address,
            reservation.guest_postal_code,
            reservation.guest_city,
            reservation.guest_country,
          ]
            .filter(Boolean)
            .join(", ")
        : "",
      recipient_email: reservation?.guest_email ?? "",
    });
    setInvoiceError(null);
    setShowInvoiceDialog(true);
  };

  const handleGenerateInvoice = async () => {
    if (!reservation || !invoiceForm.recipient_name.trim()) {
      setInvoiceError("El nombre del receptor es obligatorio.");
      return;
    }
    setInvoiceSaving(true);
    setInvoiceError(null);
    try {
      const res = await billingApi.generateInvoice(reservation.id, {
        recipient_name: invoiceForm.recipient_name.trim(),
        recipient_nif: invoiceForm.recipient_nif || undefined,
        recipient_address: invoiceForm.recipient_address || undefined,
        recipient_email: invoiceForm.recipient_email || undefined,
      });
      setInvoice(res.data);
      setShowInvoiceDialog(false);
    } catch (e) {
      setInvoiceError(extractApiErrorMessage(e));
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!reservation) return;
    setIsSavingNotes(true);
    try {
      const response = await reservationsApi.update(reservationId, {
        internal_notes: notes || null,
      });
      setReservation(response.data);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      // No necesita mensaje de error — el usuario puede reintentar
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveGuest = async (values: GuestFormValues) => {
    if (!reservation) return;
    setIsSavingGuest(true);
    setGuestSaveError(null);
    try {
      const response = await reservationsApi.update(reservationId, {
        guest_name: values.guest_name,
        guest_email: values.guest_email,
        guest_phone: values.guest_phone || null,
        guest_id_type: values.guest_id_type || null,
        guest_id_number: values.guest_id_number || null,
        guest_address: values.guest_address || null,
        guest_postal_code: values.guest_postal_code || null,
        guest_city: values.guest_city || null,
        guest_region: values.guest_region || null,
        guest_country: values.guest_country || null,
        internal_notes: values.internal_notes || null,
      });
      setReservation(response.data);
      setNotes(response.data.internal_notes ?? "");
      setIsEditingGuest(false);
    } catch {
      setGuestSaveError("No se pudieron guardar los datos. Inténtalo de nuevo.");
    } finally {
      setIsSavingGuest(false);
    }
  };

  const handleStatusChange = async (targetStatus: ReservationStatus) => {
    if (!reservation) return;
    setIsChangingStatus(true);
    setStatusError(null);
    try {
      const response = await reservationsApi.updateStatus(reservationId, {
        status: targetStatus,
      });
      setReservation(response.data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: { error?: { message?: string } } | string } };
      };
      const detail = axiosErr.response?.data?.detail;
      let msg = "No se pudo cambiar el estado.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail?.error?.message) {
        msg = detail.error.message;
      }
      setStatusError(msg);
    } finally {
      setIsChangingStatus(false);
    }
  };

  // ─── Renderizado de estado de carga ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (loadError || !reservation) {
    return (
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.push("/reservas")}
          className="mb-6 text-klyp-gray"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Volver a Reservas
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {loadError ?? "Reserva no encontrada."}
        </div>
      </div>
    );
  }

  const statusActions = getActionsForStatus(reservation.status, isAdmin);
  const canCancel = isAdmin && isCancellable(reservation.status);

  // Construir price preview a partir del snapshot de la reserva
  const priceSnapshotForBreakdown = {
    nights: reservation.nights,
    base_price: reservation.base_price,
    extras_price: reservation.extras_price,
    total_price: reservation.total_price,
    iva_breakdown: reservation.iva_amount && parseFloat(reservation.iva_amount) > 0
      ? [{ rate: "—", base_imponible: reservation.total_price, iva_amount: reservation.iva_amount }]
      : [],
    total_iva: reservation.iva_amount ?? "0",
    total_with_iva: reservation.total_with_iva ?? reservation.total_price,
    currency: reservation.currency,
    breakdown: [], // El snapshot no guarda el desglose por tramos
    applied_season: null,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/reservas")}
          className="text-klyp-gray hover:text-klyp-text-dark min-h-[44px]"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Reservas
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">
            {reservation.guest_name}
          </h1>
          <p className="mt-0.5 text-xs text-klyp-gray font-mono">
            {reservation.id}
          </p>
        </div>
        <ReservationStatusBadge
          status={reservation.status}
          className="self-start sm:self-auto"
        />
      </div>

      {/* Pestañas principales */}
      <Tabs defaultValue="detalle" onValueChange={(v) => { if (v === "historial") void loadHistory(); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="huespedes" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Huéspedes
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="acceso" className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detalle">

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda — datos y notas */}
        <div className="lg:col-span-2 space-y-5">
          {/* Datos de la estancia */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-klyp-navy">
                Datos de la estancia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Entrada
                  </dt>
                  <dd className="mt-0.5 font-medium text-klyp-text-dark">
                    {formatDate(reservation.check_in)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Salida
                  </dt>
                  <dd className="mt-0.5 font-medium text-klyp-text-dark">
                    {formatDate(reservation.check_out)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Noches
                  </dt>
                  <dd className="mt-0.5 font-medium text-klyp-text-dark">
                    {reservation.nights}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Personas
                  </dt>
                  <dd className="mt-0.5 font-medium text-klyp-text-dark">
                    {reservation.num_persons}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Creada
                  </dt>
                  <dd className="mt-0.5 text-klyp-text-dark">
                    {formatDateTime(reservation.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">
                    Actualizada
                  </dt>
                  <dd className="mt-0.5 text-klyp-text-dark">
                    {formatDateTime(reservation.updated_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Datos del huésped */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-klyp-navy">
                  Datos del huésped
                </CardTitle>
                {!isEditingGuest ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingGuest(true)}
                    className="h-8 px-2 text-klyp-accent hover:bg-klyp-accent/10"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setIsEditingGuest(false); setGuestSaveError(null); }}
                    className="h-8 px-2 text-klyp-gray hover:bg-klyp-pale"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingGuest ? (
                <div className="space-y-4">
                  <GuestForm
                    formId="guest-edit-form"
                    defaultValues={{
                      guest_name:        reservation.guest_name,
                      guest_email:       reservation.guest_email,
                      guest_phone:       reservation.guest_phone ?? "",
                      guest_id_type:     (reservation.guest_id_type ?? "") as GuestFormValues["guest_id_type"],
                      guest_id_number:   reservation.guest_id_number ?? "",
                      guest_address:     reservation.guest_address ?? "",
                      guest_postal_code: reservation.guest_postal_code ?? "",
                      guest_city:        reservation.guest_city ?? "",
                      guest_region:      reservation.guest_region ?? "",
                      guest_country:     reservation.guest_country ?? "España",
                      internal_notes:    reservation.internal_notes ?? "",
                    }}
                    onSubmit={(values) => void handleSaveGuest(values)}
                    isLoading={isSavingGuest}
                  />
                  {guestSaveError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{guestSaveError}</p>
                  )}
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      form="guest-edit-form"
                      disabled={isSavingGuest}
                      className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
                    >
                      {isSavingGuest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="mr-1.5 h-4 w-4" />
                          Guardar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {/* Contacto */}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Nombre</dt>
                    <dd className="mt-0.5 font-medium text-klyp-text-dark">{reservation.guest_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Email</dt>
                    <dd className="mt-0.5">
                      <a href={`mailto:${reservation.guest_email}`} className="text-klyp-accent hover:underline">
                        {reservation.guest_email}
                      </a>
                    </dd>
                  </div>
                  {reservation.guest_phone && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Teléfono</dt>
                      <dd className="mt-0.5">
                        <a href={`tel:${reservation.guest_phone}`} className="text-klyp-accent hover:underline">
                          {reservation.guest_phone}
                        </a>
                      </dd>
                    </div>
                  )}

                  {/* Documento */}
                  {(reservation.guest_id_type || reservation.guest_id_number) && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Documento</dt>
                      <dd className="mt-0.5 text-klyp-text-dark">
                        {reservation.guest_id_type && (
                          <span className="uppercase text-xs font-semibold text-klyp-gray mr-1.5">
                            {reservation.guest_id_type === "passport" ? "Pasaporte" : reservation.guest_id_type.toUpperCase()}
                          </span>
                        )}
                        {reservation.guest_id_number}
                      </dd>
                    </div>
                  )}

                  {/* Dirección */}
                  {reservation.guest_address && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Dirección</dt>
                      <dd className="mt-0.5 text-klyp-text-dark">
                        {reservation.guest_address}
                        {(reservation.guest_postal_code || reservation.guest_city) && (
                          <span className="block text-klyp-gray text-xs mt-0.5">
                            {[reservation.guest_postal_code, reservation.guest_city, reservation.guest_region, reservation.guest_country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {!reservation.guest_address && (reservation.guest_city || reservation.guest_country) && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-klyp-gray">Localidad</dt>
                      <dd className="mt-0.5 text-klyp-text-dark">
                        {[reservation.guest_postal_code, reservation.guest_city, reservation.guest_region, reservation.guest_country]
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Notas internas */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-klyp-navy">
                Notas internas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="internal-notes" className="sr-only">
                Notas internas
              </Label>
              <Textarea
                id="internal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas visibles solo para el equipo..."
                rows={4}
                disabled={isSavingNotes}
              />
              <div className="flex items-center justify-between">
                {notesSaved && (
                  <span className="text-xs text-green-600">Guardado</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSaveNotes()}
                  disabled={isSavingNotes}
                  className="ml-auto border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 min-h-[44px]"
                >
                  {isSavingNotes ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" />
                      Guardar notas
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha — precio y acciones */}
        <div className="space-y-5">
          {/* Desglose de precio */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-klyp-navy">
                Precio de la reserva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PriceBreakdown
                result={priceSnapshotForBreakdown}
                showBreakdown={false}
              />
            </CardContent>
          </Card>

          {/* ── Card Pago ─────────────────────────────────────────────── */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-klyp-navy flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pago
                </CardTitle>
                {!payment && !paymentLoading && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10"
                    onClick={() => void handleOpenPaymentDialog()}
                  >
                    Registrar pago
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {paymentLoading ? (
                <Skeleton className="h-12 w-full rounded" />
              ) : payment ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <dt className="text-klyp-gray">Método</dt>
                    <dd className="font-medium text-klyp-navy">{payment.payment_method_name}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-klyp-gray">Importe</dt>
                    <dd className="font-semibold text-klyp-navy">
                      {parseFloat(payment.amount).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </dd>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between items-center">
                      <dt className="text-klyp-gray">Fecha</dt>
                      <dd className="text-klyp-text-dark text-xs">
                        {new Date(payment.paid_at).toLocaleString("es-ES", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <dt className="text-klyp-gray">Estado</dt>
                    <dd>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[payment.status]}`}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-klyp-gray text-center py-2">
                  Sin registro de pago
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Card Factura ───────────────────────────────────────────── */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-klyp-navy flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Factura
                </CardTitle>
                {!invoice && !invoiceLoading && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10"
                    onClick={handleOpenInvoiceDialog}
                  >
                    Emitir factura
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {invoiceLoading ? (
                <Skeleton className="h-24 w-full rounded" />
              ) : invoice ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-klyp-navy font-mono">
                      {invoice.invoice_number}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </span>
                  </div>
                  <p className="text-xs text-klyp-gray">
                    Emitida el{" "}
                    {new Date(invoice.issued_at).toLocaleDateString("es-ES", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    })}
                  </p>
                  <p className="text-sm font-medium text-klyp-text-dark">
                    {invoice.recipient_name}
                    {invoice.recipient_nif && (
                      <span className="ml-1 text-xs text-klyp-gray">({invoice.recipient_nif})</span>
                    )}
                  </p>
                  {/* Desglose de líneas */}
                  {invoice.lines.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1 text-klyp-gray font-medium">Concepto</th>
                            <th className="text-right py-1 text-klyp-gray font-medium">Base</th>
                            <th className="text-right py-1 text-klyp-gray font-medium">IVA</th>
                            <th className="text-right py-1 text-klyp-gray font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.lines.map((line, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-1 text-klyp-text-dark">{line.description}</td>
                              <td className="py-1 text-right text-klyp-text-dark">
                                {parseFloat(line.line_total_net).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                              </td>
                              <td className="py-1 text-right text-klyp-gray">
                                {line.iva_rate}%
                              </td>
                              <td className="py-1 text-right font-medium text-klyp-navy">
                                {parseFloat(line.line_total_with_iva).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200">
                            <td colSpan={2} className="py-1 text-klyp-gray">Base imponible</td>
                            <td />
                            <td className="py-1 text-right font-medium">
                              {parseFloat(invoice.base_imponible).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="py-1 text-klyp-gray">IVA</td>
                            <td />
                            <td className="py-1 text-right font-medium">
                              {parseFloat(invoice.total_iva).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="py-1.5 font-semibold text-klyp-navy">Total con IVA</td>
                            <td />
                            <td className="py-1.5 text-right font-bold text-klyp-navy">
                              {parseFloat(invoice.total_with_iva).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-klyp-gray text-center py-2">
                  Sin factura emitida
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Dialogo: Registrar Pago ────────────────────────────────── */}
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-klyp-navy">Registrar pago</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Método de pago *</Label>
                  {paymentMethods.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 rounded px-3 py-2">
                      No hay métodos de pago activos. Configúralos en Configuración → Métodos de Pago.
                    </p>
                  ) : (
                    <select
                      value={paymentForm.payment_method_id}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method_id: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notas <span className="text-klyp-gray font-normal">(opcional)</span></Label>
                  <Textarea
                    rows={2}
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Referencia, observaciones..."
                  />
                </div>
                {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={paymentSaving}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleCreatePayment()}
                  disabled={paymentSaving || paymentMethods.length === 0}
                  className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
                >
                  {paymentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar pago"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Dialogo: Emitir Factura ────────────────────────────────── */}
          <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-klyp-navy">Emitir factura</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                  La factura refleja el estado actual de la reserva incluyendo todos los extras añadidos durante la estancia.
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre / Razón social *</Label>
                  <Input
                    value={invoiceForm.recipient_name}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, recipient_name: e.target.value }))}
                    placeholder="Nombre completo o razón social"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF / CIF <span className="text-klyp-gray font-normal">(opcional)</span></Label>
                  <Input
                    value={invoiceForm.recipient_nif}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, recipient_nif: e.target.value }))}
                    placeholder="12345678A o B12345678"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección <span className="text-klyp-gray font-normal">(opcional)</span></Label>
                  <Input
                    value={invoiceForm.recipient_address}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, recipient_address: e.target.value }))}
                    placeholder="Calle, número, código postal, ciudad"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email <span className="text-klyp-gray font-normal">(para envío, no aparece en la factura)</span></Label>
                  <Input
                    type="email"
                    value={invoiceForm.recipient_email}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, recipient_email: e.target.value }))}
                    placeholder="cliente@ejemplo.com"
                  />
                </div>
                {invoiceError && <p className="text-sm text-red-600">{invoiceError}</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} disabled={invoiceSaving}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleGenerateInvoice()}
                  disabled={invoiceSaving}
                  className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
                >
                  {invoiceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Emitir factura"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Acciones de estado */}
          {(statusActions.length > 0 || canCancel) && (
            <Card className="border-klyp-pale">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-klyp-navy">
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statusActions.map((action) => (
                  <Button
                    key={action.targetStatus}
                    variant={action.variant}
                    onClick={() =>
                      void handleStatusChange(action.targetStatus)
                    }
                    disabled={isChangingStatus}
                    className={[
                      "w-full min-h-[44px]",
                      action.className ?? "",
                    ].join(" ")}
                  >
                    {isChangingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      action.label
                    )}
                  </Button>
                ))}

                {/* Botón de cancelación — abre diálogo con política y reembolso */}
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={isChangingStatus}
                    className="w-full min-h-[44px]"
                  >
                    Cancelar reserva
                  </Button>
                )}

                {statusError && (
                  <p className="text-xs text-red-600 mt-2">{statusError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Diálogo de cancelación con política de reembolso */}
          {showCancelDialog && reservation && (
            <CancelReservationDialog
              reservation={reservation}
              open={showCancelDialog}
              onOpenChange={setShowCancelDialog}
              onSuccess={(updated) => setReservation(updated)}
            />
          )}

          {/* Solicitar cambio — disponible para todos los roles */}
          <Card className="border-klyp-pale">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-klyp-navy">
                Solicitar cambio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-klyp-gray">
                {isAdmin
                  ? "Crea una solicitud formal de cambio que quedará registrada y aprobada automáticamente."
                  : "Los cambios de estado y precio deben ser aprobados por un administrador."}
              </p>
              <Button
                variant="outline"
                onClick={() => setShowRequestChange(true)}
                className="w-full min-h-[44px] border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10"
              >
                Solicitar cambio de estado o precio
              </Button>
            </CardContent>
          </Card>

          {/* Diálogo solicitud de cambio */}
          {reservation && (
            <RequestChangeDialog
              open={showRequestChange}
              onOpenChange={setShowRequestChange}
              reservationId={reservation.id}
              currentStatus={reservation.status}
              currentPrice={parseFloat(reservation.total_price)}
              onSuccess={() => void fetchReservation()}
            />
          )}

          {/* Identificadores técnicos */}
          <Card className="border-klyp-pale bg-klyp-pale/20">
            <CardContent className="pt-4 space-y-2 text-xs text-klyp-gray font-mono">
              <div>
                <span className="font-sans text-xs font-medium text-klyp-gray uppercase tracking-wide block mb-0.5">
                  ID Reserva
                </span>
                {reservation.id}
              </div>
              <div>
                <span className="font-sans text-xs font-medium text-klyp-gray uppercase tracking-wide block mb-0.5">
                  ID Unidad
                </span>
                {reservation.unit_id}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        </TabsContent>

        {/* ── Pestaña Huéspedes ── */}
        <TabsContent value="huespedes">
          <GuestDocsTab reservation={reservation} />
        </TabsContent>

        {/* ── Pestaña Historial ── */}
        <TabsContent value="historial">
          <ReservationHistoryTab
            history={history}
            loading={historyLoading}
          />
        </TabsContent>

        {/* ── Pestaña Acceso ── */}
        <TabsContent value="acceso">
          <VehiclesAndAccessTab
            reservationId={reservation.id}
            numPersons={reservation.num_persons}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ─── Componente de historial ──────────────────────────────────────────────────

const _DEFAULT_ACTION_STYLE = { icon: <span className="text-base">●</span>, color: "bg-gray-100 text-gray-600 border-gray-200" };

const ACTION_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  created:        { icon: <span className="text-base">✦</span>, color: "bg-green-100 text-green-700 border-green-200" },
  status_changed: { icon: <span className="text-base">⇄</span>, color: "bg-blue-100 text-blue-700 border-blue-200" },
  guest_updated:  { icon: <span className="text-base">✎</span>, color: "bg-amber-100 text-amber-700 border-amber-200" },
  notes_updated:  { icon: <span className="text-base">📝</span>, color: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled:      { icon: <span className="text-base">✕</span>, color: "bg-red-100 text-red-700 border-red-200" },
};

const ROLE_BADGE: Record<string, string> = {
  company_admin: "Admin Empresa",
  reception:     "Gestión",
  super_admin:   "Superadmin",
};

function ReservationHistoryTab({ history, loading }: {
  history: ReservationHistoryEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3 max-w-2xl">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-14 text-klyp-gray">
        <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hay eventos registrados para esta reserva.</p>
        <p className="text-xs mt-1 text-klyp-gray/70">Los cambios futuros aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="relative">
        {/* Línea vertical de tiempo */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

        <ol className="space-y-0">
          {history.map((entry, idx) => {
            const style = ACTION_ICONS[entry.action] ?? _DEFAULT_ACTION_STYLE;
            const date = new Date(entry.created_at);
            const dateStr = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

            return (
              <li key={entry.id} className={`relative flex gap-4 pb-6 ${idx === history.length - 1 ? "pb-0" : ""}`}>
                {/* Icono del evento */}
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${style.color}`}>
                  {style.icon}
                </div>

                {/* Contenido */}
                <div className="flex-1 pt-1.5 min-w-0">
                  <p className="text-sm font-medium text-klyp-navy leading-snug">{entry.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="flex items-center gap-1 text-xs text-klyp-gray">
                      <User className="h-3 w-3" />
                      {entry.user_name}
                      <span className="text-klyp-gray/60">({ROLE_BADGE[entry.user_role] ?? entry.user_role})</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-klyp-gray">
                      <Clock className="h-3 w-3" />
                      {dateStr} a las {timeStr}
                    </span>
                  </div>
                  {/* Detalles del cambio */}
                  {entry.changes && entry.action === "guest_updated" && Array.isArray(entry.changes["fields"]) && (
                    <p className="text-xs text-klyp-gray/80 mt-1">
                      Campos: {(entry.changes["fields"] as string[]).join(", ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
