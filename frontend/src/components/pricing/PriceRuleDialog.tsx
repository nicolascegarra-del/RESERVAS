"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccommodationPriceRule } from "@/types";

const mmDdPattern = /^\d{2}-\d{2}$/;

const priceRuleSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  date_from: z
    .string()
    .regex(mmDdPattern, "Formato MM-DD (ej: 07-01)")
    .refine((v) => {
      const parts = v.split("-");
      const m = Number(parts[0]);
      const d = Number(parts[1]);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }, "Fecha no válida"),
  date_to: z
    .string()
    .regex(mmDdPattern, "Formato MM-DD (ej: 08-31)")
    .refine((v) => {
      const parts = v.split("-");
      const m = Number(parts[0]);
      const d = Number(parts[1]);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }, "Fecha no válida"),
  price_per_night: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .min(0, "El precio no puede ser negativo"),
  min_nights: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .int()
    .min(1, "Mínimo 1 noche"),
});

type PriceRuleFormData = z.infer<typeof priceRuleSchema>;

interface PriceRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo funciona en modo edición */
  rule?: AccommodationPriceRule;
  onSubmit: (data: PriceRuleFormData) => Promise<void>;
  serverError: string | null;
}

export function PriceRuleDialog({
  open,
  onOpenChange,
  rule,
  onSubmit,
  serverError,
}: PriceRuleDialogProps) {
  const isEditing = !!rule;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PriceRuleFormData>({
    resolver: zodResolver(priceRuleSchema),
    defaultValues: {
      name: "",
      date_from: "",
      date_to: "",
      price_per_night: 0,
      min_nights: 1,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        rule
          ? {
              name: rule.name,
              date_from: rule.date_from,
              date_to: rule.date_to,
              price_per_night: Number(rule.price_per_night),
              min_nights: rule.min_nights,
            }
          : {
              name: "",
              date_from: "",
              date_to: "",
              price_per_night: 0,
              min_nights: 1,
            },
      );
    }
  }, [open, rule, reset]);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar regla de precio" : "Nueva regla de precio"}
          </DialogTitle>
          <DialogDescription>
            Define un tramo de fechas con un precio por noche específico.
            Formato de fechas: MM-DD (mes-día, sin año).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="rule-name"
              placeholder="Ej: Temporada Alta, Semana Santa"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-from">
                Desde (MM-DD) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-from"
                placeholder="07-01"
                maxLength={5}
                {...register("date_from")}
                aria-invalid={!!errors.date_from}
              />
              {errors.date_from && (
                <p className="text-xs text-red-600">
                  {errors.date_from.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-to">
                Hasta (MM-DD) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-to"
                placeholder="08-31"
                maxLength={5}
                {...register("date_to")}
                aria-invalid={!!errors.date_to}
              />
              {errors.date_to && (
                <p className="text-xs text-red-600">
                  {errors.date_to.message}
                </p>
              )}
            </div>
          </div>

          {/* Precio + Noches mínimas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-price">
                Precio/noche (€) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="rule-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pr-7"
                  {...register("price_per_night", { valueAsNumber: true })}
                  aria-invalid={!!errors.price_per_night}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-klyp-gray">
                  €
                </span>
              </div>
              {errors.price_per_night && (
                <p className="text-xs text-red-600">
                  {errors.price_per_night.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-min-nights">Noches mínimas</Label>
              <Input
                id="rule-min-nights"
                type="number"
                min="1"
                placeholder="1"
                {...register("min_nights", { valueAsNumber: true })}
                aria-invalid={!!errors.min_nights}
              />
              {errors.min_nights && (
                <p className="text-xs text-red-600">
                  {errors.min_nights.message}
                </p>
              )}
            </div>
          </div>

          {/* Error servidor */}
          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Guardar cambios" : "Crear regla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
