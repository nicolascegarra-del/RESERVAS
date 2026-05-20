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
  const fmt = (value: string | number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: result.currency,
    }).format(parseFloat(String(value)));

  const totalIva = parseFloat(result.total_iva ?? "0");
  const totalWithIva = parseFloat(result.total_with_iva ?? "0");

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
                {fmt(item.price_per_night)} / noche
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
          <span>{fmt(result.base_price)}</span>
        </div>

        {parseFloat(result.extras_price) > 0 && (
          <div className="flex justify-between text-sm text-klyp-text-dark">
            <span>Extras</span>
            <span>{fmt(result.extras_price)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm font-medium text-klyp-navy border-t border-klyp-pale pt-2 mt-2">
          <span>Base imponible</span>
          <span>{fmt(result.total_price)}</span>
        </div>

        {/* Desglose de IVA por tipo */}
        {result.iva_breakdown && result.iva_breakdown.length > 0 && (
          <div className="space-y-1">
            {result.iva_breakdown.map((iva, i) => (
              <div key={i} className="flex justify-between text-sm text-klyp-gray">
                <span>IVA ({iva.rate}%)</span>
                <span>{fmt(iva.iva_amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between text-base font-bold text-klyp-navy border-t border-klyp-pale pt-2 mt-2">
          <span>Total con IVA</span>
          <span>{fmt(totalWithIva || parseFloat(result.total_price))}</span>
        </div>
        {totalIva > 0 && (
          <p className="text-xs text-klyp-gray text-right">
            IVA incluido: {fmt(totalIva)}
          </p>
        )}
      </div>
    </div>
  );
}
