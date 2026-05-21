"use client";

import { useState } from "react";
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
import { accommodationsApi } from "@/lib/api";
import type { AccommodationType } from "@/types";

const createTypeSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional(),
  iva_rate: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .min(0, "El IVA no puede ser negativo")
    .max(100, "El IVA no puede superar el 100%"),
});

type CreateTypeFormData = z.infer<typeof createTypeSchema>;

interface CreateTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newType: AccommodationType) => void;
}

export function CreateTypeDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTypeDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTypeFormData>({
    resolver: zodResolver(createTypeSchema),
    defaultValues: { iva_rate: 10 },
  });

  const handleClose = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: CreateTypeFormData) => {
    setServerError(null);
    try {
      const response = await accommodationsApi.createType({
        name: data.name,
        description: data.description ?? null,
        iva_rate: data.iva_rate,
      });
      reset();
      onSuccess(response.data);
      onOpenChange(false);
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        apiError.response?.data?.error?.message ??
        "Error al crear el tipo de alojamiento. Inténtalo de nuevo.";
      setServerError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo tipo de alojamiento</DialogTitle>
          <DialogDescription>
            Define un nuevo tipo para agrupar unidades similares.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="type-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="type-name"
              placeholder="Ej: Parcelas de camping"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="type-description">Descripción</Label>
            <textarea
              id="type-description"
              rows={3}
              placeholder="Descripción opcional del tipo de alojamiento"
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark placeholder:text-klyp-gray focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 resize-none"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* IVA */}
          <div className="space-y-1.5">
            <Label htmlFor="type-iva">
              Tipo de IVA (%) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="type-iva"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="10"
                className="pr-8"
                {...register("iva_rate", { valueAsNumber: true })}
                aria-invalid={!!errors.iva_rate}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-klyp-gray">%</span>
            </div>
            <p className="text-xs text-klyp-gray">
              IVA aplicado al precio del alojamiento (común: 10% turístico, 21% general).
            </p>
            {errors.iva_rate && (
              <p className="text-xs text-red-600">{errors.iva_rate.message}</p>
            )}
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Tipo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
