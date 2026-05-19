"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { guestsApi } from "@/lib/api";
import type { ReservationGuest } from "@/types";
import { GUEST_DOC_TYPE_LABELS } from "@/types";

interface QuickScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  guest: ReservationGuest;
  onUpdated: (guest: ReservationGuest) => void;
}

type Side = "front" | "back";

/**
 * Escáner rápido para recepción.
 *
 * Permite capturar el frontal o el reverso del documento con la cámara del
 * dispositivo (capture="environment"), lanza el OCR y muestra el formulario
 * editable con los datos extraídos para confirmarlos.
 */
export function QuickScanDialog({
  open,
  onOpenChange,
  reservationId,
  guest,
  onUpdated,
}: QuickScanDialogProps) {
  const [side, setSide] = useState<Side>("back");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ReservationGuest>(guest);
  const [savingForm, setSavingForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await guestsApi.scan(
        reservationId,
        guest.id,
        side,
        selectedFile,
      );
      setCurrent(res.data);
      onUpdated(res.data);
    } catch {
      setError(
        "No se pudo procesar la imagen. Revisa que el documento se vea nítido e inténtalo de nuevo.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleFieldChange = (
    field: keyof ReservationGuest,
    value: string,
  ) => {
    setCurrent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveForm = async () => {
    setSavingForm(true);
    setError(null);
    try {
      const res = await guestsApi.update(reservationId, guest.id, {
        first_name: current.first_name || null,
        last_name: current.last_name || null,
        doc_type: current.doc_type || null,
        doc_number: current.doc_number || null,
        nationality: current.nationality || null,
        date_of_birth: current.date_of_birth || null,
        sex: current.sex || null,
        doc_expiry_date: current.doc_expiry_date || null,
        mark_manual: true,
      });
      onUpdated(res.data);
      onOpenChange(false);
    } catch {
      setError("No se pudieron guardar los datos. Inténtalo de nuevo.");
    } finally {
      setSavingForm(false);
    }
  };

  const isProcessing = current.ocr_status === "processing" || processing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-klyp-navy">
            <Camera className="h-5 w-5" />
            Escáner rápido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de lado */}
          <div className="space-y-1.5">
            <Label>¿Qué cara del documento vas a escanear?</Label>
            <div className="flex gap-2">
              {(["front", "back"] as Side[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors min-h-[44px] ${
                    side === s
                      ? "border-klyp-accent bg-klyp-accent/10 text-klyp-accent"
                      : "border-klyp-pale text-klyp-gray hover:border-klyp-accent/50"
                  }`}
                >
                  {s === "front" ? "Frontal" : "Reverso"}
                </button>
              ))}
            </div>
            <p className="text-xs text-klyp-gray">
              DNI/NIE: la zona legible está en el <strong>reverso</strong>.
              Pasaporte: en la <strong>página de datos</strong> (frontal).
            </p>
          </div>

          {/* Captura de imagen */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Vista previa del documento"
                  className="w-full rounded-lg border border-klyp-pale object-contain max-h-64"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 bg-white/90"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Cambiar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-klyp-pale py-10 text-klyp-gray hover:border-klyp-accent/60 hover:bg-klyp-pale/30"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm font-medium">
                  Tomar foto o seleccionar imagen
                </span>
              </button>
            )}

            {selectedFile && (
              <Button
                type="button"
                onClick={() => void handleProcess()}
                disabled={isProcessing}
                className="w-full bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Procesar documento"
                )}
              </Button>
            )}
          </div>

          {/* Formulario de datos extraídos */}
          <div className="space-y-3 rounded-lg border border-klyp-pale p-4">
            <p className="text-sm font-semibold text-klyp-navy">
              Datos del viajero
            </p>
            <p className="text-xs text-klyp-gray">
              Revisa y corrige los datos antes de confirmar. El sistema los
              pre-rellena automáticamente si pudo leer el documento.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={current.first_name ?? ""}
                  onChange={(e) =>
                    handleFieldChange("first_name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Apellidos</Label>
                <Input
                  value={current.last_name ?? ""}
                  onChange={(e) =>
                    handleFieldChange("last_name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de documento</Label>
                <select
                  value={current.doc_type ?? ""}
                  onChange={(e) =>
                    handleFieldChange("doc_type", e.target.value)
                  }
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
                  value={current.doc_number ?? ""}
                  onChange={(e) =>
                    handleFieldChange("doc_number", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nacionalidad (ISO-3)</Label>
                <Input
                  value={current.nationality ?? ""}
                  maxLength={3}
                  placeholder="ESP"
                  onChange={(e) =>
                    handleFieldChange(
                      "nationality",
                      e.target.value.toUpperCase(),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={current.date_of_birth ?? ""}
                  onChange={(e) =>
                    handleFieldChange("date_of_birth", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sexo</Label>
                <select
                  value={current.sex ?? ""}
                  onChange={(e) => handleFieldChange("sex", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Caducidad del documento</Label>
                <Input
                  type="date"
                  value={current.doc_expiry_date ?? ""}
                  onChange={(e) =>
                    handleFieldChange("doc_expiry_date", e.target.value)
                  }
                />
              </div>
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
              disabled={savingForm}
            >
              Cerrar
            </Button>
            <Button
              className="flex-1 bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
              onClick={() => void handleSaveForm()}
              disabled={savingForm}
            >
              {savingForm ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirmar datos"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
