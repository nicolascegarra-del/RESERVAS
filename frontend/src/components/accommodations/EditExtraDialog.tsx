"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accommodationsApi } from "@/lib/api";
import type { Extra } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200, "Máximo 200 caracteres"),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
  iva_rate: z.number({ invalid_type_error: "Introduce un número válido" }).min(0).max(100),
  price: z.number({ invalid_type_error: "Introduce un número válido" }).min(0, "El precio no puede ser negativo"),
  multiplier_type: z.enum(["fixed", "per_person", "per_person_night", "per_night"]),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extra: Extra;
  onSuccess: (updated: Extra) => void;
}

export function EditExtraDialog({ open, onOpenChange, extra, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: extra.name,
      description: extra.description ?? "",
      iva_rate: Number(extra.iva_rate),
      price: Number(extra.price),
      multiplier_type: extra.multiplier_type,
      is_active: extra.is_active,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: extra.name,
        description: extra.description ?? "",
        iva_rate: Number(extra.iva_rate),
        price: Number(extra.price),
        multiplier_type: extra.multiplier_type,
        is_active: extra.is_active,
      });
    }
  }, [open, extra, reset]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await accommodationsApi.updateExtra(extra.id, {
        name: data.name,
        description: data.description || null,
        iva_rate: data.iva_rate,
        price: data.price,
        multiplier_type: data.multiplier_type,
        is_active: data.is_active,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch {
      // El error se maneja silenciosamente; el usuario puede reintentar
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Extra de Contratación</DialogTitle>
          <DialogDescription>Modifica los datos del extra.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-extra-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-extra-name"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-extra-desc">Descripción</Label>
            <textarea
              id="edit-extra-desc"
              rows={2}
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark placeholder:text-klyp-gray focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 resize-none"
              {...register("description")}
            />
          </div>

          {/* Precio + IVA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-extra-price">
                Precio (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-extra-price"
                type="number"
                step="0.01"
                min="0"
                {...register("price", { valueAsNumber: true })}
                aria-invalid={!!errors.price}
              />
              {errors.price && (
                <p className="text-xs text-red-600">{errors.price.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-extra-iva">
                IVA (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-extra-iva"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="pr-7"
                  {...register("iva_rate", { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-klyp-gray">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Multiplicador */}
          <div className="space-y-1.5">
            <Label>Multiplicador de precio</Label>
            <Controller
              name="multiplier_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Precio Fijo x Reserva</SelectItem>
                    <SelectItem value="per_person">Precio x Personas</SelectItem>
                    <SelectItem value="per_person_night">Precio x Persona y Día de Alojamiento</SelectItem>
                    <SelectItem value="per_night">Precio x Días de Alojamiento</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-extra-active">Estado</Label>
            <select
              id="edit-extra-active"
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2"
              {...register("is_active", {
                setValueAs: (v: unknown) => v === "true" || v === true,
              })}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

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
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
