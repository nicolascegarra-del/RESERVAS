"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { billingApi } from "@/lib/api";
import type { Invoice, InvoiceStatus } from "@/types";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: string): string {
  return parseFloat(value).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// ─── Filtros de estado ────────────────────────────────────────────────────────

type StatusFilter = "all" | InvoiceStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "issued", label: "Emitidas" },
  { value: "sent", label: "Enviadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "draft", label: "Borradores" },
];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await billingApi.listInvoices({
        page,
        page_size: PAGE_SIZE,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setInvoices(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      setLoadError("No se pudieron cargar las facturas. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  // Resetear a página 1 cuando cambia el filtro
  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Facturación
          </h1>
          <p className="mt-0.5 text-sm text-klyp-gray">
            Listado de facturas emitidas.{" "}
            {!loading && total > 0 && (
              <span>{total} factura{total !== 1 ? "s" : ""} en total.</span>
            )}
          </p>
        </div>

        {/* Filtro de estado */}
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-auto"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {loadError}
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-8 py-16 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-klyp-gray/40" />
          <p className="text-sm font-medium text-klyp-gray">No hay facturas.</p>
          <p className="text-xs text-klyp-gray/70 mt-1">
            Las facturas se emiten desde el detalle de cada reserva.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">
                    Nº Factura
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray hidden md:table-cell">
                    Reserva
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">
                    Receptor
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray hidden sm:table-cell">
                    Base Imp.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray hidden sm:table-cell">
                    IVA
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray hidden lg:table-cell">
                    Fecha emisión
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-klyp-navy text-xs">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-klyp-gray font-mono text-xs hidden md:table-cell">
                      {shortId(inv.reservation_id)}
                    </td>
                    <td className="px-4 py-3 font-medium text-klyp-text-dark">
                      {inv.recipient_name}
                    </td>
                    <td className="px-4 py-3 text-right text-klyp-text-dark tabular-nums hidden sm:table-cell">
                      {formatCurrency(inv.base_imponible)}
                    </td>
                    <td className="px-4 py-3 text-right text-klyp-gray tabular-nums hidden sm:table-cell">
                      {formatCurrency(inv.total_iva)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-klyp-navy tabular-nums">
                      {formatCurrency(inv.total_with_iva)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-klyp-gray text-xs hidden lg:table-cell">
                      {formatDate(inv.issued_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-klyp-gray">
                Página {page} de {pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs px-3 py-1.5 rounded border border-gray-200 text-klyp-gray hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="text-xs px-3 py-1.5 rounded border border-gray-200 text-klyp-gray hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
