"use client";

import { useState } from "react";
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

const createExtraSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
  iva_rate: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .min(0)
    .max(100),
  price: z
    .number({ invalid_type_error: "Introduce un número válido" })
    .min(0, "El precio no puede ser negativo"),
  multiplier_type: z.enum(["fixed", "per_person", "per_custom"]),
  multiplier_label: z.string().max(100).optional(),
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
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateExtraFormData>({
    resolver: zodResolver(createExtraSchema),
    defaultValues: { iva_rate: 10, price: 0, multiplier_type: "fixed" },
  });

  const multiplierType = watch("multiplier_type");

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
        iva_rate: data.iva_rate,
        price: data.price,
        multiplier_type: data.multiplier_type,
        multiplier_label:
          data.multiplier_type === "per_custom"
            ? (data.multiplier_label ?? null)
            : null,
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
            Define un servicio adicional disponible para las reservas.
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
              rows={2}
              placeholder="Descripción opcional del servicio"
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark placeholder:text-klyp-gray focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 resize-none"
              {...register("description")}
            />
          </div>

          {/* Precio + IVA en fila */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="extra-price">
                Precio (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="extra-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("price", { valueAsNumber: true })}
                aria-invalid={!!errors.price}
              />
              {errors.price && (
                <p className="text-xs text-red-600">{errors.price.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="extra-iva">
                IVA (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="extra-iva"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="10"
                  className="pr-7"
                  {...register("iva_rate", { valueAsNumber: true })}
                  aria-invalid={!!errors.iva_rate}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-klyp-gray">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Tipo de multiplicador */}
          <div className="space-y-1.5">
            <Label>Multiplicador de precio</Label>
            <Controller
              name="multiplier_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Precio fijo (por reserva)</SelectItem>
                    <SelectItem value="per_person">Por persona / noche</SelectItem>
                    <SelectItem value="per_custom">Por cantidad personalizada</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-klyp-gray">
              {multiplierType === "fixed" && "Se cobra una vez, independientemente de personas o noches."}
              {multiplierType === "per_person" && "Se multiplica por el número de personas y noches."}
              {multiplierType === "per_custom" && "Se multiplica por una cantidad que define el cliente."}
            </p>
          </div>

          {/* Etiqueta de cantidad (solo per_custom) */}
          {multiplierType === "per_custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="extra-label">Etiqueta de cantidad</Label>
              <Input
                id="extra-label"
                placeholder="Ej: Número de mascotas"
                {...register("multiplier_label")}
              />
              <p className="text-xs text-klyp-gray">
                Se muestra al huésped para indicar qué debe introducir.
              </p>
            </div>
          )}

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
              Crear Extra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
