"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ID_TYPES = [
  { value: "dni",      label: "DNI" },
  { value: "nie",      label: "NIE" },
  { value: "passport", label: "Pasaporte" },
  { value: "other",    label: "Otro" },
];

const guestFormSchema = z.object({
  guest_name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(200, "El nombre no puede superar 200 caracteres."),
  guest_email: z
    .string()
    .email("Introduce un email válido."),
  guest_phone: z
    .string()
    .max(30, "El teléfono no puede superar 30 caracteres.")
    .optional()
    .or(z.literal("")),

  // Identificación
  guest_id_type: z
    .enum(["dni", "nie", "passport", "other", ""])
    .optional(),
  guest_id_number: z
    .string()
    .max(30, "El número de documento no puede superar 30 caracteres.")
    .optional()
    .or(z.literal("")),

  // Dirección
  guest_address: z
    .string()
    .max(255, "La dirección no puede superar 255 caracteres.")
    .optional()
    .or(z.literal("")),
  guest_postal_code: z
    .string()
    .max(10, "El código postal no puede superar 10 caracteres.")
    .optional()
    .or(z.literal("")),
  guest_city: z
    .string()
    .max(100, "La ciudad no puede superar 100 caracteres.")
    .optional()
    .or(z.literal("")),
  guest_region: z
    .string()
    .max(100, "La provincia/región no puede superar 100 caracteres.")
    .optional()
    .or(z.literal("")),
  guest_country: z
    .string()
    .max(100, "El país no puede superar 100 caracteres.")
    .optional()
    .or(z.literal("")),

  internal_notes: z
    .string()
    .max(2000, "Las notas no pueden superar 2000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export type GuestFormValues = z.infer<typeof guestFormSchema>;

interface GuestFormProps {
  defaultValues?: Partial<GuestFormValues>;
  onSubmit: (values: GuestFormValues) => void;
  isLoading?: boolean;
  /** Id del form para enlazar con un botón externo mediante form= */
  formId?: string;
}

/**
 * Formulario de datos del huésped para el wizard de nueva reserva
 * y la vista de edición de reserva existente.
 *
 * Usa React Hook Form + Zod. El submit se delega al padre via onSubmit.
 */
export function GuestForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  formId = "guest-form",
}: GuestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestFormValues>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      guest_name:       defaultValues?.guest_name       ?? "",
      guest_email:      defaultValues?.guest_email      ?? "",
      guest_phone:      defaultValues?.guest_phone      ?? "",
      guest_id_type:    (defaultValues?.guest_id_type as GuestFormValues["guest_id_type"]) ?? "",
      guest_id_number:  defaultValues?.guest_id_number  ?? "",
      guest_address:    defaultValues?.guest_address    ?? "",
      guest_postal_code:defaultValues?.guest_postal_code ?? "",
      guest_city:       defaultValues?.guest_city       ?? "",
      guest_region:     defaultValues?.guest_region     ?? "",
      guest_country:    defaultValues?.guest_country    ?? "España",
      internal_notes:   defaultValues?.internal_notes   ?? "",
    },
  });

  const inputCls = "flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klyp-accent disabled:opacity-50";

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* ── Datos de contacto ─────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-klyp-navy border-b border-klyp-pale pb-1 w-full">
          Datos de contacto
        </legend>

        {/* Nombre */}
        <div className="space-y-1.5">
          <Label htmlFor="guest_name">
            Nombre completo <span className="text-red-500">*</span>
          </Label>
          <Input
            id="guest_name"
            placeholder="Nombre y apellidos"
            disabled={isLoading}
            aria-invalid={!!errors.guest_name}
            {...register("guest_name")}
          />
          {errors.guest_name && (
            <p className="text-xs text-red-600" role="alert">{errors.guest_name.message}</p>
          )}
        </div>

        {/* Email + Teléfono */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="guest_email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="guest_email"
              type="email"
              placeholder="correo@ejemplo.com"
              disabled={isLoading}
              aria-invalid={!!errors.guest_email}
              {...register("guest_email")}
            />
            {errors.guest_email && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest_phone">Teléfono</Label>
            <Input
              id="guest_phone"
              type="tel"
              placeholder="+34 600 000 000"
              disabled={isLoading}
              aria-invalid={!!errors.guest_phone}
              {...register("guest_phone")}
            />
            {errors.guest_phone && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_phone.message}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* ── Identificación ────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-klyp-navy border-b border-klyp-pale pb-1 w-full">
          Identificación
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tipo de documento */}
          <div className="space-y-1.5">
            <Label htmlFor="guest_id_type">Tipo de documento</Label>
            <select
              id="guest_id_type"
              disabled={isLoading}
              className={inputCls}
              {...register("guest_id_type")}
            >
              <option value="">Selecciona...</option>
              {ID_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.guest_id_type && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_id_type.message}</p>
            )}
          </div>

          {/* Número de documento */}
          <div className="space-y-1.5">
            <Label htmlFor="guest_id_number">Número de documento</Label>
            <Input
              id="guest_id_number"
              placeholder="12345678A"
              disabled={isLoading}
              aria-invalid={!!errors.guest_id_number}
              {...register("guest_id_number")}
            />
            {errors.guest_id_number && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_id_number.message}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* ── Dirección ─────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-klyp-navy border-b border-klyp-pale pb-1 w-full">
          Dirección
        </legend>

        {/* Dirección completa */}
        <div className="space-y-1.5">
          <Label htmlFor="guest_address">Dirección</Label>
          <Input
            id="guest_address"
            placeholder="Calle, número, piso..."
            disabled={isLoading}
            aria-invalid={!!errors.guest_address}
            {...register("guest_address")}
          />
          {errors.guest_address && (
            <p className="text-xs text-red-600" role="alert">{errors.guest_address.message}</p>
          )}
        </div>

        {/* CP + Ciudad */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="guest_postal_code">Código postal</Label>
            <Input
              id="guest_postal_code"
              placeholder="28001"
              disabled={isLoading}
              aria-invalid={!!errors.guest_postal_code}
              {...register("guest_postal_code")}
            />
            {errors.guest_postal_code && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_postal_code.message}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="guest_city">Ciudad</Label>
            <Input
              id="guest_city"
              placeholder="Madrid"
              disabled={isLoading}
              aria-invalid={!!errors.guest_city}
              {...register("guest_city")}
            />
            {errors.guest_city && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_city.message}</p>
            )}
          </div>
        </div>

        {/* Provincia + País */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="guest_region">Provincia / Región</Label>
            <Input
              id="guest_region"
              placeholder="Madrid"
              disabled={isLoading}
              aria-invalid={!!errors.guest_region}
              {...register("guest_region")}
            />
            {errors.guest_region && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_region.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest_country">País</Label>
            <Input
              id="guest_country"
              placeholder="España"
              disabled={isLoading}
              aria-invalid={!!errors.guest_country}
              {...register("guest_country")}
            />
            {errors.guest_country && (
              <p className="text-xs text-red-600" role="alert">{errors.guest_country.message}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* ── Notas internas ────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-klyp-navy border-b border-klyp-pale pb-1 w-full">
          Notas internas
        </legend>
        <Textarea
          id="internal_notes"
          placeholder="Notas visibles solo para el equipo..."
          rows={3}
          disabled={isLoading}
          aria-invalid={!!errors.internal_notes}
          {...register("internal_notes")}
        />
        {errors.internal_notes && (
          <p className="text-xs text-red-600" role="alert">{errors.internal_notes.message}</p>
        )}
      </fieldset>
    </form>
  );
}
