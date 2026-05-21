"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pricingApi } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/utils";
import type { PricingModelWithExtras } from "@/types";

// ─── Schemas de validación por categoría ──────────────────────────────────────

const decimalSchema = z
  .string()
  .refine(
    (val) => val === "" || (!isNaN(Number(val)) && Number(val) >= 0),
    { message: "Debe ser un número positivo." },
  )
  .optional();

const pricingSchema = z.object({
  unit_price_per_night: decimalSchema,
  plot_price_per_night: decimalSchema,
  person_price_per_night: decimalSchema,
  currency: z.string().length(3, "Código de moneda de 3 letras (ej: EUR)"),
});

type PricingFormValues = z.infer<typeof pricingSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface PricingModelFormProps {
  typeId: string;
  /** Pricing model existente para pre-poblar el formulario */
  pricingModel: PricingModelWithExtras | null;
  onSaved: (model: PricingModelWithExtras) => void;
}

/**
 * Formulario de precio base para un AccommodationType.
 *
 * Muestra los tres campos de precio disponibles:
 * - unit_price_per_night: precio por unidad/noche
 * - plot_price_per_night: precio por parcela/noche
 * - person_price_per_night: precio por persona/noche
 *
 * La calculadora usa unit_price si tiene valor; en caso contrario
 * usa plot_price + person_price × personas.
 */
export function PricingModelForm({
  typeId,
  pricingModel,
  onSaved,
}: PricingModelFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      unit_price_per_night: pricingModel?.unit_price_per_night ?? "",
      plot_price_per_night: pricingModel?.plot_price_per_night ?? "",
      person_price_per_night: pricingModel?.person_price_per_night ?? "",
      currency: pricingModel?.currency ?? "EUR",
    },
  });

  // Resetear cuando cambia el pricingModel externo
  useEffect(() => {
    reset({
      unit_price_per_night: pricingModel?.unit_price_per_night ?? "",
      plot_price_per_night: pricingModel?.plot_price_per_night ?? "",
      person_price_per_night: pricingModel?.person_price_per_night ?? "",
      currency: pricingModel?.currency ?? "EUR",
    });
  }, [pricingModel, reset]);

  const onSubmit = async (values: PricingFormValues) => {
    try {
      const payload = {
        unit_price_per_night: values.unit_price_per_night || null,
        plot_price_per_night: values.plot_price_per_night || null,
        person_price_per_night: values.person_price_per_night || null,
        currency: values.currency,
      };

      await pricingApi.upsertModel(typeId, payload);

      // Re-fetch el modelo completo para sincronizar extras y temporadas
      const updatedResponse = await pricingApi.getModel(typeId);
      if (updatedResponse.data) {
        onSaved(updatedResponse.data);
      }
    } catch (error) {
      alert(extractApiErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="unit_price_per_night">
          Precio por unidad / noche ({pricingModel?.currency ?? "EUR"})
        </Label>
        <p className="text-xs text-klyp-gray">
          Si se configura, la calculadora usará este precio por noche.
        </p>
        <Input
          id="unit_price_per_night"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("unit_price_per_night")}
          className="max-w-xs"
        />
        {errors.unit_price_per_night && (
          <p className="text-xs text-red-600">
            {errors.unit_price_per_night.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="plot_price_per_night">
          Precio parcela / noche ({pricingModel?.currency ?? "EUR"})
        </Label>
        <p className="text-xs text-klyp-gray">
          Se usa cuando no hay precio por unidad. Se suma al precio por persona.
        </p>
        <Input
          id="plot_price_per_night"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("plot_price_per_night")}
          className="max-w-xs"
        />
        {errors.plot_price_per_night && (
          <p className="text-xs text-red-600">
            {errors.plot_price_per_night.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="person_price_per_night">
          Precio por persona / noche ({pricingModel?.currency ?? "EUR"})
        </Label>
        <p className="text-xs text-klyp-gray">
          Se multiplica por el número de personas cuando no hay precio por unidad.
        </p>
        <Input
          id="person_price_per_night"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("person_price_per_night")}
          className="max-w-xs"
        />
        {errors.person_price_per_night && (
          <p className="text-xs text-red-600">
            {errors.person_price_per_night.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="currency">Moneda (código ISO)</Label>
        <Input
          id="currency"
          type="text"
          maxLength={3}
          placeholder="EUR"
          {...register("currency")}
          className="w-24 uppercase"
        />
        {errors.currency && (
          <p className="text-xs text-red-600">{errors.currency.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="min-h-[44px]"
      >
        <Save className="mr-2 h-4 w-4" />
        {isSubmitting ? "Guardando..." : "Guardar Precios Base"}
      </Button>
    </form>
  );
}
