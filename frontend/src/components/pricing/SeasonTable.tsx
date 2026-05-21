"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateSeasonDialog } from "@/components/pricing/CreateSeasonDialog";
import { pricingApi } from "@/lib/api";
import { formatCurrency, extractApiErrorMessage } from "@/lib/utils";
import type { Season } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SeasonTableProps {
  typeId: string;
  seasons: Season[];
  currency: string;
  canManage: boolean;
  onSeasonsChange: (seasons: Season[]) => void;
}

/**
 * Tabla de temporadas de un AccommodationType.
 *
 * Incluye botones de crear, editar y eliminar (solo para canManage).
 * En móvil, las columnas de precio se ocultan para mantener legibilidad.
 * Los solapamientos de fechas se previenen en el backend.
 */
export function SeasonTable({
  typeId,
  seasons,
  currency,
  canManage,
  onSeasonsChange,
}: SeasonTableProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [seasonToEdit, setSeasonToEdit] = useState<Season | null>(null);

  const handleSeasonSaved = (season: Season) => {
    const existing = seasons.find((s) => s.id === season.id);
    if (existing) {
      onSeasonsChange(seasons.map((s) => (s.id === season.id ? season : s)));
    } else {
      onSeasonsChange([...seasons, season]);
    }
  };

  const handleEdit = (season: Season) => {
    setSeasonToEdit(season);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSeasonToEdit(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (seasonId: string) => {
    if (
      !confirm(
        "¿Eliminar esta temporada? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    try {
      await pricingApi.deleteSeason(typeId, seasonId);
      onSeasonsChange(seasons.filter((s) => s.id !== seasonId));
    } catch (error) {
      alert(extractApiErrorMessage(error));
    }
  };

  const formatPrice = (price: string | null) => {
    if (price === null || price === "") return "—";
    return formatCurrency(price, currency);
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const opts: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    };
    const start = new Date(startDate).toLocaleDateString("es-ES", opts);
    const end = new Date(endDate).toLocaleDateString("es-ES", opts);
    return `${start} – ${end}`;
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleCreate}
            className="min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir Temporada
          </Button>
        </div>
      )}

      {seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-10 text-center">
          <Calendar className="h-8 w-8 text-klyp-pale" />
          <p className="mt-3 text-sm font-medium text-klyp-navy">
            Sin temporadas configuradas
          </p>
          <p className="text-xs text-klyp-gray mt-1">
            Se aplicará el precio base en todas las fechas.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Fechas</TableHead>
                <TableHead className="hidden md:table-cell">
                  Unidad/noche
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Parcela/noche
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Persona/noche
                </TableHead>
                <TableHead>Activa</TableHead>
                {canManage && (
                  <TableHead className="w-20">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season) => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium text-klyp-navy">
                    {season.name}
                    <p className="sm:hidden text-xs text-klyp-gray mt-0.5">
                      {formatDateRange(season.start_date, season.end_date)}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-klyp-gray whitespace-nowrap">
                    {formatDateRange(season.start_date, season.end_date)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {formatPrice(season.unit_price_per_night)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {formatPrice(season.plot_price_per_night)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {formatPrice(season.person_price_per_night)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        season.is_active
                          ? "text-green-600 text-xs font-medium"
                          : "text-amber-600 text-xs font-medium"
                      }
                    >
                      {season.is_active ? "Sí" : "No"}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-klyp-gray hover:text-klyp-accent"
                          onClick={() => handleEdit(season)}
                          aria-label={`Editar temporada ${season.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-klyp-gray hover:text-red-600"
                          onClick={() => void handleDelete(season.id)}
                          aria-label={`Eliminar temporada ${season.name}`}
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

      <CreateSeasonDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        typeId={typeId}
        seasonToEdit={seasonToEdit}
        onSuccess={handleSeasonSaved}
      />
    </div>
  );
}
