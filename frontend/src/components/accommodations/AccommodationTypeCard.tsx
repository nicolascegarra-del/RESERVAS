"use client";

import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import type { AccommodationType } from "@/types";

interface AccommodationTypeCardProps {
  accommodationType: AccommodationType;
}

export function AccommodationTypeCard({
  accommodationType,
}: AccommodationTypeCardProps) {
  const unitCount = accommodationType.active_unit_count ?? 0;

  return (
    <Link
      href={`/alojamientos/${accommodationType.id}`}
      className="group block rounded-lg bg-white border border-klyp-pale shadow-sm hover:shadow-md hover:border-klyp-accent/40 transition-all duration-200"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-klyp-pale">
              <Building2 className="h-5 w-5 text-klyp-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-klyp-navy truncate group-hover:text-klyp-accent transition-colors">
                {accommodationType.name}
              </h3>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-klyp-gray/50 group-hover:text-klyp-accent transition-colors mt-1" />
        </div>

        {/* Descripción */}
        {accommodationType.description && (
          <p className="mt-3 text-sm text-klyp-gray line-clamp-2">
            {accommodationType.description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-klyp-pale pt-3">
          <span className="text-sm text-klyp-gray">
            <span className="font-semibold text-klyp-navy">{unitCount}</span>{" "}
            {unitCount === 1 ? "unidad activa" : "unidades activas"}
          </span>
          {!accommodationType.is_active && (
            <span className="text-xs text-amber-600 font-medium">Inactivo</span>
          )}
        </div>
      </div>
    </Link>
  );
}
