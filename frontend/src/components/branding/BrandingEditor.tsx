"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Palette, Save, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsApi, type TenantBranding } from "@/lib/api";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const brandingSchema = z.object({
  brand_name: z.string().max(255).nullable().optional(),
  logo_url: z.string().url("Introduce una URL válida").max(500).nullable().or(z.literal("")).optional(),
  primary_color: z
    .string()
    .regex(HEX_RE, "Formato #RRGGBB requerido")
    .nullable()
    .or(z.literal(""))
    .optional(),
  accent_color: z
    .string()
    .regex(HEX_RE, "Formato #RRGGBB requerido")
    .nullable()
    .or(z.literal(""))
    .optional(),
  tagline: z.string().max(500).nullable().optional(),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

const DEFAULT_PRIMARY = "#051937";
const DEFAULT_ACCENT = "#2E6DB4";

export function BrandingEditor() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      brand_name: "",
      logo_url: "",
      primary_color: "",
      accent_color: "",
      tagline: "",
    },
  });

  // Cargar branding actual
  useEffect(() => {
    settingsApi
      .getBranding()
      .then((res) => {
        reset({
          brand_name: res.data.brand_name ?? "",
          logo_url: res.data.logo_url ?? "",
          primary_color: res.data.primary_color ?? "",
          accent_color: res.data.accent_color ?? "",
          tagline: res.data.tagline ?? "",
        });
      })
      .catch(() => {
        // silencioso — el formulario queda en blanco
      })
      .finally(() => setIsLoading(false));
  }, [reset]);

  const primaryColor = watch("primary_color");
  const accentColor = watch("accent_color");
  const logoUrl = watch("logo_url");
  const brandName = watch("brand_name");

  const previewPrimary = HEX_RE.test(primaryColor ?? "") ? (primaryColor ?? DEFAULT_PRIMARY) : DEFAULT_PRIMARY;
  const previewAccent = HEX_RE.test(accentColor ?? "") ? (accentColor ?? DEFAULT_ACCENT) : DEFAULT_ACCENT;

  const onSubmit = async (values: BrandingFormValues) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: Partial<TenantBranding> = {
      brand_name: values.brand_name || null,
      logo_url: values.logo_url || null,
      primary_color: HEX_RE.test(values.primary_color ?? "") ? (values.primary_color ?? null) : null,
      accent_color: HEX_RE.test(values.accent_color ?? "") ? (values.accent_color ?? null) : null,
      tagline: values.tagline || null,
    };

    try {
      await settingsApi.updateBranding(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("No se pudo guardar el branding. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-klyp-gray">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Preview en vivo */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-klyp-text-dark flex items-center gap-1.5">
          <Palette className="h-4 w-4 text-klyp-accent" />
          Vista previa del encabezado
        </p>
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between shadow-sm"
          style={{ backgroundColor: previewPrimary }}
        >
          <div className="flex items-center gap-2">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="logo" className="h-8 w-auto max-w-[120px] object-contain" />
            ) : (
              <MapPin className="h-4 w-4 text-white/80" />
            )}
            <span className="text-white font-semibold text-sm">
              {brandName || "Nombre de tu empresa"}
            </span>
          </div>
          <div
            className="rounded px-3 py-1 text-white text-xs font-medium"
            style={{ backgroundColor: previewAccent }}
          >
            Buscar
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Nombre visible */}
          <div className="space-y-1.5">
            <Label htmlFor="brand_name">Nombre visible en la landing</Label>
            <Input
              id="brand_name"
              placeholder="Camping El Pinar"
              {...register("brand_name")}
            />
            <p className="text-xs text-klyp-gray">Si está vacío, se usa el nombre del tenant.</p>
            {errors.brand_name && (
              <p className="text-xs text-red-600">{errors.brand_name.message}</p>
            )}
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline / subtítulo del hero</Label>
            <Input
              id="tagline"
              placeholder="El mejor camping de la sierra..."
              {...register("tagline")}
            />
            {errors.tagline && (
              <p className="text-xs text-red-600">{errors.tagline.message}</p>
            )}
          </div>

          {/* URL del logo */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="logo_url">URL del logo</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://tuempresa.com/logo.png"
              {...register("logo_url")}
            />
            <p className="text-xs text-klyp-gray">
              Pega la URL de tu logo (PNG, SVG o WEBP). Recomendado: fondo transparente, altura mínima 60px.
            </p>
            {errors.logo_url && (
              <p className="text-xs text-red-600">{errors.logo_url.message}</p>
            )}
          </div>

          {/* Color primario */}
          <div className="space-y-1.5">
            <Label htmlFor="primary_color">Color principal (cabecera / fondo hero)</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={HEX_RE.test(primaryColor ?? "") ? (primaryColor ?? DEFAULT_PRIMARY) : DEFAULT_PRIMARY}
                onChange={(e) => setValue("primary_color", e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input p-0.5"
                aria-label="Color principal"
              />
              <Input
                id="primary_color"
                placeholder="#051937"
                className="font-mono"
                {...register("primary_color")}
              />
            </div>
            {errors.primary_color && (
              <p className="text-xs text-red-600">{errors.primary_color.message}</p>
            )}
          </div>

          {/* Color de acento */}
          <div className="space-y-1.5">
            <Label htmlFor="accent_color">Color de acento (botones / CTAs)</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={HEX_RE.test(accentColor ?? "") ? (accentColor ?? DEFAULT_ACCENT) : DEFAULT_ACCENT}
                onChange={(e) => setValue("accent_color", e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input p-0.5"
                aria-label="Color de acento"
              />
              <Input
                id="accent_color"
                placeholder="#2E6DB4"
                className="font-mono"
                {...register("accent_color")}
              />
            </div>
            {errors.accent_color && (
              <p className="text-xs text-red-600">{errors.accent_color.message}</p>
            )}
          </div>
        </div>

        {/* Feedback */}
        {saveSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            Branding guardado correctamente. Los cambios ya son visibles en la landing pública.
          </div>
        )}
        {saveError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <Button type="submit" disabled={isSaving} className="min-h-[44px]">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar branding
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
