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
import type { AccommodationUnit } from "@/types";

const createUnitSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  capacity: z
    .number({ invalid_type_error: "La capacidad debe ser un número" })
    .int("Debe ser un número entero")
    .min(1, "La capacidad mínima es 1"),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional(),
});

type CreateUnitFormData = z.infer<typeof createUnitSchema>;

interface CreateUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  onSuccess: (newUnit: AccommodationUnit) => void;
}

export function CreateUnitDialog({
  open,
  onOpenChange,
  typeId,
  onSuccess,
}: CreateUnitDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUnitFormData>({
    resolver: zodResolver(createUnitSchema),
    defaultValues: { capacity: 1 },
  });

  const handleClose = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: CreateUnitFormData) => {
    setServerError(null);
    try {
      const response = await accommodationsApi.createUnit({
        accommodation_type_id: typeId,
        name: data.name,
        description: data.description ?? null,
        capacity: data.capacity,
        metadata: {},
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
        "Error al crear la unidad. Inténtalo de nuevo.";
      setServerError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva unidad de alojamiento</DialogTitle>
          <DialogDescription>
            Añade una unidad individual a este tipo de alojamiento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="unit-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unit-name"
              placeholder="Ej: Parcela A-01"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Capacidad */}
          <div className="space-y-1.5">
            <Label htmlFor="unit-capacity">
              Capacidad (personas) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unit-capacity"
              type="number"
              min={1}
              {...register("capacity", { valueAsNumber: true })}
              aria-invalid={!!errors.capacity}
            />
            {errors.capacity && (
              <p className="text-xs text-red-600">{errors.capacity.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="unit-description">Descripción</Label>
            <textarea
              id="unit-description"
              rows={3}
              placeholder="Descripción opcional"
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark placeholder:text-klyp-gray focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 resize-none"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
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
              Crear unidad
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
