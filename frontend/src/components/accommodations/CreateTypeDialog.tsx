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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accommodationsApi } from "@/lib/api";
import type { AccommodationType } from "@/types";

const createTypeSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  type_category: z.enum(["camping", "apartment", "cabin"], {
    required_error: "Selecciona una categoría",
  }),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional(),
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
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTypeFormData>({
    resolver: zodResolver(createTypeSchema),
  });

  const selectedCategory = watch("type_category");

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
        type_category: data.type_category,
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

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label htmlFor="type-category">
              Categoría <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) =>
                setValue(
                  "type_category",
                  value as CreateTypeFormData["type_category"],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger id="type-category" aria-invalid={!!errors.type_category}>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="camping">Camping</SelectItem>
                <SelectItem value="apartment">Apartamento</SelectItem>
                <SelectItem value="cabin">Cabaña</SelectItem>
              </SelectContent>
            </Select>
            {errors.type_category && (
              <p className="text-xs text-red-600">{errors.type_category.message}</p>
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
              Crear tipo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
