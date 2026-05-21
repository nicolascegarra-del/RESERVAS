"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertTriangle } from "lucide-react";
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
import { accommodationsApi, blockingsApi } from "@/lib/api";
import type {
  AccommodationType,
  AccommodationUnit,
  Blocking,
  BlockingConflict,
} from "@/types";

const schema = z
  .object({
    start_date: z.string().min(1, "La fecha de inicio es obligatoria"),
    end_date: z.string().min(1, "La fecha de fin es obligatoria"),
    reason: z.string().max(500).optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio",
    path: ["end_date"],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created: Blocking[]) => void;
}

export function CreateBlockingDialog({ open, onOpenChange, onSuccess }: Props) {
  const [types, setTypes] = useState<AccommodationType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [units, setUnits] = useState<AccommodationUnit[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [conflicts, setConflicts] = useState<BlockingConflict[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: "", end_date: "", reason: "" },
  });

  // Cargar tipos de alojamiento al abrir
  useEffect(() => {
    if (!open) return;
    setConflicts(null);
    setServerError(null);
    setSelectedTypeId("");
    setSelectedUnitIds(new Set());
    reset();

    accommodationsApi
      .listTypes()
      .then((r) => setTypes(r.data))
      .catch(() => {});
  }, [open, reset]);

  // Cargar unidades cuando cambia el tipo seleccionado
  useEffect(() => {
    if (!selectedTypeId) {
      setUnits([]);
      setSelectedUnitIds(new Set());
      return;
    }
    setLoadingUnits(true);
    accommodationsApi
      .getType(selectedTypeId)
      .then((r) => {
        const activeUnits = r.data.units.filter(
          (u: AccommodationUnit) => u.is_active,
        );
        setUnits(activeUnits);
        setSelectedUnitIds(new Set());
      })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  }, [selectedTypeId]);

  const toggleUnit = (id: string) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUnitIds.size === units.length) {
      setSelectedUnitIds(new Set());
    } else {
      setSelectedUnitIds(new Set(units.map((u) => u.id)));
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    setConflicts(null);
    setServerError(null);

    if (selectedUnitIds.size === 0) {
      setServerError("Selecciona al menos una unidad para bloquear.");
      return;
    }

    try {
      const result = await blockingsApi.create({
        unit_ids: Array.from(selectedUnitIds),
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || null,
      });
      onSuccess(result.data);
      onOpenChange(false);
    } catch (error: unknown) {
      const apiError = error as {
        response?: {
          data?: {
            error?: {
              code?: string;
              message?: string;
              conflicts?: BlockingConflict[];
            };
          };
        };
      };
      const errBody = apiError.response?.data?.error;
      if (errBody?.code === "BLOCKING_CONFLICT" && errBody.conflicts) {
        setConflicts(errBody.conflicts);
      } else {
        setServerError(
          errBody?.message ?? "Error al crear el bloqueo. Inténtalo de nuevo.",
        );
      }
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    confirmed: "Confirmada",
    pending_payment: "Pago pendiente",
    checked_in: "En casa",
    cancelled: "Cancelada",
    checked_out: "Checkout",
    no_show: "No show",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Bloqueo</DialogTitle>
          <DialogDescription>
            Bloquea una o varias unidades durante un rango de fechas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de alojamiento */}
          <div className="space-y-1.5">
            <Label>
              Tipo de alojamiento <span className="text-red-500">*</span>
            </Label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2"
            >
              <option value="">Selecciona un tipo...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unidades */}
          {selectedTypeId && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Unidades <span className="text-red-500">*</span>
                </Label>
                {units.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-klyp-accent underline"
                  >
                    {selectedUnitIds.size === units.length
                      ? "Deseleccionar todas"
                      : "Seleccionar todas"}
                  </button>
                )}
              </div>
              {loadingUnits ? (
                <p className="text-xs text-klyp-gray">Cargando unidades...</p>
              ) : units.length === 0 ? (
                <p className="text-xs text-klyp-gray">
                  No hay unidades activas en este tipo.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-md border border-klyp-pale bg-white p-2 space-y-1">
                  {units.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-klyp-pale/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnitIds.has(u.id)}
                        onChange={() => toggleUnit(u.id)}
                        className="h-4 w-4 rounded border-klyp-pale accent-klyp-accent"
                      />
                      <span className="text-sm text-klyp-text-dark">
                        {u.name}
                      </span>
                      <span className="text-xs text-klyp-gray ml-auto">
                        {u.capacity} pers.
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {selectedUnitIds.size > 0 && (
                <p className="text-xs text-klyp-gray">
                  {selectedUnitIds.size} unidad(es) seleccionada(s)
                </p>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">
                Fecha inicio <span className="text-red-500">*</span>
              </Label>
              <Input
                id="block-start"
                type="date"
                {...register("start_date")}
                aria-invalid={!!errors.start_date}
              />
              {errors.start_date && (
                <p className="text-xs text-red-600">
                  {errors.start_date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">
                Fecha fin <span className="text-red-500">*</span>
              </Label>
              <Input
                id="block-end"
                type="date"
                {...register("end_date")}
                aria-invalid={!!errors.end_date}
              />
              {errors.end_date && (
                <p className="text-xs text-red-600">
                  {errors.end_date.message}
                </p>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Motivo (uso interno)</Label>
            <Input
              id="block-reason"
              placeholder="Ej: Mantenimiento, Uso propio..."
              {...register("reason")}
            />
          </div>

          {/* Error genérico */}
          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          {/* Conflictos de reservas */}
          {conflicts && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">
                  No se puede crear el bloqueo. Existen reservas activas en ese
                  periodo:
                </p>
              </div>
              {conflicts.map((conflict) => (
                <div key={conflict.unit_id} className="space-y-1">
                  <p className="text-xs font-semibold text-red-800">
                    {conflict.unit_name}
                  </p>
                  {conflict.reservations.map((res) => (
                    <div
                      key={res.id}
                      className="rounded bg-white/70 px-2 py-1.5 text-xs text-red-700 grid grid-cols-[1fr_auto_auto] gap-2"
                    >
                      <span className="font-medium truncate">
                        {res.guest_name}
                      </span>
                      <span>
                        {res.check_in} &rarr; {res.check_out}
                      </span>
                      <span className="text-klyp-gray">
                        {STATUS_LABEL[res.status] ?? res.status}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
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
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedTypeId ||
                selectedUnitIds.size === 0
              }
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crear Bloqueo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
