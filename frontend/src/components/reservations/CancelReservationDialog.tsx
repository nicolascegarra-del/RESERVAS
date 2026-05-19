"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { reservationsApi } from "@/lib/api";
import type { Reservation, RefundPreview } from "@/types";
import { REFUND_TRAMO_LABELS } from "@/types";

interface CancelReservationDialogProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedReservation: Reservation) => void;
}

export function CancelReservationDialog({
  reservation,
  open,
  onOpenChange,
  onSuccess,
}: CancelReservationDialogProps) {
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await reservationsApi.getRefundPreview(reservation.id);
      setPreview(res.data);
    } catch {
      setError("No se pudo calcular el reembolso. Inténtalo de nuevo.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Cargar el preview al abrir el diálogo
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !preview) {
      loadPreview();
    }
    if (!isOpen) {
      setPreview(null);
      setReason("");
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await reservationsApi.cancel(reservation.id, {
        cancellation_reason: reason.trim() || null,
      });
      onSuccess(res.data.reservation);
      onOpenChange(false);
    } catch {
      setError("Error al cancelar la reserva. Inténtalo de nuevo.");
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
      parseFloat(amount),
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            Cancelar reserva
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Datos de la reserva */}
          <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
            <p>
              <span className="text-gray-500">Huésped:</span>{" "}
              <span className="font-medium">{reservation.guest_name}</span>
            </p>
            <p>
              <span className="text-gray-500">Estancia:</span>{" "}
              <span className="font-medium">
                {reservation.check_in} → {reservation.check_out} (
                {reservation.nights} noches)
              </span>
            </p>
            <p>
              <span className="text-gray-500">Total pagado:</span>{" "}
              <span className="font-medium">
                {formatCurrency(reservation.total_price)}
              </span>
            </p>
          </div>

          {/* Preview de reembolso */}
          {loadingPreview && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando reembolso...
            </div>
          )}

          {preview && !loadingPreview && (
            <div
              className={`rounded-lg border p-4 space-y-2 ${
                preview.tramo === "full"
                  ? "border-green-200 bg-green-50"
                  : preview.tramo === "partial"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <p className="text-sm font-semibold text-gray-700">
                Política de reembolso aplicable
              </p>
              {preview.policy_name ? (
                <p className="text-xs text-gray-500">
                  Política: <span className="font-medium">{preview.policy_name}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Sin política configurada — sin reembolso automático
                </p>
              )}
              <p className="text-xs text-gray-500">
                Días hasta check-in:{" "}
                <span className="font-medium">{preview.days_before_checkin}</span>
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`text-sm font-medium ${
                    preview.tramo === "full"
                      ? "text-green-700"
                      : preview.tramo === "partial"
                        ? "text-yellow-700"
                        : "text-red-700"
                  }`}
                >
                  {REFUND_TRAMO_LABELS[preview.tramo]} ({preview.refund_percentage}%)
                </span>
                <span
                  className={`text-lg font-bold ${
                    preview.tramo === "full"
                      ? "text-green-800"
                      : preview.tramo === "partial"
                        ? "text-yellow-800"
                        : "text-red-800"
                  }`}
                >
                  {formatCurrency(preview.refund_amount)}
                </span>
              </div>
              {preview.refund_percentage < 100 && (
                <p className="text-xs text-gray-500">
                  Retención:{" "}
                  {formatCurrency(
                    (
                      parseFloat(preview.total_paid) -
                      parseFloat(preview.refund_amount)
                    ).toFixed(2),
                  )}
                </p>
              )}
            </div>
          )}

          {/* Aviso si no hay reembolso */}
          {preview?.tramo === "none" && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <p className="text-sm text-orange-700">
                Se generará una orden de devolución por importe{" "}
                <strong>0 €</strong> para registro interno.
              </p>
            </div>
          )}

          {/* Motivo de cancelación */}
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo de cancelación (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ej: Cambio de planes, enfermedad..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={cancelling}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling || loadingPreview}
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Confirmar Cancelación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
