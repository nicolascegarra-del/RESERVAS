"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  Download,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuickScanDialog } from "./QuickScanDialog";
import { guestsApi } from "@/lib/api";
import type { Reservation, ReservationGuest } from "@/types";
import { DOC_STATUS_COLORS, DOC_STATUS_LABELS, GUEST_DOC_TYPE_LABELS } from "@/types";

interface GuestDocsTabProps {
  reservation: Reservation;
}

const EMAIL_STATUS_MESSAGE: Record<string, string> = {
  sent: "Enlace enviado al email del huésped.",
  failed: "El enlace se generó pero el email no pudo enviarse. Cópialo manualmente.",
  no_smtp: "No hay SMTP configurado. Copia el enlace y envíalo manualmente.",
  disabled:
    "La notificación de documentos está desactivada. El enlace se generó igualmente.",
};

export function GuestDocsTab({ reservation }: GuestDocsTabProps) {
  const [guests, setGuests] = useState<ReservationGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sendingLink, setSendingLink] = useState(false);
  const [linkResult, setLinkResult] = useState<{
    url: string;
    message: string;
  } | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [scanGuest, setScanGuest] = useState<ReservationGuest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await guestsApi.list(reservation.id);
      setGuests(res.data);
    } catch {
      setLoadError("No se pudieron cargar los viajeros. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [reservation.id]);

  useEffect(() => {
    void fetchGuests();
  }, [fetchGuests]);

  const handleSendLink = async () => {
    setSendingLink(true);
    setLinkResult(null);
    try {
      const res = await guestsApi.sendDocsLink(reservation.id);
      setLinkResult({
        url: res.data.upload_url,
        message:
          EMAIL_STATUS_MESSAGE[res.data.email_status] ??
          "Enlace generado correctamente.",
      });
    } catch {
      setLinkResult({
        url: "",
        message: "No se pudo generar el enlace. Inténtalo de nuevo.",
      });
    } finally {
      setSendingLink(false);
    }
  };

  const handleExportSes = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await guestsApi.sesExport(reservation.id);
      const blob = new Blob([res.data as BlobPart], {
        type: "application/xml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parte_ses_${reservation.id.slice(0, 8)}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(
        "No se pudo exportar el parte SES. Asegúrate de que hay viajeros registrados.",
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (guestId: string) => {
    setDeletingId(guestId);
    try {
      await guestsApi.remove(reservation.id, guestId);
      setGuests((prev) => prev.filter((g) => g.id !== guestId));
    } catch {
      // El usuario puede reintentar
    } finally {
      setDeletingId(null);
    }
  };

  const completed = guests.filter((g) => g.doc_status === "complete").length;

  return (
    <div className="space-y-5">
      {/* Resumen + acciones */}
      <Card className="border-klyp-pale">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-klyp-navy">
                Documentación de viajeros
              </p>
              <p className="text-xs text-klyp-gray mt-0.5">
                {completed} de {reservation.num_persons} viajeros completos ·{" "}
                {guests.length} registrado{guests.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSendLink()}
                disabled={sendingLink}
                className="border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 min-h-[44px]"
              >
                {sendingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="mr-1.5 h-4 w-4" />
                    Enviar enlace
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleExportSes()}
                disabled={exporting}
                className="border-klyp-navy text-klyp-navy hover:bg-klyp-navy/5 min-h-[44px]"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    Exportar SES
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAdd(true)}
                className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Añadir viajero
              </Button>
            </div>
          </div>

          {linkResult && (
            <div className="mt-4 rounded-md border border-klyp-pale bg-klyp-pale/30 px-3 py-2 text-sm">
              <p className="text-klyp-text-dark">{linkResult.message}</p>
              {linkResult.url && (
                <a
                  href={linkResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-xs text-klyp-accent hover:underline"
                >
                  {linkResult.url}
                </a>
              )}
            </div>
          )}
          {exportError && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              {exportError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lista de viajeros */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700 text-sm">
          {loadError}
        </div>
      ) : guests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-klyp-pale py-12 text-center text-klyp-gray">
          <p className="text-sm">Aún no hay viajeros registrados.</p>
          <p className="mt-1 text-xs">
            Envía el enlace al huésped o añade los viajeros manualmente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {guests.map((g) => (
            <Card key={g.id} className="border-klyp-pale">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-klyp-navy truncate">
                      {g.full_name ||
                        [g.first_name, g.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "Viajero sin nombre"}
                      {g.is_main && (
                        <span className="ml-2 text-xs text-klyp-gray">
                          (titular)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-klyp-gray mt-0.5">
                      {g.doc_type
                        ? (GUEST_DOC_TYPE_LABELS[g.doc_type] ?? g.doc_type)
                        : "Sin documento"}
                      {g.doc_number ? ` · ${g.doc_number}` : ""}
                    </p>
                  </div>
                  <Badge className={DOC_STATUS_COLORS[g.doc_status]}>
                    {DOC_STATUS_LABELS[g.doc_status]}
                  </Badge>
                </div>

                {g.ocr_status === "processing" && (
                  <p className="flex items-center gap-1.5 text-xs text-klyp-accent">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Procesando documento (OCR)...
                  </p>
                )}
                {g.ocr_status === "failed" && (
                  <p className="text-xs text-orange-600">
                    No se pudo leer el documento automáticamente. Edita los
                    datos manualmente.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScanGuest(g)}
                    className="border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 min-h-[44px]"
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    Escáner / Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(g.id)}
                    disabled={deletingId === g.id}
                    className="text-red-600 hover:bg-red-50 min-h-[44px]"
                  >
                    {deletingId === g.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo añadir viajero */}
      <AddGuestDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        reservationId={reservation.id}
        onCreated={(g) => {
          setGuests((prev) => [...prev, g]);
          setShowAdd(false);
        }}
      />

      {/* Escáner rápido */}
      {scanGuest && (
        <QuickScanDialog
          open={scanGuest !== null}
          onOpenChange={(o) => {
            if (!o) setScanGuest(null);
          }}
          reservationId={reservation.id}
          guest={scanGuest}
          onUpdated={(updated) => {
            setGuests((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            );
            setScanGuest(updated);
          }}
        />
      )}
    </div>
  );
}

// ─── Diálogo de alta manual ──────────────────────────────────────────────────

function AddGuestDialog({
  open,
  onOpenChange,
  reservationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reservationId: string;
  onCreated: (g: ReservationGuest) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setDocType("");
    setDocNumber("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      setError("Introduce al menos el nombre o los apellidos.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await guestsApi.create(reservationId, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        doc_type: docType || null,
        doc_number: docNumber.trim() || null,
      });
      onCreated(res.data);
      reset();
    } catch {
      setError("No se pudo crear el viajero. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-klyp-navy">
            <Plus className="h-5 w-5" />
            Añadir viajero
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Apellidos</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de documento</Label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecciona...</option>
                {Object.entries(GUEST_DOC_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nº de documento</Label>
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Crear viajero"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
