"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pricingApi } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/utils";
import type { Season } from "@/types";

// ─── Schema ───────────────────────────────────────────────────────────────────

const decimalOptional = z
  .string()
  .refine(
    (val) => val === "" || (!isNaN(Number(val)) && Number(val) >= 0),
    { message: "Debe ser un número positivo." },
  )
  .optional();

const seasonSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio.").max(200),
    start_date: z.string().min(1, "La fecha de inicio es obligatoria."),
    end_date: z.string().min(1, "La fecha de fin es obligatoria."),
    unit_price_per_night: decimalOptional,
    plot_price_per_night: decimalOptional,
    person_price_per_night: decimalOptional,
  })
  .refine((data) => data.end_date > data.start_date, {
    message: "La fecha de fin debe ser posterior a la de inicio.",
    path: ["end_date"],
  });

type SeasonFormValues = z.infer<typeof seasonSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  /** Si se pasa, el dialog opera en modo edición */
  seasonToEdit?: Season | null;
  onSuccess: (season: Season) => void;
}

/**
 * Dialog para crear o editar una temporada de precios.
 *
 * Muestra los tres campos de precio disponibles; los vacíos heredan del precio base.
 */
export function CreateSeasonDialog({
  open,
  onOpenChange,
  typeId,
  seasonToEdit,
  onSuccess,
}: CreateSeasonDialogProps) {
  const isEditing = !!seasonToEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SeasonFormValues>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
      unit_price_per_night: "",
      plot_price_per_night: "",
      person_price_per_night: "",
    },
  });

  // Pre-poblar si estamos editando
  useEffect(() => {
    if (seasonToEdit) {
      reset({
        name: seasonToEdit.name,
        start_date: seasonToEdit.start_date,
        end_date: seasonToEdit.end_date,
        unit_price_per_night: seasonToEdit.unit_price_per_night ?? "",
        plot_price_per_night: seasonToEdit.plot_price_per_night ?? "",
        person_price_per_night: seasonToEdit.person_price_per_night ?? "",
      });
    } else {
      reset({
        name: "",
        start_date: "",
        end_date: "",
        unit_price_per_night: "",
        plot_price_per_night: "",
        person_price_per_night: "",
      });
    }
  }, [seasonToEdit, reset]);

  const onSubmit = async (values: SeasonFormValues) => {
    try {
      const payload = {
        name: values.name,
        start_date: values.start_date,
        end_date: values.end_date,
        unit_price_per_night: values.unit_price_per_night || null,
        plot_price_per_night: values.plot_price_per_night || null,
        person_price_per_night: values.person_price_per_night || null,
      };

      let result: Season;
      if (isEditing && seasonToEdit) {
        const response = await pricingApi.updateSeason(
          typeId,
          seasonToEdit.id,
          payload,
        );
        result = response.data;
      } else {
        const response = await pricingApi.createSeason(typeId, payload);
        result = response.data;
      }

      onSuccess(result);
      onOpenChange(false);
    } catch (error) {
      alert(extractApiErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">
            {isEditing ? "Editar temporada" : "Nueva temporada"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="season-name">Nombre</Label>
            <Input
              id="season-name"
              placeholder="Temporada Alta"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start_date">Fecha inicio</Label>
              <Input
                id="start_date"
                type="date"
                {...register("start_date")}
              />
              {errors.start_date && (
                <p className="text-xs text-red-600">
                  {errors.start_date.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_date">Fecha fin</Label>
              <Input
                id="end_date"
                type="date"
                {...register("end_date")}
              />
              {errors.end_date && (
                <p className="text-xs text-red-600">
                  {errors.end_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-klyp-pale pt-4">
            <p className="mb-3 text-sm font-medium text-klyp-navy">
              Precios de temporada
            </p>
            <p className="mb-3 text-xs text-klyp-gray">
              Los precios vacíos heredan el valor del precio base del tipo.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="unit_price_season">Precio unidad / noche</Label>
                <Input
                  id="unit_price_season"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Heredar del precio base"
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
                <Label htmlFor="plot_price_season">Precio parcela / noche</Label>
                <Input
                  id="plot_price_season"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Heredar del precio base"
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
                <Label htmlFor="person_price_season">
                  Precio por persona / noche
                </Label>
                <Input
                  id="person_price_season"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Heredar del precio base"
                  {...register("person_price_per_night")}
                  className="max-w-xs"
                />
                {errors.person_price_per_night && (
                  <p className="text-xs text-red-600">
                    {errors.person_price_per_night.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Actualizar Temporada"
                  : "Crear Temporada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
