"use client";

import type { PriceCalculationResult } from "@/types";

interface PriceBreakdownProps {
  result: PriceCalculationResult;
  /** Muestra el desglose de tramos de noches (útil en el wizard) */
  showBreakdown?: boolean;
}

/**
 * Tabla de desglose de precio de una reserva.
 * Reutilizable desde el wizard y la vista de detalle.
 */
export function PriceBreakdown({
  result,
  showBreakdown = true,
}: PriceBreakdownProps) {
  const formatPrice = (value: string) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: result.currency,
    }).format(parseFloat(value));

  return (
    <div className="space-y-3">
      {showBreakdown && result.breakdown.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-klyp-gray uppercase tracking-wide">
            Desglose por tramo
          </p>
          {result.breakdown.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="text-klyp-text-dark">
                <span className="font-medium">{item.nights} noche{item.nights !== 1 ? "s" : ""}</span>
                {item.season && (
                  <span className="ml-1.5 text-xs text-klyp-accent">
                    ({item.season})
                  </span>
                )}
                <p className="text-xs text-klyp-gray">{item.dates}</p>
              </div>
              <span className="text-klyp-text-dark whitespace-nowrap">
                {formatPrice(item.price_per_night.toString())} / noche
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-klyp-pale pt-3 space-y-1.5">
        <div className="flex justify-between text-sm text-klyp-text-dark">
          <span>
            Precio base ({result.nights} noche{result.nights !== 1 ? "s" : ""})
          </span>
          <span>{formatPrice(result.base_price.toString())}</span>
        </div>

        {parseFloat(result.extras_price.toString()) > 0 && (
          <div className="flex justify-between text-sm text-klyp-text-dark">
            <span>Extras</span>
            <span>{formatPrice(result.extras_price.toString())}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-semibold text-klyp-navy border-t border-klyp-pale pt-2 mt-2">
          <span>Total</span>
          <span>{formatPrice(result.total_price.toString())}</span>
        </div>
      </div>
    </div>
  );
}
