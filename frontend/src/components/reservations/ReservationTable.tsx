"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservationStatusBadge } from "./ReservationStatusBadge";
import { Badge } from "@/components/ui/badge";
import type { DocStatus, Reservation } from "@/types";
import { DOC_STATUS_COLORS, DOC_STATUS_LABELS } from "@/types";

interface ReservationTableProps {
  reservations: Reservation[];
  isLoading?: boolean;
  /** Mapa reservation_id → estado de documentación de viajeros. */
  docStatusMap?: Record<string, DocStatus>;
}

/** Formatea una fecha "YYYY-MM-DD" a "DD/MM/YYYY" para la UI. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Formatea un precio decimal (string) a moneda local. */
function formatPrice(value: string, currency: string): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(parseFloat(value));
}

/**
 * Tabla de reservas del tenant.
 *
 * Columnas: Huésped | Tipo/Unidad | Fechas | Noches | Total | Estado | Acciones
 * En móvil muestra scroll horizontal para no colapsar la tabla.
 */
export function ReservationTable({
  reservations,
  isLoading = false,
  docStatusMap,
}: ReservationTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-klyp-gray">
        <p className="text-sm">No hay reservas que mostrar.</p>
        <p className="mt-1 text-xs">
          Crea una nueva reserva con el botón superior.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-klyp-pale">
      <Table>
        <TableHeader>
          <TableRow className="bg-klyp-pale/50">
            <TableHead className="whitespace-nowrap">Huésped</TableHead>
            <TableHead className="whitespace-nowrap">Unidad</TableHead>
            <TableHead className="whitespace-nowrap">Entrada</TableHead>
            <TableHead className="whitespace-nowrap">Salida</TableHead>
            <TableHead className="whitespace-nowrap text-right">Noches</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap">Docs</TableHead>
            <TableHead className="whitespace-nowrap sr-only">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => {
            const docStatus = docStatusMap?.[reservation.id];
            return (
            <TableRow key={reservation.id} className="hover:bg-klyp-pale/30">
              <TableCell className="whitespace-nowrap">
                <div>
                  <p className="font-medium text-klyp-text-dark text-sm">
                    {reservation.guest_name}
                  </p>
                  <p className="text-xs text-klyp-gray">{reservation.guest_email}</p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-klyp-text-dark">
                {/* La API no devuelve nombre del tipo/unidad — mostramos ID abreviado */}
                <span className="font-mono text-xs text-klyp-gray">
                  {reservation.unit_id.slice(0, 8)}…
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-klyp-text-dark">
                {formatDate(reservation.check_in)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-klyp-text-dark">
                {formatDate(reservation.check_out)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-right text-klyp-text-dark">
                {reservation.nights}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-right font-medium text-klyp-text-dark">
                {formatPrice(reservation.total_price, reservation.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <ReservationStatusBadge status={reservation.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {docStatus ? (
                  <Badge className={DOC_STATUS_COLORS[docStatus]}>
                    {DOC_STATUS_LABELS[docStatus]}
                  </Badge>
                ) : (
                  <span className="text-xs text-klyp-gray">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Link href={`/reservas/${reservation.id}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-klyp-gray hover:text-klyp-accent"
                    aria-label={`Ver detalle de reserva de ${reservation.guest_name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
