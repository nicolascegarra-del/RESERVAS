"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservationTable } from "@/components/reservations/ReservationTable";
import { OccupancyCalendar } from "@/components/reservations/OccupancyCalendar";
import { reservationsApi } from "@/lib/api";
import type { Reservation, ReservationStatus } from "@/types";
import { RESERVATION_STATUS_LABELS } from "@/types";

const PAGE_SIZE = 20;

interface Filters {
  status: ReservationStatus | "";
  date_from: string;
  date_to: string;
  search: string;
}

type Tab = "lista" | "calendario";

export default function ReservasPage() {
  const [tab, setTab] = useState<Tab>("lista");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    status: "",
    date_from: "",
    date_to: "",
    search: "",
  });

  const fetchReservations = useCallback(
    async (page: number, activeFilters: Filters) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await reservationsApi.list({
          status: activeFilters.status || undefined,
          date_from: activeFilters.date_from || undefined,
          date_to: activeFilters.date_to || undefined,
          search: activeFilters.search || undefined,
          page,
          page_size: PAGE_SIZE,
        });
        setReservations(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
        setCurrentPage(page);
      } catch {
        setLoadError("No se pudieron cargar las reservas. Inténtalo de nuevo.");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchReservations(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchReservations(1, filters);
  };

  const handleFilterReset = () => {
    const empty: Filters = { status: "", date_from: "", date_to: "", search: "" };
    setFilters(empty);
    void fetchReservations(1, empty);
  };

  const statusOptions: Array<{ value: ReservationStatus | ""; label: string }> = [
    { value: "", label: "Todos los estados" },
    ...(Object.entries(RESERVATION_STATUS_LABELS) as Array<[ReservationStatus, string]>).map(
      ([value, label]) => ({ value, label }),
    ),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Reservas</h1>
          <p className="mt-1 text-sm text-klyp-gray">
            {isLoading && tab === "lista" ? "Cargando..." : `${total} reserva${total !== 1 ? "s" : ""} en total`}
          </p>
        </div>
        <Link href="/reservas/nueva">
          <Button className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Nueva reserva
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-klyp-pale p-1 w-fit">
        <button
          onClick={() => setTab("lista")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[36px] ${
            tab === "lista"
              ? "bg-white text-klyp-navy shadow-sm"
              : "text-klyp-gray hover:text-klyp-navy"
          }`}
        >
          <List className="h-4 w-4" />
          Lista
        </button>
        <button
          onClick={() => setTab("calendario")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[36px] ${
            tab === "calendario"
              ? "bg-white text-klyp-navy shadow-sm"
              : "text-klyp-gray hover:text-klyp-navy"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Calendario
        </button>
      </div>

      {/* Vista Lista */}
      {tab === "lista" && (
        <>
          {/* Filtros */}
          <form
            onSubmit={handleFilterSubmit}
            className="flex flex-col gap-3 rounded-lg border border-klyp-pale bg-white p-4 sm:flex-row sm:items-end sm:flex-wrap"
          >
            <div className="flex-1 space-y-1.5 min-w-0 sm:min-w-[200px]">
              <Label htmlFor="filter-search">Buscar</Label>
              <Input
                id="filter-search"
                type="text"
                placeholder="Nombre, email o nº reserva..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <Label htmlFor="filter-status">Estado</Label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value as ReservationStatus | "" }))
                }
                className="flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klyp-accent"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <Label htmlFor="filter-date-from">Entrada desde</Label>
              <Input
                id="filter-date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
              />
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <Label htmlFor="filter-date-to">Entrada hasta</Label>
              <Input
                id="filter-date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="outline"
                className="border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 min-h-[44px]"
              >
                Filtrar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleFilterReset}
                className="text-klyp-gray hover:text-klyp-text-dark min-h-[44px]"
              >
                Limpiar
              </Button>
            </div>
          </form>

          {loadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <ReservationTable reservations={reservations} />
          )}

          {!isLoading && pages > 1 && (
            <div className="flex items-center justify-between text-sm text-klyp-gray">
              <span>Página {currentPage} de {pages}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => void fetchReservations(currentPage - 1, filters)}
                  className="min-h-[44px]"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pages}
                  onClick={() => void fetchReservations(currentPage + 1, filters)}
                  className="min-h-[44px]"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {!isLoading && reservations.length === 0 && !loadError && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-20 text-center">
              <CalendarDays className="mb-4 h-12 w-12 text-klyp-pale" />
              <h3 className="text-lg font-semibold text-klyp-navy">No hay reservas todavía</h3>
              <p className="mt-1 text-sm text-klyp-gray">Crea la primera reserva para comenzar.</p>
              <Link href="/reservas/nueva" className="mt-4">
                <Button className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva reserva
                </Button>
              </Link>
            </div>
          )}
        </>
      )}

      {/* Vista Calendario */}
      {tab === "calendario" && <OccupancyCalendar />}
    </div>
  );
}
