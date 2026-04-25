"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pricingApi } from "@/lib/api";
import { formatCurrency, extractApiErrorMessage } from "@/lib/utils";
import type { Extra, ExtraPrice } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExtraPricesTableProps {
  typeId: string;
  extras: Extra[];
  extraPrices: ExtraPrice[];
  currency: string;
  canManage: boolean;
  onExtraPricesChange: (extraPrices: ExtraPrice[]) => void;
}

/**
 * Tabla de precios de extras para el pricing model de un AccommodationType.
 *
 * Muestra todos los extras del tenant con el precio actual (si existe).
 * Permite al admin editar el precio por noche de cada extra.
 * Solo se muestra para tipo camping según la especificación del Sprint 3.
 */
export function ExtraPricesTable({
  typeId,
  extras,
  extraPrices,
  currency,
  canManage,
  onExtraPricesChange,
}: ExtraPricesTableProps) {
  // Estado local de precios en edición: extra_id → valor string del input
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const ep of extraPrices) {
        initial[ep.extra_id] = ep.price_per_night;
      }
      return initial;
    },
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const getExtraPrice = (extraId: string): ExtraPrice | undefined =>
    extraPrices.find((ep) => ep.extra_id === extraId);

  const handlePriceChange = (extraId: string, value: string) => {
    setEditingPrices((prev) => ({ ...prev, [extraId]: value }));
  };

  const handleSave = async (extra: Extra) => {
    const priceStr = editingPrices[extra.id] ?? "";
    const priceNum = Number(priceStr);

    if (priceStr === "" || isNaN(priceNum) || priceNum < 0) {
      alert("Introduce un precio válido (número >= 0).");
      return;
    }

    setSavingIds((prev) => new Set(prev).add(extra.id));
    try {
      const response = await pricingApi.upsertExtraPrice(typeId, extra.id, {
        price_per_night: priceStr,
      });
      const newExtraPrice = response.data;

      const existing = getExtraPrice(extra.id);
      if (existing) {
        onExtraPricesChange(
          extraPrices.map((ep) =>
            ep.extra_id === extra.id ? newExtraPrice : ep,
          ),
        );
      } else {
        onExtraPricesChange([...extraPrices, newExtraPrice]);
      }
    } catch (error) {
      alert(extractApiErrorMessage(error));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(extra.id);
        return next;
      });
    }
  };

  const handleDelete = async (extra: Extra) => {
    const ep = getExtraPrice(extra.id);
    if (!ep) return;

    if (!confirm(`¿Eliminar el precio de "${extra.name}"?`)) return;

    try {
      await pricingApi.deleteExtraPrice(typeId, ep.id);
      onExtraPricesChange(extraPrices.filter((e) => e.id !== ep.id));
      setEditingPrices((prev) => {
        const next = { ...prev };
        delete next[extra.id];
        return next;
      });
    } catch (error) {
      alert(extractApiErrorMessage(error));
    }
  };

  if (extras.length === 0) {
    return (
      <p className="text-sm text-klyp-gray">
        No hay extras configurados para este tenant. Crea extras desde la
        pestaña Extras del tipo de alojamiento.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Extra</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Precio actual</TableHead>
            {canManage && (
              <>
                <TableHead>Nuevo precio / noche ({currency})</TableHead>
                <TableHead className="w-28">Acciones</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {extras.map((extra) => {
            const existingPrice = getExtraPrice(extra.id);
            const isSaving = savingIds.has(extra.id);

            return (
              <TableRow key={extra.id}>
                <TableCell className="font-medium text-klyp-navy">
                  {extra.name}
                </TableCell>
                <TableCell className="text-klyp-gray text-sm max-w-xs truncate">
                  {extra.description ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {existingPrice
                    ? formatCurrency(existingPrice.price_per_night, currency)
                    : (
                      <span className="text-klyp-gray text-xs italic">
                        Sin precio configurado
                      </span>
                    )}
                </TableCell>
                {canManage && (
                  <>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={editingPrices[extra.id] ?? ""}
                        onChange={(e) =>
                          handlePriceChange(extra.id, e.target.value)
                        }
                        className="w-28"
                        aria-label={`Precio de ${extra.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-klyp-gray hover:text-klyp-accent"
                          onClick={() => void handleSave(extra)}
                          disabled={isSaving}
                          aria-label={`Guardar precio de ${extra.name}`}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        {existingPrice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-klyp-gray hover:text-red-600"
                            onClick={() => void handleDelete(extra)}
                            disabled={isSaving}
                            aria-label={`Eliminar precio de ${extra.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
