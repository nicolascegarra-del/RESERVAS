"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { changeRequestsApi, type ChangeRequestType } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmada" },
  { value: "checked_in", label: "Check-in realizado" },
  { value: "checked_out", label: "Check-out realizado" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No show" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reservationId: string;
  currentStatus: string;
  currentPrice: number;
  onSuccess: () => void;
}

export function RequestChangeDialog({
  open,
  onOpenChange,
  reservationId,
  currentStatus,
  currentPrice,
  onSuccess,
}: Props) {
  const [type, setType] = useState<ChangeRequestType>("status_change");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [requestedPrice, setRequestedPrice] = useState(currentPrice.toString());
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!comment.trim() || comment.length < 5) {
      setError("El comentario es obligatorio (mínimo 5 caracteres).");
      return;
    }
    if (type === "status_change" && !requestedStatus) {
      setError("Selecciona el estado solicitado.");
      return;
    }
    if (type === "price_change" && (!requestedPrice || isNaN(parseFloat(requestedPrice)))) {
      setError("Introduce un precio válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changeRequestsApi.create({
        reservation_id: reservationId,
        type,
        requested_status: type === "status_change" ? requestedStatus : null,
        requested_price: type === "price_change" ? parseFloat(requestedPrice) : null,
        comment: comment.trim(),
      });
      onSuccess();
      onOpenChange(false);
      setComment("");
      setRequestedStatus("");
    } catch {
      setError("No se pudo enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">Solicitar cambio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de cambio</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setType("status_change")}
                className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                  type === "status_change"
                    ? "border-klyp-accent bg-klyp-accent/10 text-klyp-accent"
                    : "border-klyp-pale text-klyp-gray hover:border-klyp-accent/50"
                }`}
              >
                Cambio de Estado
              </button>
              <button
                onClick={() => setType("price_change")}
                className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                  type === "price_change"
                    ? "border-klyp-accent bg-klyp-accent/10 text-klyp-accent"
                    : "border-klyp-pale text-klyp-gray hover:border-klyp-accent/50"
                }`}
              >
                Ajuste de Precio
              </button>
            </div>
          </div>

          {/* Valor según tipo */}
          {type === "status_change" ? (
            <div className="space-y-1.5">
              <Label>Estado solicitado</Label>
              <p className="text-xs text-klyp-gray">Estado actual: <strong>{currentStatus}</strong></p>
              <select
                value={requestedStatus}
                onChange={(e) => setRequestedStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecciona un estado...</option>
                {STATUS_OPTIONS.filter((o) => o.value !== currentStatus).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Precio solicitado (€)</Label>
              <p className="text-xs text-klyp-gray">Precio actual: <strong>{currentPrice.toFixed(2)} €</strong></p>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={requestedPrice}
                onChange={(e) => setRequestedPrice(e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          {/* Comentario obligatorio */}
          <div className="space-y-1.5">
            <Label>Motivo / comentario <span className="text-red-500">*</span></Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explica brevemente el motivo del cambio..."
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-klyp-gray text-right">{comment.length}/1000</p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-klyp-accent hover:bg-klyp-accent/90 text-white"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Solicitud"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
