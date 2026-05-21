"use client";

import { useState } from "react";
import { Building2, Users, Moon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicTypeAvailability } from "@/lib/publicApi";
import { BookingModal } from "@/components/booking/BookingModal";

interface AccommodationResultCardProps {
  result: PublicTypeAvailability;
  nights: number;
  checkIn: string;
  checkOut: string;
  numPersons: number;
  accentColor?: string;
  tenantSlug: string;
}

export function AccommodationResultCard({
  result,
  nights,
  checkIn,
  checkOut,
  numPersons,
  accentColor = "#2E6DB4",
  tenantSlug,
}: AccommodationResultCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const availableUnits = result.available_units.filter((u) => u.is_available);

  const totalPrice = result.price_preview
    ? parseFloat(result.price_preview.total_price)
    : null;

  const pricePerNight = result.min_price_per_night
    ? parseFloat(result.min_price_per_night)
    : null;

  const formatEur = (value: number) =>
    value.toLocaleString("es-ES", {
      style: "currency",
      currency: result.price_preview?.currency ?? "EUR",
      minimumFractionDigits: 2,
    });

  return (
    <>
    <Card className="flex flex-col overflow-hidden border border-klyp-pale shadow-sm hover:shadow-md transition-shadow">
      {/* Header de color */}
      <div className="h-2" style={{ backgroundColor: accentColor }} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-klyp-pale text-klyp-text-dark">
              <Building2 className="h-4 w-4" />
              Alojamiento
            </span>
          </div>
          <span className="shrink-0 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {availableUnits.length} disponible{availableUnits.length !== 1 ? "s" : ""}
          </span>
        </div>

        <CardTitle className="mt-2 text-lg font-semibold text-klyp-navy leading-tight">
          {result.type_name}
        </CardTitle>

        {result.description && (
          <p className="mt-1 text-sm text-klyp-gray line-clamp-2">
            {result.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4">
        {/* Capacidad */}
        <div className="flex items-center gap-1.5 text-sm text-klyp-text-dark">
          <Users className="h-4 w-4 text-klyp-accent shrink-0" />
          <span>
            Capacidad:{" "}
            {result.min_capacity === result.max_capacity
              ? `${result.min_capacity} persona${result.min_capacity !== 1 ? "s" : ""}`
              : `${result.min_capacity}–${result.max_capacity} personas`}
          </span>
        </div>

        {/* Unidades disponibles */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-klyp-gray uppercase tracking-wide">
            Unidades disponibles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableUnits.map((unit) => (
              <span
                key={unit.unit_id}
                className="inline-flex items-center gap-1 rounded-md bg-klyp-pale px-2 py-0.5 text-xs text-klyp-text-dark"
              >
                {unit.unit_name}
                <span className="text-klyp-gray">· {unit.capacity}p</span>
              </span>
            ))}
          </div>
        </div>

        {/* Precio */}
        <div className="mt-auto pt-3 border-t border-klyp-pale">
          {pricePerNight !== null ? (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-klyp-gray">Desde</p>
                <p className="text-2xl font-bold text-klyp-navy">
                  {formatEur(pricePerNight)}
                  <span className="text-sm font-normal text-klyp-gray"> / noche</span>
                </p>
                {totalPrice !== null && nights > 0 && (
                  <p className="flex items-center gap-1 text-xs text-klyp-gray mt-0.5">
                    <Moon className="h-3 w-3" />
                    {nights} noche{nights !== 1 ? "s" : ""} · Total {formatEur(totalPrice)}
                  </p>
                )}
              </div>

              <Button
                className="shrink-0 min-h-[44px] text-white"
                style={{ backgroundColor: accentColor }}
                onClick={() => setModalOpen(true)}
              >
                Reservar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-klyp-gray italic">Precio a consultar</p>
              <Button
                className="shrink-0 min-h-[44px] text-white"
                style={{ backgroundColor: accentColor }}
                onClick={() => setModalOpen(true)}
              >
                Reservar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <BookingModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      result={result}
      checkIn={checkIn}
      checkOut={checkOut}
      nights={nights}
      numPersons={numPersons}
      accentColor={accentColor}
      tenantSlug={tenantSlug}
    />
    </>
  );
}
