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
import type { AccommodationUnit } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200, "Máximo 200 caracteres"),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional(),
  capacity: z
    .number({ invalid_type_error: "Introduce un número" })
    .int()
    .min(1, "Mínimo 1 persona"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: AccommodationUnit;
  onSuccess: (updated: AccommodationUnit) => void;
}

export function EditUnitDialog({ open, onOpenChange, unit, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: unit.name,
      description: unit.description ?? "",
      capacity: unit.capacity,
      is_active: unit.is_active,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: unit.name,
        description: unit.description ?? "",
        capacity: unit.capacity,
        is_active: unit.is_active,
      });
    }
  }, [open, unit, reset]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await accommodationsApi.updateUnit(unit.id, {
        name: data.name,
        description: data.description || null,
        capacity: data.capacity,
        is_active: data.is_active,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch {
      // silencioso; el usuario puede reintentar
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar unidad</DialogTitle>
          <DialogDescription>Modifica los datos de la unidad.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-unit-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input id="edit-unit-name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-unit-desc">Descripción</Label>
            <Input id="edit-unit-desc" placeholder="Opcional" {...register("description")} />
          </div>

          {/* Capacidad + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-unit-capacity">
                Capacidad <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-unit-capacity"
                type="number"
                min={1}
                {...register("capacity", { valueAsNumber: true })}
              />
              {errors.capacity && <p className="text-xs text-red-600">{errors.capacity.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-unit-active">Estado</Label>
              <select
                id="edit-unit-active"
                className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2"
                {...register("is_active", { setValueAs: (v) => v === "true" || v === true })}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
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
