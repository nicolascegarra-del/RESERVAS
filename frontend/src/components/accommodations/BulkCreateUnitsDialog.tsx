"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  baseName: z
    .string()
    .min(1, "El nombre base es obligatorio")
    .max(180, "Máximo 180 caracteres"),
  quantity: z
    .number({ invalid_type_error: "Introduce un número" })
    .int()
    .min(1, "Mínimo 1")
    .max(500, "Máximo 500"),
  startFrom: z
    .number({ invalid_type_error: "Introduce un número" })
    .int()
    .min(0, "Mínimo 0"),
  capacity: z
    .number({ invalid_type_error: "Introduce un número" })
    .int()
    .min(1, "Mínimo 1"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  onSuccess: (units: AccommodationUnit[]) => void;
}

export function BulkCreateUnitsDialog({ open, onOpenChange, typeId, onSuccess }: Props) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const { register, handleSubmit, watch, reset, formState: { errors: formErrors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { baseName: "", quantity: 10, startFrom: 1, capacity: 2 },
    });

  const baseName = watch("baseName");
  const quantity = watch("quantity");
  const startFrom = watch("startFrom");

  const preview = (() => {
    const n = Math.min(quantity || 0, 5);
    const names = Array.from({ length: n }, (_, i) =>
      `${baseName || "Unidad"} ${(startFrom || 1) + i}`
    );
    if ((quantity || 0) > 5) names.push(`… hasta ${baseName || "Unidad"} ${(startFrom || 1) + (quantity || 0) - 1}`);
    return names;
  })();

  const handleClose = () => {
    if (isSubmitting || progress !== null) return;
    reset();
    setProgress(null);
    setErrors([]);
    onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    setErrors([]);
    const created: AccommodationUnit[] = [];
    const errs: string[] = [];
    setProgress({ done: 0, total: data.quantity });

    for (let i = 0; i < data.quantity; i++) {
      const name = `${data.baseName} ${data.startFrom + i}`;
      try {
        const res = await accommodationsApi.createUnit({
          accommodation_type_id: typeId,
          name,
          description: null,
          capacity: data.capacity,
          metadata: {},
        });
        created.push(res.data);
      } catch {
        errs.push(name);
      }
      setProgress({ done: i + 1, total: data.quantity });
    }

    setErrors(errs);
    if (created.length > 0) onSuccess(created);

    if (errs.length === 0) {
      setTimeout(() => {
        reset();
        setProgress(null);
        onOpenChange(false);
      }, 1200);
    }
  };

  const isDone = progress !== null && progress.done === progress.total;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear unidades en lote</DialogTitle>
          <DialogDescription>
            Genera múltiples unidades iguales de una sola vez.
          </DialogDescription>
        </DialogHeader>

        {!progress ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Nombre base */}
            <div className="space-y-1.5">
              <Label htmlFor="baseName">
                Nombre base <span className="text-red-500">*</span>
              </Label>
              <Input
                id="baseName"
                placeholder="Ej: Parcela, Apartamento, Cama"
                {...register("baseName")}
              />
              {formErrors.baseName && (
                <p className="text-xs text-red-600">{formErrors.baseName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Cantidad */}
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Cantidad <span className="text-red-500">*</span></Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={500}
                  {...register("quantity", { valueAsNumber: true })}
                />
                {formErrors.quantity && (
                  <p className="text-xs text-red-600">{formErrors.quantity.message}</p>
                )}
              </div>

              {/* Numeración desde */}
              <div className="space-y-1.5">
                <Label htmlFor="startFrom">Desde nº</Label>
                <Input
                  id="startFrom"
                  type="number"
                  min={0}
                  {...register("startFrom", { valueAsNumber: true })}
                />
              </div>

              {/* Capacidad */}
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Capacidad <span className="text-red-500">*</span></Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  {...register("capacity", { valueAsNumber: true })}
                />
                {formErrors.capacity && (
                  <p className="text-xs text-red-600">{formErrors.capacity.message}</p>
                )}
              </div>
            </div>

            {/* Preview */}
            {baseName && (
              <div className="rounded-lg bg-klyp-pale px-3 py-2.5 text-xs text-klyp-gray">
                <p className="font-medium text-klyp-navy mb-1">Se crearán:</p>
                <p>{preview.join(", ")}</p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear {quantity || 0} unidades
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-klyp-gray">
                  {isDone ? "Completado" : "Creando unidades…"}
                </span>
                <span className="font-medium text-klyp-navy">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-klyp-pale overflow-hidden">
                <div
                  className="h-2 rounded-full bg-klyp-accent transition-all duration-200"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Resultado */}
            {isDone && (
              <div className="space-y-2">
                {errors.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{progress.total} unidades creadas correctamente.</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        {progress.total - errors.length} creadas, {errors.length} con error.
                      </span>
                    </div>
                    <p className="text-xs text-red-600">
                      Fallaron: {errors.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isDone && (
              <DialogFooter>
                <Button onClick={handleClose}>Cerrar</Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
