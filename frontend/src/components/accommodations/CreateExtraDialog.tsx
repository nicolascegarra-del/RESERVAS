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
import type { Extra } from "@/types";

const createExtraSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
});

type CreateExtraFormData = z.infer<typeof createExtraSchema>;

interface CreateExtraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newExtra: Extra) => void;
}

export function CreateExtraDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateExtraDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExtraFormData>({
    resolver: zodResolver(createExtraSchema),
  });

  const handleClose = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: CreateExtraFormData) => {
    setServerError(null);
    try {
      const response = await accommodationsApi.createExtra({
        name: data.name,
        description: data.description ?? null,
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
        "Error al crear el extra. Inténtalo de nuevo.";
      setServerError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo extra</DialogTitle>
          <DialogDescription>
            Define un servicio adicional que podrán seleccionar las reservas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="extra-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="extra-name"
              placeholder="Ej: Electricidad, Wifi, Parking"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="extra-description">Descripción</Label>
            <textarea
              id="extra-description"
              rows={3}
              placeholder="Descripción opcional del servicio"
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
              Crear extra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
