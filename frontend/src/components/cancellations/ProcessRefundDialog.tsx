"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { cancellationsApi } from "@/lib/api";
import type { RefundOrder } from "@/types";

interface ProcessRefundDialogProps {
  order: RefundOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: RefundOrder) => void;
}

export function ProcessRefundDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: ProcessRefundDialogProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(parseFloat(amount));

  const handleAction = async (action: "processed" | "rejected") => {
    setLoading(true);
    setError(null);
    try {
      const res = await cancellationsApi.processRefundOrder(order.id, {
        status: action,
        notes: notes.trim() || null,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch {
      setError("Error al procesar la orden. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">
            Gestionar devolución
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumen de la orden */}
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total pagado</span>
              <span className="font-medium">{formatCurrency(order.total_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Importe a devolver</span>
              <span className="font-bold text-klyp-navy">
                {formatCurrency(order.refund_amount)} ({order.refund_percentage}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Días antes del check-in</span>
              <span>{order.days_before_checkin}d</span>
            </div>
            {order.cancellation_reason && (
              <div>
                <span className="text-gray-500">Motivo: </span>
                <span className="italic">{order.cancellation_reason}</span>
              </div>
            )}
          </div>

          {/* Notas del administrador */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas de gestión (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Referencia de transferencia, fecha de reembolso..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleAction("rejected")}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Rechazar Devolución"
            )}
          </Button>
          <Button
            onClick={() => void handleAction("processed")}
            disabled={loading}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Marcar Como Devuelta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
