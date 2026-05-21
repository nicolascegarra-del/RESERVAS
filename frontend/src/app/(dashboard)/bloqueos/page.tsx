"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateBlockingDialog } from "@/components/blockings/CreateBlockingDialog";
import { blockingsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { Blocking } from "@/types";

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function BloqueosPag() {
  const [blockings, setBlockings] = useState<Blocking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "company_admin" || user?.role === "super_admin";

  const fetchBlockings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const r = await blockingsApi.list();
      setBlockings(r.data);
    } catch {
      setLoadError("No se pudieron cargar los bloqueos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlockings();
  }, [fetchBlockings]);

  const handleCreated = (created: Blocking[]) => {
    setBlockings((prev) => [...created, ...prev]);
  };

  const handleDelete = async (blockingId: string) => {
    if (
      !confirm(
        "¿Eliminar este bloqueo? La unidad quedará disponible para esas fechas.",
      )
    ) {
      return;
    }
    try {
      await blockingsApi.delete(blockingId);
      setBlockings((prev) => prev.filter((b) => b.id !== blockingId));
    } catch {
      // El usuario puede reintentar
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Bloqueos</h1>
          <p className="mt-1 text-sm text-klyp-gray">
            Bloquea unidades de alojamiento durante rangos de fechas para
            impedir reservas.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="min-h-[44px] sm:self-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Bloqueo
          </Button>
        )}
      </div>

      {/* Cargando */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void fetchBlockings()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Vacío */}
      {!isLoading && !loadError && blockings.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-16 text-center">
          <Ban className="h-12 w-12 text-klyp-pale" />
          <h3 className="mt-4 text-lg font-semibold text-klyp-navy">
            Sin bloqueos activos
          </h3>
          <p className="mt-1 text-sm text-klyp-gray">
            No hay ningún bloqueo de unidades configurado.
          </p>
          {canManage && (
            <Button
              className="mt-6 min-h-[44px]"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Bloqueo
            </Button>
          )}
        </div>
      )}

      {/* Tabla */}
      {!isLoading && !loadError && blockings.length > 0 && (
        <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidad</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead className="hidden md:table-cell">Motivo</TableHead>
                {canManage && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-klyp-navy">
                    {b.unit_name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-klyp-gray">
                    {b.type_name}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(b.start_date)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(b.end_date)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-klyp-gray max-w-xs truncate">
                    {b.reason ?? "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-klyp-gray hover:text-red-600"
                        onClick={() => void handleDelete(b.id)}
                        aria-label="Eliminar bloqueo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateBlockingDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreated}
      />
    </div>
  );
}
