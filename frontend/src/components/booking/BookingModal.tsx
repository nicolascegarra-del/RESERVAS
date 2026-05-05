"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Mail, Phone, CreditCard, Moon, CheckCircle2, ArrowRight } from "lucide-react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import type { PublicTypeAvailability } from "@/lib/publicApi";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";
const GOOGLE_CLIENT_ID = process.env["NEXT_PUBLIC_GOOGLE_CLIENT_ID"] ?? "";

const ID_TYPE_LABELS: Record<string, string> = {
  dni: "DNI",
  nie: "NIE",
  passport: "Pasaporte",
  other: "Otro",
};

const bookingSchema = z.object({
  guest_name:        z.string().min(2, "Introduce tu nombre completo"),
  guest_email:       z.string().email("Email no válido"),
  guest_phone:       z.string().optional().or(z.literal("")),
  guest_id_type:     z.enum(["dni", "nie", "passport", "other", ""]).optional(),
  guest_id_number:   z.string().max(30).optional().or(z.literal("")),
  guest_address:     z.string().max(255).optional().or(z.literal("")),
  guest_postal_code: z.string().max(10).optional().or(z.literal("")),
  guest_city:        z.string().max(100).optional().or(z.literal("")),
  guest_region:      z.string().max(100).optional().or(z.literal("")),
  guest_country:     z.string().max(100).optional().or(z.literal("")),
  unit_id:           z.string().min(1, "Selecciona una unidad"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;
type Step = "auth" | "form" | "summary";
type AuthSource = null | "email" | "google";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: PublicTypeAvailability;
  checkIn: string;
  checkOut: string;
  nights: number;
  numPersons: number;
  accentColor?: string;
  tenantSlug: string;
}

function BookingModalInner({
  open,
  onOpenChange,
  result,
  checkIn,
  checkOut,
  nights,
  numPersons,
  accentColor = "#2E6DB4",
  tenantSlug,
}: BookingModalProps) {
  const [step, setStep] = useState<Step>("auth");
  const [authSource, setAuthSource] = useState<AuthSource>(null);
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const availableUnits = result.available_units.filter((u) => u.is_available);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guest_name:        "",
      guest_email:       "",
      guest_phone:       "",
      guest_id_type:     "",
      guest_id_number:   "",
      guest_address:     "",
      guest_postal_code: "",
      guest_city:        "",
      guest_region:      "",
      guest_country:     "España",
      unit_id:           availableUnits[0]?.unit_id.toString() ?? "",
    },
  });

  const watchedUnitId = watch("unit_id");
  const selectedUnit = availableUnits.find((u) => u.unit_id.toString() === watchedUnitId);

  const totalPrice = result.price_preview
    ? parseFloat(result.price_preview.total_price as unknown as string)
    : null;

  const formatEur = (v: number) =>
    v.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  /* ── Auth handlers ─────────────────────────────────────────────── */

  const handleContinueWithEmail = () => {
    if (!authEmailInput.trim() || !authEmailInput.includes("@")) return;
    setValue("guest_email", authEmailInput.trim());
    setAuthSource("email");
    setStep("form");
  };

  const handleGoogleSuccess = (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split(".")[1]!)) as {
        name?: string;
        email?: string;
      };
      if (payload.name)  setValue("guest_name", payload.name);
      if (payload.email) setValue("guest_email", payload.email);
      setAuthSource("google");
      setStep("form");
    } catch {
      // Si falla el decode mantenemos el paso de auth
    }
  };

  /* ── Form / Pay handlers ───────────────────────────────────────── */

  const onSubmit = () => {
    setApiError(null);
    setStep("summary");
  };

  const handlePay = async () => {
    const values = watch();
    setIsRedirecting(true);
    setApiError(null);
    try {
      const res = await axios.post<{ reservation_id: string; stripe_checkout_url: string }>(
        `${API_URL}/api/v1/public/${tenantSlug}/reservations`,
        {
          unit_id:               values.unit_id,
          accommodation_type_id: result.type_id,
          guest_name:            values.guest_name,
          guest_email:           values.guest_email,
          guest_phone:           values.guest_phone || null,
          guest_id_type:         values.guest_id_type || null,
          guest_id_number:       values.guest_id_number || null,
          guest_address:         values.guest_address || null,
          guest_postal_code:     values.guest_postal_code || null,
          guest_city:            values.guest_city || null,
          guest_region:          values.guest_region || null,
          guest_country:         values.guest_country || null,
          check_in:              checkIn,
          check_out:             checkOut,
          num_persons:           numPersons,
        }
      );
      window.location.href = res.data.stripe_checkout_url;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setApiError(
        err.response?.data?.detail?.error?.message ??
        "No se pudo procesar la reserva. Inténtalo de nuevo."
      );
      setIsRedirecting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!isRedirecting) {
      onOpenChange(v);
      // Reset al cerrar
      setStep("auth");
      setAuthSource(null);
      setAuthEmailInput("");
      setApiError(null);
    }
  };

  const inputCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const stepTitle: Record<Step, string> = {
    auth:    "Completa tu reserva",
    form:    "Datos de la reserva",
    summary: "Resumen antes de pagar",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-klyp-navy">
            {stepTitle[step]}
          </DialogTitle>
        </DialogHeader>

        {/* ── Paso 0: Autenticación ───────────────────────────────── */}
        {step === "auth" && (
          <div className="flex-1 overflow-y-auto py-2 space-y-5">
            <p className="text-sm text-klyp-gray">
              Identifícate para continuar con la reserva de <strong>{result.type_name}</strong>.
            </p>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="auth_email">Email</Label>
              <Input
                id="auth_email"
                type="email"
                placeholder="Indica tu dirección de email"
                value={authEmailInput}
                onChange={(e) => setAuthEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleContinueWithEmail(); }}
                autoFocus
              />
              <Button
                className="w-full min-h-[44px] text-white"
                style={{ backgroundColor: accentColor }}
                onClick={handleContinueWithEmail}
                disabled={!authEmailInput.trim() || !authEmailInput.includes("@")}
              >
                Continuar con email
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Separador */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-klyp-pale" />
                  <span className="text-xs text-klyp-gray whitespace-nowrap">o usar una de estas opciones</span>
                  <div className="flex-1 border-t border-klyp-pale" />
                </div>

                {/* Botones de redes sociales */}
                <div className="flex flex-col items-center gap-3">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {/* silent */}}
                    text="continue_with"
                    shape="rectangular"
                    locale="es"
                    width="380"
                  />

                  {/* Apple Sign-In — requiere Apple Developer account */}
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-3 h-[40px] rounded border border-gray-300 bg-white text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
                    title="Próximamente"
                  >
                    {/* Apple icon SVG */}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Continuar con Apple
                  </button>
                </div>

                <p className="text-center text-xs text-klyp-gray">
                  Apple Sign-In disponible próximamente
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Paso 1: Formulario ──────────────────────────────────── */}
        {step === "form" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto space-y-5 py-2 pr-1"
          >
            {/* Banner de origen */}
            {authSource === "google" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Datos importados desde Google. Revisa y completa el resto.
              </div>
            )}

            {/* Unidad */}
            {availableUnits.length > 1 && (
              <div className="space-y-1.5">
                <Label>Unidad de alojamiento</Label>
                <select {...register("unit_id")} className={inputCls}>
                  {availableUnits.map((u) => (
                    <option key={u.unit_id.toString()} value={u.unit_id.toString()}>
                      {u.unit_name} (capacidad: {u.capacity} personas)
                    </option>
                  ))}
                </select>
                {errors.unit_id && <p className="text-xs text-red-600">{errors.unit_id.message}</p>}
              </div>
            )}

            {/* ── Datos de contacto ────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-klyp-gray border-b border-klyp-pale pb-1 w-full">
                Datos de contacto
              </legend>

              <div className="space-y-1.5">
                <Label htmlFor="bm_guest_name">
                  Nombre completo <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                  <Input
                    id="bm_guest_name"
                    className="pl-9"
                    placeholder="Juan García"
                    readOnly={authSource === "google"}
                    {...register("guest_name")}
                  />
                </div>
                {errors.guest_name && <p className="text-xs text-red-600">{errors.guest_name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bm_guest_email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                    <Input
                      id="bm_guest_email"
                      type="email"
                      className="pl-9"
                      placeholder="tu@email.com"
                      readOnly={authSource === "google" || authSource === "email"}
                      {...register("guest_email")}
                    />
                  </div>
                  {errors.guest_email && <p className="text-xs text-red-600">{errors.guest_email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bm_guest_phone">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                    <Input
                      id="bm_guest_phone"
                      type="tel"
                      className="pl-9"
                      placeholder="+34 600 000 000"
                      {...register("guest_phone")}
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── Identificación ───────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-klyp-gray border-b border-klyp-pale pb-1 w-full">
                Identificación
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bm_id_type">Tipo de documento</Label>
                  <select id="bm_id_type" className={inputCls} {...register("guest_id_type")}>
                    <option value="">Selecciona...</option>
                    <option value="dni">DNI</option>
                    <option value="nie">NIE</option>
                    <option value="passport">Pasaporte</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bm_id_number">Número de documento</Label>
                  <Input id="bm_id_number" placeholder="12345678A" {...register("guest_id_number")} />
                </div>
              </div>
            </fieldset>

            {/* ── Dirección ────────────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-klyp-gray border-b border-klyp-pale pb-1 w-full">
                Dirección
              </legend>

              <div className="space-y-1.5">
                <Label htmlFor="bm_address">Dirección</Label>
                <Input id="bm_address" placeholder="Calle, número, piso..." {...register("guest_address")} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bm_cp">Código postal</Label>
                  <Input id="bm_cp" placeholder="28001" {...register("guest_postal_code")} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="bm_city">Ciudad</Label>
                  <Input id="bm_city" placeholder="Madrid" {...register("guest_city")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bm_region">Provincia / Región</Label>
                  <Input id="bm_region" placeholder="Madrid" {...register("guest_region")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bm_country">País</Label>
                  <Input id="bm_country" placeholder="España" {...register("guest_country")} />
                </div>
              </div>
            </fieldset>

            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] px-4"
                onClick={() => setStep("auth")}
              >
                Atrás
              </Button>
              <Button
                type="submit"
                className="flex-1 min-h-[44px] text-white"
                style={{ backgroundColor: accentColor }}
              >
                Revisar y pagar
              </Button>
            </div>
          </form>
        )}

        {/* ── Paso 2: Resumen ────────────────────────────────────── */}
        {step === "summary" && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            <div className="rounded-lg bg-klyp-pale p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-klyp-gray">Alojamiento</span>
                <span className="font-medium">{result.type_name}</span>
              </div>
              {selectedUnit && (
                <div className="flex justify-between">
                  <span className="text-klyp-gray">Unidad</span>
                  <span>{selectedUnit.unit_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-klyp-gray">Entrada</span>
                <span>{formatDate(checkIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-klyp-gray">Salida</span>
                <span>{formatDate(checkOut)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-klyp-gray">Personas</span>
                <span>{numPersons}</span>
              </div>

              {/* Datos del huésped */}
              <div className="border-t border-klyp-pale pt-2 mt-2 space-y-1">
                <p className="text-xs font-medium text-klyp-gray uppercase tracking-wide">Huésped</p>
                {authSource === "google" && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Google
                  </span>
                )}
                <p className="font-medium text-klyp-text-dark">{watch("guest_name")}</p>
                <p className="text-klyp-gray">{watch("guest_email")}</p>
                {watch("guest_phone") && <p className="text-klyp-gray">{watch("guest_phone")}</p>}
                {watch("guest_id_number") && (
                  <p className="text-klyp-gray text-xs">
                    {watch("guest_id_type") ? ID_TYPE_LABELS[watch("guest_id_type") ?? ""] ?? "" : ""}{" "}
                    {watch("guest_id_number")}
                  </p>
                )}
                {watch("guest_city") && (
                  <p className="text-klyp-gray text-xs">
                    {[watch("guest_city"), watch("guest_region"), watch("guest_country")].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {totalPrice !== null && (
                <div className="flex justify-between border-t border-klyp-pale pt-2 mt-2">
                  <span className="font-semibold flex items-center gap-1">
                    <Moon className="h-3 w-3" /> {nights} noche{nights !== 1 ? "s" : ""} · Total
                  </span>
                  <span className="font-bold text-klyp-navy text-lg">{formatEur(totalPrice)}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-klyp-gray bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              Serás redirigido a Stripe para completar el pago de forma segura.
              Aceptamos tarjeta, Apple Pay, Google Pay y PayPal.
              Recibirás un email de confirmación una vez procesado.
            </div>

            {apiError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={() => setStep("form")}
                disabled={isRedirecting}
              >
                Modificar datos
              </Button>
              <Button
                className="flex-1 min-h-[44px] text-white"
                style={{ backgroundColor: accentColor }}
                onClick={() => void handlePay()}
                disabled={isRedirecting}
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar ahora
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wrapper que inyecta GoogleOAuthProvider cuando hay GOOGLE_CLIENT_ID configurado.
 * Sin él, el modal funciona igual pero sin el botón de Google.
 */
export function BookingModal(props: BookingModalProps) {
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BookingModalInner {...props} />
      </GoogleOAuthProvider>
    );
  }
  return <BookingModalInner {...props} />;
}
