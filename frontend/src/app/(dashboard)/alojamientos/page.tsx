"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccommodationTypeCard } from "@/components/accommodations/AccommodationTypeCard";
import { CreateTypeDialog } from "@/components/accommodations/CreateTypeDialog";
import { accommodationsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { AccommodationType } from "@/types";

export default function AlojamientosPage() {
  const [types, setTypes] = useState<AccommodationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const canManage =
    user?.role === "company_admin" || user?.role === "super_admin";

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await accommodationsApi.listTypes();
      setTypes(response.data);
    } catch {
      setLoadError("No se pudieron cargar los tipos de alojamiento. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTypes();
  }, [fetchTypes]);

  const handleTypeCreated = (newType: AccommodationType) => {
    setTypes((prev) => [newType, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Alojamientos</h1>
          <p className="mt-1 text-sm text-klyp-gray">
            Gestiona los tipos, unidades, características sin coste y extras del inventario.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="min-h-[44px] sm:self-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Tipo de Alojamiento
          </Button>
        )}
      </div>

      {/* Estado de carga */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-klyp-pale bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-2/3" />
              <div className="mt-4 border-t border-klyp-pale pt-3">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
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
            onClick={() => void fetchTypes()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !loadError && types.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-16 text-center">
          <Building2 className="h-12 w-12 text-klyp-pale" />
          <h3 className="mt-4 text-lg font-semibold text-klyp-navy">
            Sin tipos de alojamiento
          </h3>
          <p className="mt-1 text-sm text-klyp-gray">
            Crea el primer Tipo de Alojamiento para empezar a gestionar el inventario.
          </p>
          {canManage && (
            <Button
              className="mt-6 min-h-[44px]"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Tipo de Alojamiento
            </Button>
          )}
        </div>
      )}

      {/* Grid de tipos */}
      {!isLoading && !loadError && types.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((accommodationType) => (
            <AccommodationTypeCard
              key={accommodationType.id}
              accommodationType={accommodationType}
            />
          ))}
        </div>
      )}

      {/* Dialog crear tipo */}
      <CreateTypeDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleTypeCreated}
      />
    </div>
  );
}
