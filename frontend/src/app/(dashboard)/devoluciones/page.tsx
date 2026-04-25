"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefundOrderTable } from "@/components/cancellations/RefundOrderTable";
import { ProcessRefundDialog } from "@/components/cancellations/ProcessRefundDialog";
import { cancellationsApi } from "@/lib/api";
import type { RefundOrder, RefundOrderStatus } from "@/types";

const STATUS_FILTERS: Array<{ value: RefundOrderStatus | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "processed", label: "Procesadas" },
  { value: "rejected", label: "Rechazadas" },
];

export default function DevolucionesPage() {
  const [orders, setOrders] = useState<RefundOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RefundOrderStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Diálogo para procesar/rechazar
  const [selectedOrder, setSelectedOrder] = useState<RefundOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await cancellationsApi.listRefundOrders({
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        page_size: 20,
      });
      setOrders(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      setLoadError("No se pudieron cargar las órdenes de devolución.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Resetear página al cambiar filtro
  const handleFilterChange = (filter: RefundOrderStatus | "all") => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleOrderUpdated = (updated: RefundOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o)),
    );
    setSelectedOrder(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Devoluciones</h1>
          <p className="mt-0.5 text-sm text-klyp-gray">
            Órdenes de reembolso generadas al cancelar reservas.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchOrders()}
          className="min-h-[44px]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value as RefundOrderStatus | "all")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
              statusFilter === f.value
                ? "bg-klyp-navy text-white"
                : "bg-klyp-pale text-klyp-text-dark hover:bg-klyp-pale/70"
            }`}
          >
            {f.label}
          </button>
        ))}
        {total > 0 && (
          <span className="ml-2 self-center text-sm text-klyp-gray">
            {total} órdenes
          </span>
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {loadError}
        </div>
      ) : (
        <RefundOrderTable
          orders={orders}
          onProcess={(order) => setSelectedOrder(order)}
        />
      )}

      {/* Paginación */}
      {pages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-[36px]"
          >
            Anterior
          </Button>
          <span className="text-sm text-klyp-gray">
            Página {page} de {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="min-h-[36px]"
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Diálogo de procesado */}
      {selectedOrder && (
        <ProcessRefundDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => {
            if (!open) setSelectedOrder(null);
          }}
          onSuccess={handleOrderUpdated}
        />
      )}
    </div>
  );
}
