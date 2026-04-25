"use client";

import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/types";
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS } from "@/types";

interface ReservationStatusBadgeProps {
  status: ReservationStatus;
  className?: string;
}

/**
 * Badge de color para el estado de una reserva.
 * Usa los colores definidos en RESERVATION_STATUS_COLORS.
 */
export function ReservationStatusBadge({
  status,
  className,
}: ReservationStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        RESERVATION_STATUS_COLORS[status],
        className,
      )}
    >
      {RESERVATION_STATUS_LABELS[status]}
    </span>
  );
}
