"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { changeRequestsApi, type ChangeRequest } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  status_change: "Cambio de estado",
  price_change: "Ajuste de precio",
};

const STATUS_DISPLAY: Record<string, string> = {
  confirmed: "Confirmada",
  checked_in: "Check-in realizado",
  checked_out: "Check-out realizado",
  cancelled: "Cancelada",
  no_show: "No show",
  pending_payment: "Pago pendiente",
};

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

interface ReviewDialogProps {
  request: ChangeRequest;
  action: "approve" | "reject";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

function ReviewDialog({ request, action, open, onOpenChange, onDone }: ReviewDialogProps) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (action === "approve") {
        await changeRequestsApi.approve(request.id, comment || undefined);
      } else {
        await changeRequestsApi.reject(request.id, comment || undefined);
      }
      onDone();
      onOpenChange(false);
      setComment("");
    } catch {
      setError("No se pudo procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">
            {action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumen de la solicitud */}
          <div className="rounded-md bg-klyp-pale/60 border border-klyp-pale px-3 py-2 text-sm space-y-1">
            <p>
              <span className="text-klyp-gray">Solicitante:</span>{" "}
              <strong>{request.requested_by_name}</strong>
            </p>
            <p>
              <span className="text-klyp-gray">Tipo:</span>{" "}
              {STATUS_LABELS[request.type] ?? request.type}
            </p>
            {request.requested_status && (
              <p>
                <span className="text-klyp-gray">Nuevo estado:</span>{" "}
                {STATUS_DISPLAY[request.requested_status] ?? request.requested_status}
              </p>
            )}
            {request.requested_price !== null && request.requested_price !== undefined && (
              <p>
                <span className="text-klyp-gray">Nuevo precio:</span>{" "}
                {request.requested_price.toFixed(2)} €
              </p>
            )}
            <p>
              <span className="text-klyp-gray">Motivo:</span>{" "}
              {request.comment}
            </p>
          </div>

          {/* Comentario opcional */}
          <div className="space-y-1.5">
            <Label>Comentario de revisión (opcional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Añade un comentario para el recepcionista..."
              rows={3}
              maxLength={1000}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              className={[
                "flex-1 text-white",
                action === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700",
              ].join(" ")}
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : action === "approve" ? (
                "Aprobar"
              ) : (
                "Rechazar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SolicitudesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);

  const [reviewTarget, setReviewTarget] = useState<ChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await changeRequestsApi.list(pendingOnly);
      setRequests(resp.data);
    } catch {
      setError("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/reservas");
      return;
    }
    void fetchRequests();
  }, [isAdmin, fetchRequests, router]);

  const openReview = (req: ChangeRequest, action: "approve" | "reject") => {
    setReviewTarget(req);
    setReviewAction(action);
    setReviewOpen(true);
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    const labels: Record<string, string> = {
      pending: "Pendiente",
      approved: "Aprobada",
      rejected: "Rechazada",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">
            Solicitudes de cambio
          </h1>
          <p className="text-sm text-klyp-gray mt-0.5">
            Gestiona las solicitudes enviadas por recepción
          </p>
        </div>

        {/* Filtro pendientes / todas */}
        <div className="flex items-center gap-1 rounded-lg bg-klyp-pale p-1 self-start sm:self-auto">
          <button
            onClick={() => setPendingOnly(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pendingOnly
                ? "bg-white shadow-sm text-klyp-navy"
                : "text-klyp-gray hover:text-klyp-navy"
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setPendingOnly(false)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !pendingOnly
                ? "bg-white shadow-sm text-klyp-navy"
                : "text-klyp-gray hover:text-klyp-navy"
            }`}
          >
            Todas
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-klyp-accent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="rounded-lg border border-klyp-pale bg-klyp-pale/30 px-4 py-12 text-center text-klyp-gray">
          No hay solicitudes {pendingOnly ? "pendientes" : ""}.
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="border-klyp-pale">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-klyp-navy">
                      {STATUS_LABELS[req.type] ?? req.type}
                    </CardTitle>
                    <p className="text-xs text-klyp-gray mt-0.5">
                      Solicitado por <strong>{req.requested_by_name}</strong> ·{" "}
                      {formatDateTime(req.created_at)}
                    </p>
                  </div>
                  {statusBadge(req.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {req.requested_status && (
                    <div>
                      <span className="text-xs text-klyp-gray uppercase tracking-wide font-medium">
                        Estado solicitado
                      </span>
                      <p className="font-medium text-klyp-text-dark">
                        {STATUS_DISPLAY[req.requested_status] ?? req.requested_status}
                      </p>
                    </div>
                  )}
                  {req.requested_price !== null && req.requested_price !== undefined && (
                    <div>
                      <span className="text-xs text-klyp-gray uppercase tracking-wide font-medium">
                        Precio solicitado
                      </span>
                      <p className="font-medium text-klyp-text-dark">
                        {req.requested_price.toFixed(2)} €
                      </p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-xs text-klyp-gray uppercase tracking-wide font-medium">
                      Motivo
                    </span>
                    <p className="text-klyp-text-dark">{req.comment}</p>
                  </div>
                  <div>
                    <span className="text-xs text-klyp-gray uppercase tracking-wide font-medium">
                      ID Reserva
                    </span>
                    <p
                      className="font-mono text-xs text-klyp-accent cursor-pointer hover:underline"
                      onClick={() => router.push(`/reservas/${req.reservation_id}`)}
                    >
                      {req.reservation_id.slice(0, 8)}…
                    </p>
                  </div>
                </div>

                {/* Información de revisión si ya fue procesada */}
                {req.status !== "pending" && req.reviewed_by_name && (
                  <div className="rounded-md bg-klyp-pale/50 border border-klyp-pale px-3 py-2 text-xs space-y-0.5">
                    <p className="text-klyp-gray">
                      Revisada por <strong>{req.reviewed_by_name}</strong>
                      {req.reviewed_at ? ` · ${formatDateTime(req.reviewed_at)}` : ""}
                    </p>
                    {req.review_comment && (
                      <p className="text-klyp-text-dark">{req.review_comment}</p>
                    )}
                  </div>
                )}

                {/* Botones de acción — solo para pendientes */}
                {req.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openReview(req, "reject")}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 min-h-[40px]"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openReview(req, "approve")}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[40px]"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aprobar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de revisión */}
      {reviewTarget && (
        <ReviewDialog
          request={reviewTarget}
          action={reviewAction}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onDone={() => void fetchRequests()}
        />
      )}
    </div>
  );
}
