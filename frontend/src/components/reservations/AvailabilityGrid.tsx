"use client";

import { Users, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitAvailability } from "@/types";

interface AvailabilityGridProps {
  units: UnitAvailability[];
  selectedUnitId: string | null;
  onSelectUnit: (unit: UnitAvailability) => void;
  numPersons?: number;
}

/**
 * Grid de unidades disponibles / no disponibles para el wizard de reservas.
 * Las unidades verdes son seleccionables; las grises están ocupadas.
 * Solo muestra unidades con capacidad >= numPersons (filtrado en backend).
 */
export function AvailabilityGrid({
  units,
  selectedUnitId,
  onSelectUnit,
  numPersons,
}: AvailabilityGridProps) {
  const availableCount = units.filter((u) => u.is_available).length;

  if (units.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center space-y-2">
        <p className="text-base font-semibold text-klyp-navy">No hay disponibilidad</p>
        <p className="text-sm text-klyp-gray">
          {numPersons && numPersons > 1
            ? `No existe ningún alojamiento con capacidad para ${numPersons} personas en las fechas seleccionadas.`
            : "No hay alojamientos disponibles para las fechas seleccionadas."}
        </p>
        <p className="text-xs text-klyp-gray/70">Lo sentimos. Prueba con otras fechas o un número de personas menor.</p>
      </div>
    );
  }

  if (availableCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 px-6 py-12 text-center space-y-2">
        <p className="text-base font-semibold text-klyp-navy">Sin disponibilidad en esas fechas</p>
        <p className="text-sm text-klyp-gray">
          Todos los alojamientos con capacidad suficiente están ocupados en el periodo seleccionado.
        </p>
        <p className="text-xs text-klyp-gray/70">Prueba con otras fechas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-klyp-gray">
        {availableCount} de {units.length} unidad{units.length !== 1 ? "es" : ""} disponible{availableCount !== 1 ? "s" : ""}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {units.map((unit) => {
          const isSelected = selectedUnitId === unit.unit_id;

          return (
            <button
              key={unit.unit_id}
              type="button"
              disabled={!unit.is_available}
              onClick={() => unit.is_available && onSelectUnit(unit)}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all min-h-[44px]",
                unit.is_available
                  ? isSelected
                    ? "border-klyp-accent bg-klyp-accent/10 shadow-md"
                    : "border-klyp-pale bg-white hover:border-klyp-accent/50 hover:shadow-sm cursor-pointer"
                  : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-70",
              )}
              aria-pressed={isSelected}
              aria-label={`${unit.unit_name} — ${unit.is_available ? "disponible" : "ocupada"}`}
            >
              {/* Indicador de disponibilidad */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    unit.is_available
                      ? "text-klyp-text-dark"
                      : "text-gray-400",
                  )}
                >
                  {unit.unit_name}
                </span>
                {unit.is_available ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </div>

              {/* Capacidad */}
              <div className="flex items-center gap-1.5 text-xs text-klyp-gray">
                <Users className="h-3.5 w-3.5" />
                <span>Capacidad: {unit.capacity} persona{unit.capacity !== 1 ? "s" : ""}</span>
              </div>

              {/* Etiqueta de estado */}
              <span
                className={cn(
                  "text-xs font-medium",
                  unit.is_available ? "text-green-600" : "text-gray-400",
                )}
              >
                {unit.is_available ? "Disponible" : "Ocupada"}
              </span>

              {/* Indicador de selección */}
              {isSelected && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-klyp-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
