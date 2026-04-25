"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PricingModelForm } from "@/components/pricing/PricingModelForm";
import { SeasonTable } from "@/components/pricing/SeasonTable";
import { ExtraPricesTable } from "@/components/pricing/ExtraPricesTable";
import { pricingApi } from "@/lib/api";
import type {
  AccommodationCategory,
  Extra,
  ExtraPrice,
  PricingModelWithExtras,
  Season,
} from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PricingTabProps {
  typeId: string;
  category: AccommodationCategory;
  /** Extras del tenant (cargados en la página padre) */
  extras: Extra[];
  canManage: boolean;
}

/**
 * Tab de configuración de precios de un AccommodationType.
 *
 * Secciones:
 * 1. Precio base — campos según categoría (apartment/cabin: unidad; camping: parcela + persona)
 * 2. Temporadas — tabla con CRUD completo
 * 3. Precio de extras — solo para camping, tabla editable
 */
export function PricingTab({
  typeId,
  category,
  extras,
  canManage,
}: PricingTabProps) {
  const [pricingModel, setPricingModel] =
    useState<PricingModelWithExtras | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPricingModel = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await pricingApi.getModel(typeId);
      setPricingModel(response.data ?? null);
    } catch (err: unknown) {
      // 404 = aún no hay modelo configurado — no es un error, es empty state
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

  useEffect(() => {
    void fetchPricingModel();
  }, [fetchPricingModel]);

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

  const isCamping = category === "camping";
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
      {/* ─── Sección: Precio base ─── */}
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
              Este tipo no tiene precios configurados todavía. Guarda los
              precios base para empezar.
            </p>
          )}
          <PricingModelForm
            typeId={typeId}
            category={category}
            pricingModel={pricingModel}
            onSaved={handleModelSaved}
          />
        </div>
      </section>

      {/* Solo mostrar temporadas y extras si ya hay pricing model */}
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
              category={category}
              seasons={pricingModel.seasons}
              currency={currency}
              canManage={canManage}
              onSeasonsChange={handleSeasonsChange}
            />
          </section>

          {/* ─── Sección: Precio de extras (solo camping) ─── */}
          {isCamping && (
            <>
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
        </>
      )}
    </div>
  );
}
