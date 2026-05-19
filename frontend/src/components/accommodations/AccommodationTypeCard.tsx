"use client";

import Link from "next/link";
import { Building2, ChevronRight, Home, Tent } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AccommodationType } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

interface AccommodationTypeCardProps {
  accommodationType: AccommodationType;
}

const CATEGORY_ICONS = {
  parcela: Tent,
  apartamento: Home,
  albergue: Building2,
} as const;

export function AccommodationTypeCard({
  accommodationType,
}: AccommodationTypeCardProps) {
  const Icon = CATEGORY_ICONS[accommodationType.type_category] ?? Building2;
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
              <Icon className="h-5 w-5 text-klyp-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-klyp-navy truncate group-hover:text-klyp-accent transition-colors">
                {accommodationType.name}
              </h3>
              <Badge
                className={cn(
                  "mt-1 text-xs",
                  CATEGORY_COLORS[accommodationType.type_category],
                )}
              >
                {CATEGORY_LABELS[accommodationType.type_category]}
              </Badge>
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
