"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UserPlus,
  XCircle,
} from "lucide-react";
import {
  guestUploadApi,
  type PublicGuest,
  type PublicGuestUploadInfo,
} from "@/lib/publicApi";

const DOC_TYPE_OPTIONS = [
  { value: "dni", label: "DNI español" },
  { value: "nie", label: "NIE" },
  { value: "passport", label: "Pasaporte" },
];

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Screen = "loading" | "error" | "list" | "form" | "success";

export default function GuestUploadPage() {
  const { token } = useParams<{ token: string }>();

  const [screen, setScreen] = useState<Screen>("loading");
  const [info, setInfo] = useState<PublicGuestUploadInfo | null>(null);
  const [guests, setGuests] = useState<PublicGuest[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeGuest, setActiveGuest] = useState<PublicGuest | null>(null);

  const accent = info?.accent_color || "#2E6DB4";
  const primary = info?.primary_color || "#051937";

  const loadAll = useCallback(async () => {
    try {
      const [infoRes, guestsRes] = await Promise.all([
        guestUploadApi.getInfo(token),
        guestUploadApi.listGuests(token),
      ]);
      setInfo(infoRes.data);
      setGuests(guestsRes.data);
      setScreen("list");
    } catch {
      setErrorMsg("El enlace no es válido o ha caducado.");
      setScreen("error");
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshGuests = useCallback(async () => {
    try {
      const res = await guestUploadApi.listGuests(token);
      setGuests(res.data);
    } catch {
      // silencioso — el usuario puede reintentar
    }
  }, [token]);

  // ─── Pantalla de carga ──────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </main>
    );
  }

  if (screen === "error" || !info) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 text-center shadow-lg">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="text-xl font-bold text-slate-800">Enlace no válido</h1>
          <p className="text-slate-500">
            {errorMsg ?? "No se pudo cargar la información."}
          </p>
        </div>
      </main>
    );
  }

  const allComplete =
    guests.length >= info.num_persons &&
    guests.filter((g) => g.doc_status === "complete").length >=
      info.num_persons;

  // ─── Pantalla de éxito ──────────────────────────────────────────────────────
  if (screen === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 text-center shadow-lg">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="text-2xl font-bold" style={{ color: primary }}>
            ¡Todo listo!
          </h1>
          <p className="text-slate-600">
            Hemos recibido la documentación de todos los viajeros. Tu check-in
            en <strong>{info.brand_name}</strong> será mucho más rápido.
          </p>
          <div className="rounded-lg bg-slate-50 p-4 text-left text-sm">
            <p>
              <span className="text-slate-500">Entrada: </span>
              <strong>{formatDate(info.check_in)}</strong>
            </p>
            <p className="mt-1">
              <span className="text-slate-500">Viajeros: </span>
              <strong>{info.num_persons}</strong>
            </p>
          </div>
          <button
            onClick={() => setScreen("list")}
            className="text-sm font-medium hover:underline"
            style={{ color: accent }}
          >
            Volver a la lista de viajeros
          </button>
        </div>
      </main>
    );
  }

  // ─── Pantalla de formulario de un viajero ───────────────────────────────────
  if (screen === "form" && activeGuest) {
    return (
      <GuestFormScreen
        token={token}
        guest={activeGuest}
        accent={accent}
        primary={primary}
        onBack={() => {
          void refreshGuests();
          setActiveGuest(null);
          setScreen("list");
        }}
        onConfirmed={() => {
          void refreshGuests();
          setActiveGuest(null);
          setScreen("list");
        }}
      />
    );
  }

  // ─── Pantalla principal: lista de viajeros ──────────────────────────────────
  const slots = Array.from({ length: info.num_persons });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Cabecera con branding */}
        <div className="text-center">
          {info.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                info.logo_url.startsWith("http")
                  ? info.logo_url
                  : `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000"}${info.logo_url}`
              }
              alt={info.brand_name}
              className="mx-auto mb-3 h-14 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold" style={{ color: primary }}>
            {info.brand_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Documentación de viajeros
          </p>
        </div>

        {/* Resumen de la reserva */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            Hola <strong>{info.guest_name}</strong>, para agilizar tu check-in
            en <strong>{info.accommodation_name}</strong> necesitamos los datos
            de identificación de todos los viajeros.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-slate-500">Entrada</span>
            <span className="font-medium">{formatDate(info.check_in)}</span>
            <span className="text-slate-500">Salida</span>
            <span className="font-medium">{formatDate(info.check_out)}</span>
            <span className="text-slate-500">Viajeros</span>
            <span className="font-medium">{info.num_persons}</span>
          </div>
        </div>

        {/* Lista de viajeros / slots */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Viajeros ({guests.filter((g) => g.doc_status === "complete").length}
            /{info.num_persons} completos)
          </h2>

          {guests.map((g, idx) => (
            <button
              key={g.id}
              onClick={() => {
                setActiveGuest(g);
                setScreen("form");
              }}
              className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">
                  {g.full_name ||
                    [g.first_name, g.last_name].filter(Boolean).join(" ") ||
                    `Viajero ${idx + 1}`}
                </p>
                <p className="text-xs text-slate-500">
                  {g.doc_status === "complete"
                    ? "Datos completos"
                    : g.doc_status === "partial"
                      ? "Datos incompletos — toca para continuar"
                      : "Pendiente — toca para añadir documentos"}
                </p>
              </div>
              <StatusDot status={g.doc_status} />
            </button>
          ))}

          {/* Slots vacíos para alcanzar num_persons */}
          {slots.slice(guests.length).map((_, i) => (
            <button
              key={`slot-${i}`}
              onClick={async () => {
                try {
                  const res = await guestUploadApi.createGuest(token, {
                    is_main: guests.length === 0,
                  });
                  setGuests((prev) => [...prev, res.data]);
                  setActiveGuest(res.data);
                  setScreen("form");
                } catch {
                  setErrorMsg(
                    "No se pudo añadir el viajero. Inténtalo de nuevo.",
                  );
                }
              }}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-left text-slate-500 hover:border-slate-400"
            >
              <UserPlus className="h-5 w-5" />
              <span className="text-sm font-medium">
                Añadir viajero {guests.length + i + 1}
              </span>
            </button>
          ))}
        </div>

        {allComplete && (
          <button
            onClick={() => setScreen("success")}
            className="min-h-[48px] w-full rounded-lg font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            ✓ Finalizar
          </button>
        )}

        <p className="pb-4 text-center text-xs text-slate-400">
          Puedes hacerlo desde tu móvil con la cámara. Tus datos se tratan de
          forma confidencial.
        </p>
      </div>
    </main>
  );
}

// ─── Indicador de estado ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: PublicGuest["doc_status"] }) {
  const map: Record<PublicGuest["doc_status"], string> = {
    none: "bg-red-400",
    partial: "bg-amber-400",
    complete: "bg-emerald-500",
  };
  return (
    <span
      className={`ml-3 h-3 w-3 shrink-0 rounded-full ${map[status]}`}
      aria-label={status}
    />
  );
}

