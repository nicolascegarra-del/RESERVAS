"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
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
import { FIELD_TYPE_LABELS } from "@/types";
import type { FieldDefinition, FieldType } from "@/types";

const createFieldSchema = z
  .object({
    field_key: z
      .string()
      .min(1, "La clave es obligatoria")
      .max(100, "Máximo 100 caracteres")
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "Solo minúsculas, números y guion bajo. Debe empezar por letra.",
      ),
    field_label: z
      .string()
      .min(1, "La etiqueta es obligatoria")
      .max(200, "Máximo 200 caracteres"),
    field_type: z.enum(["text", "number", "boolean", "select"] as const, {
      required_error: "Selecciona un tipo de campo",
    }),
    is_required: z.boolean().default(false),
    sort_order: z.number().int().min(0).default(0),
    options_raw: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.field_type === "select") {
        const opts = data.options_raw?.trim();
        return opts && opts.length > 0;
      }
      return true;
    },
    {
      message: "Debes añadir al menos una opción para campos de tipo Selección",
      path: ["options_raw"],
    },
  );

type CreateFieldFormData = z.infer<typeof createFieldSchema>;

interface CreateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  onSuccess: (newField: FieldDefinition) => void;
}

export function CreateFieldDialog({
  open,
  onOpenChange,
  typeId,
  onSuccess,
}: CreateFieldDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateFieldFormData>({
    resolver: zodResolver(createFieldSchema),
    defaultValues: { is_required: false, sort_order: 0 },
  });

  const selectedType = watch("field_type");

  const handleAddOption = () => {
    const trimmed = optionInput.trim();
    if (trimmed && !options.includes(trimmed)) {
      const newOptions = [...options, trimmed];
      setOptions(newOptions);
      setValue("options_raw", newOptions.join(","), { shouldValidate: true });
    }
    setOptionInput("");
  };

  const handleRemoveOption = (option: string) => {
    const newOptions = options.filter((o) => o !== option);
    setOptions(newOptions);
    setValue("options_raw", newOptions.join(","), { shouldValidate: true });
  };

  const handleClose = () => {
    reset();
    setServerError(null);
    setOptions([]);
    setOptionInput("");
    onOpenChange(false);
  };

  const onSubmit = async (data: CreateFieldFormData) => {
    setServerError(null);
    try {
      const response = await accommodationsApi.createField({
        accommodation_type_id: typeId,
        field_key: data.field_key,
        field_label: data.field_label,
        field_type: data.field_type as FieldType,
        options: data.field_type === "select" ? options : null,
        is_required: data.is_required,
        sort_order: data.sort_order,
      });
      handleClose();
      onSuccess(response.data);
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        apiError.response?.data?.error?.message ??
        "Error al crear la característica. Inténtalo de nuevo.";
      setServerError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Característica sin Coste</DialogTitle>
          <DialogDescription>
            Define una característica adicional para las unidades de este tipo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Clave interna */}
          <div className="space-y-1.5">
            <Label htmlFor="field-key">
              Clave interna <span className="text-red-500">*</span>
            </Label>
            <Input
              id="field-key"
              placeholder="Ej: num_rooms"
              {...register("field_key")}
              aria-invalid={!!errors.field_key}
            />
            <p className="text-xs text-klyp-gray">
              Solo minúsculas, números y guion bajo. Se usa como identificador en el sistema.
            </p>
            {errors.field_key && (
              <p className="text-xs text-red-600">{errors.field_key.message}</p>
            )}
          </div>

          {/* Etiqueta */}
          <div className="space-y-1.5">
            <Label htmlFor="field-label">
              Etiqueta visible <span className="text-red-500">*</span>
            </Label>
            <Input
              id="field-label"
              placeholder="Ej: Número de habitaciones"
              {...register("field_label")}
              aria-invalid={!!errors.field_label}
            />
            {errors.field_label && (
              <p className="text-xs text-red-600">{errors.field_label.message}</p>
            )}
          </div>

          {/* Tipo de campo */}
          <div className="space-y-1.5">
            <Label htmlFor="field-type">
              Tipo de campo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedType}
              onValueChange={(value) =>
                setValue("field_type", value as CreateFieldFormData["field_type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="field-type" aria-invalid={!!errors.field_type}>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as Array<keyof typeof FIELD_TYPE_LABELS>).map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {errors.field_type && (
              <p className="text-xs text-red-600">{errors.field_type.message}</p>
            )}
          </div>

          {/* Opciones (solo para select) */}
          {selectedType === "select" && (
            <div className="space-y-2">
              <Label>
                Opciones <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="Escribe una opción"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddOption}>
                  Añadir
                </Button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <span
                      key={option}
                      className="inline-flex items-center gap-1 rounded-full bg-klyp-pale px-3 py-1 text-sm text-klyp-text-dark"
                    >
                      {option}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(option)}
                        className="text-klyp-gray hover:text-red-600"
                        aria-label={`Eliminar opción ${option}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {errors.options_raw && (
                <p className="text-xs text-red-600">{errors.options_raw.message}</p>
              )}
            </div>
          )}

          {/* Opciones adicionales */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-klyp-pale accent-klyp-accent"
                {...register("is_required")}
              />
              <span className="text-sm text-klyp-text-dark">Característica obligatoria</span>
            </label>

            <div className="flex items-center gap-2">
              <Label htmlFor="sort-order" className="text-sm whitespace-nowrap">
                Orden
              </Label>
              <Input
                id="sort-order"
                type="number"
                min={0}
                className="w-20"
                {...register("sort_order", { valueAsNumber: true })}
              />
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Característica
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
