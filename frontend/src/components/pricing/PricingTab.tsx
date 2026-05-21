"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PricingModelForm } from "@/components/pricing/PricingModelForm";
import { SeasonTable } from "@/components/pricing/SeasonTable";
import { ExtraPricesTable } from "@/components/pricing/ExtraPricesTable";
import { PriceRuleDialog } from "@/components/pricing/PriceRuleDialog";
import { pricingApi, accommodationsApi } from "@/lib/api";
import type {
  AccommodationPriceRule,
  Extra,
  ExtraPrice,
  PricingModelWithExtras,
  Season,
} from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PricingTabProps {
  typeId: string;
  /** Extras del tenant (cargados en la página padre) */
  extras: Extra[];
  canManage: boolean;
}

/**
 * Tab de configuración de precios de un AccommodationType.
 *
 * Secciones:
 * 1. Reglas de precio por temporada — tramos MM-DD con tarifa propia
 * 2. Precio base — modelo de precio base (unidad o parcela/persona)
 * 3. Temporadas — rangos de fecha con precios distintos
 * 4. Precio de extras — tabla editable de precios por extra
 */
export function PricingTab({
  typeId,
  extras,
  canManage,
}: PricingTabProps) {
  const [pricingModel, setPricingModel] =
    useState<PricingModelWithExtras | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reglas de precio por temporada (nuevo sistema Block 5)
  const [priceRules, setPriceRules] = useState<AccommodationPriceRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccommodationPriceRule | undefined>(undefined);
  const [ruleServerError, setRuleServerError] = useState<string | null>(null);

  const fetchPricingModel = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await pricingApi.getModel(typeId);
      setPricingModel(response.data ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        setPricingModel(null);
      } else {
        setLoadError("No se pudo cargar la configuración de precios.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [typeId]);

  const fetchPriceRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const response = await accommodationsApi.listPriceRules(typeId);
      setPriceRules(response.data);
    } catch {
      // Silencioso — la sección simplemente quedará vacía
    } finally {
      setRulesLoading(false);
    }
  }, [typeId]);

  useEffect(() => {
    void fetchPricingModel();
    void fetchPriceRules();
  }, [fetchPricingModel, fetchPriceRules]);

  const handleModelSaved = (model: PricingModelWithExtras) => {
    setPricingModel(model);
  };

  const handleSeasonsChange = (seasons: Season[]) => {
    if (pricingModel) {
      setPricingModel({ ...pricingModel, seasons });
    }
  };

  const handleExtraPricesChange = (extraPrices: ExtraPrice[]) => {
    if (pricingModel) {
      setPricingModel({ ...pricingModel, extra_prices: extraPrices });
    }
  };

  const openCreateRule = () => {
    setEditingRule(undefined);
    setRuleServerError(null);
    setIsRuleDialogOpen(true);
  };

  const openEditRule = (rule: AccommodationPriceRule) => {
    setEditingRule(rule);
    setRuleServerError(null);
    setIsRuleDialogOpen(true);
  };

  const handleRuleSubmit = async (data: {
    name: string;
    date_from: string;
    date_to: string;
    price_per_night: number;
    min_nights: number;
    priority: number;
  }) => {
    setRuleServerError(null);
    try {
      if (editingRule) {
        const response = await accommodationsApi.updatePriceRule(
          typeId,
          editingRule.id,
          data,
        );
        setPriceRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? response.data : r)),
        );
      } else {
        const response = await accommodationsApi.createPriceRule(typeId, data);
        setPriceRules((prev) => [...prev, response.data]);
      }
      setIsRuleDialogOpen(false);
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      setRuleServerError(
        apiError.response?.data?.error?.message ??
          "Error al guardar la regla. Inténtalo de nuevo.",
      );
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("¿Eliminar esta regla de precio?")) return;
    try {
      await accommodationsApi.deletePriceRule(typeId, ruleId);
      setPriceRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {
      // Error silenciado — el usuario puede reintentar
    }
  };

  const currency = pricingModel?.currency ?? "EUR";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          onClick={() => void fetchPricingModel()}
          className="mt-2 text-xs text-klyp-accent underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Sección: Reglas de precio por temporada (Block 5) ─── */}
      <section>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-klyp-navy">
              Reglas de precio por temporada
            </h2>
            <p className="mt-1 text-sm text-klyp-gray">
              Tramos de fechas (MM-DD) con tarifa propia. En solapamientos
              prevalece la regla de mayor prioridad.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openCreateRule} className="shrink-0 min-h-[36px]">
              <Plus className="mr-2 h-4 w-4" />
              Nueva regla
            </Button>
          )}
        </div>

        {rulesLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : priceRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-10 text-center">
            <DollarSign className="h-7 w-7 text-klyp-pale" />
            <p className="mt-3 text-sm font-medium text-klyp-navy">
              Sin reglas de precio
            </p>
            <p className="mt-1 text-xs text-klyp-gray">
              Crea una regla para definir tarifas por temporada.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Precio/noche</TableHead>
                  <TableHead>Mín. noches</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium text-klyp-navy">
                      {rule.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-klyp-gray">
                      {rule.date_from}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-klyp-gray">
                      {rule.date_to}
                    </TableCell>
                    <TableCell className="font-semibold text-klyp-navy">
                      {Number(rule.price_per_night).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-sm text-klyp-gray">
                      {rule.min_nights === 1
                        ? "—"
                        : `${rule.min_nights} noches`}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-klyp-pale text-klyp-text-dark text-xs">
                        {rule.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          rule.is_active
                            ? "text-xs font-medium text-green-600"
                            : "text-xs font-medium text-amber-600"
                        }
                      >
                        {rule.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-klyp-gray hover:text-klyp-accent"
                            onClick={() => openEditRule(rule)}
                            aria-label={`Editar ${rule.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-klyp-gray hover:text-red-600"
                            onClick={() => void handleDeleteRule(rule.id)}
                            aria-label={`Eliminar ${rule.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Separator />

      {/* ─── Sección: Precio base (sistema legacy Sprint 3) ─── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-klyp-accent" />
          <h2 className="text-base font-semibold text-klyp-navy">
            Precio base
          </h2>
        </div>
        <div className="rounded-lg border border-klyp-pale bg-white p-5 shadow-sm">
          {!pricingModel && (
            <p className="mb-4 text-sm text-klyp-gray">
              Este tipo no tiene precios base configurados todavía.
            </p>
          )}
          <PricingModelForm
            typeId={typeId}
            pricingModel={pricingModel}
            onSaved={handleModelSaved}
          />
        </div>
      </section>

      {pricingModel && (
        <>
          <Separator />

          {/* ─── Sección: Temporadas ─── */}
          <section>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-klyp-navy">
                Temporadas
              </h2>
              <p className="text-sm text-klyp-gray mt-1">
                Define rangos de fechas con precios distintos. En caso de
                solapamiento, prevalece la temporada con mayor prioridad.
              </p>
            </div>
            <SeasonTable
              typeId={typeId}
              seasons={pricingModel.seasons}
              currency={currency}
              canManage={canManage}
              onSeasonsChange={handleSeasonsChange}
            />
          </section>

          <Separator />
          <section>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-klyp-navy">
                Precio de extras
              </h2>
              <p className="text-sm text-klyp-gray mt-1">
                Configura el precio por noche de cada extra disponible.
                Precio 0 significa incluido sin coste adicional.
              </p>
            </div>
            <ExtraPricesTable
              typeId={typeId}
              extras={extras.filter((e) => e.is_active)}
              extraPrices={pricingModel.extra_prices}
              currency={currency}
              canManage={canManage}
              onExtraPricesChange={handleExtraPricesChange}
            />
          </section>
        </>
      )}

      {/* Dialog crear/editar regla */}
      <PriceRuleDialog
        open={isRuleDialogOpen}
        onOpenChange={setIsRuleDialogOpen}
        rule={editingRule}
        onSubmit={handleRuleSubmit}
        serverError={ruleServerError}
      />
    </div>
  );
}