// ─── Formulario por viajero ───────────────────────────────────────────────────

function GuestFormScreen({
  token,
  guest,
  accent,
  primary,
  onBack,
  onConfirmed,
}: {
  token: string;
  guest: PublicGuest;
  accent: string;
  primary: string;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [current, setCurrent] = useState<PublicGuest>(guest);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasaporte → frontal (página de datos). DNI/NIE → reverso (MRZ).
  const side: "front" | "back" =
    current.doc_type === "passport" ? "front" : "back";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const res = await guestUploadApi.uploadSide(
        token,
        current.id,
        side,
        file,
      );
      setCurrent(res.data);
    } catch {
      setError(
        "No se pudo subir la imagen. Comprueba tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setUploading(false);
    }
  };

  const setField = (field: keyof PublicGuest, value: string) =>
    setCurrent((prev) => ({ ...prev, [field]: value }));

  const handleConfirm = async () => {
    if (!current.first_name?.trim() && !current.last_name?.trim()) {
      setError("Introduce al menos el nombre y los apellidos.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await guestUploadApi.updateGuest(token, current.id, {
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
      onConfirmed();
    } catch {
      setError("No se pudieron guardar los datos. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const isProcessing =
    uploading || current.ocr_status === "processing";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <h1 className="text-xl font-bold" style={{ color: primary }}>
          Datos del viajero
        </h1>

        {/* Paso 1: tipo de documento */}
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-slate-700">
            Tipo de documento
          </label>
          <select
            value={current.doc_type ?? ""}
            onChange={(e) => setField("doc_type", e.target.value)}
            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {DOC_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Paso 2: captura del documento */}
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            {side === "back"
              ? "Sube el REVERSO del DNI/NIE"
              : "Sube la PÁGINA DE DATOS del pasaporte"}
          </p>
          <p className="text-xs text-slate-500">
            Lo leeremos automáticamente para rellenar tus datos. Asegúrate de
            que se vea nítido y completo.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Documento"
                className="max-h-56 w-full rounded-lg border border-slate-200 object-contain"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow"
              >
                <RefreshCw className="h-3 w-3" />
                Cambiar
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-10 text-slate-500 hover:border-slate-400"
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">
                Tomar foto del documento
              </span>
            </button>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo el documento...
            </div>
          )}
        </div>

        {/* Paso 3: datos (pre-rellenados / editables) */}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Comprueba tus datos
          </p>

          <Field
            label="Nombre"
            value={current.first_name ?? ""}
            onChange={(v) => setField("first_name", v)}
          />
          <Field
            label="Apellidos"
            value={current.last_name ?? ""}
            onChange={(v) => setField("last_name", v)}
          />
          <Field
            label="Nº de documento"
            value={current.doc_number ?? ""}
            onChange={(v) => setField("doc_number", v)}
          />
          <Field
            label="Nacionalidad (ej. ESP)"
            value={current.nationality ?? ""}
            maxLength={3}
            onChange={(v) => setField("nationality", v.toUpperCase())}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={current.date_of_birth ?? ""}
                onChange={(e) => setField("date_of_birth", e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Sexo</label>
              <select
                value={current.sex ?? ""}
                onChange={(e) => setField("sex", e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => void handleConfirm()}
          disabled={saving}
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Confirmar datos"
          )}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
      />
    </div>
  );
}
