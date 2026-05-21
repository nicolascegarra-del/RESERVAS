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
import { accommodationsApi } from "@/lib/api";
import type { AccommodationType } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200, "Máximo 200 caracteres"),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional(),
  iva_rate: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .min(0, "El IVA no puede ser negativo")
    .max(100, "El IVA no puede superar el 100%"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accommodationType: AccommodationType;
  onSuccess: (updated: AccommodationType) => void;
}

export function EditTypeDialog({ open, onOpenChange, accommodationType, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: accommodationType.name,
      description: accommodationType.description ?? "",
      iva_rate: Number(accommodationType.iva_rate),
      is_active: accommodationType.is_active,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: accommodationType.name,
        description: accommodationType.description ?? "",
        iva_rate: Number(accommodationType.iva_rate),
        is_active: accommodationType.is_active,
      });
    }
  }, [open, accommodationType, reset]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await accommodationsApi.updateType(accommodationType.id, {
        name: data.name,
        description: data.description || null,
        iva_rate: data.iva_rate,
        is_active: data.is_active,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch {
      // el error se muestra silenciosamente; el usuario puede reintentar
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tipo de alojamiento</DialogTitle>
          <DialogDescription>Modifica los datos del tipo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-type-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input id="edit-type-name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-type-desc">Descripción</Label>
            <textarea
              id="edit-type-desc"
              rows={3}
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark placeholder:text-klyp-gray focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 resize-none"
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
          </div>

          {/* IVA + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-type-iva">
                IVA (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-type-iva"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="pr-8"
                  {...register("iva_rate", { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-klyp-gray">%</span>
              </div>
              {errors.iva_rate && <p className="text-xs text-red-600">{errors.iva_rate.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-type-active">Estado</Label>
              <select
                id="edit-type-active"
                className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2"
                {...register("is_active", { setValueAs: (v) => v === "true" || v === true })}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
