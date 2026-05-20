"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Download, X, Send, RotateCcw, Plus, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { billingApi } from "@/lib/api";
import type { Invoice, InvoiceStatus } from "@/types";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatCurrency(value: string): string {
  return parseFloat(value).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

// ─── Modal factura manual ─────────────────────────────────────────────────────

function ManualInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (inv: Invoice) => void;
}) {
  const [form, setForm] = useState({
    recipient_name: "",
    recipient_nif: "",
    recipient_address: "",
    recipient_email: "",
    payment_method_name: "",
    line_description: "",
    line_qty: "1",
    line_price_net: "",
    line_iva_rate: "10",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.recipient_name || !form.line_description || !form.line_price_net) {
      setError("Completa el receptor, descripción y precio de la línea.");
      return;
    }
    const qty = parseFloat(form.line_qty) || 1;
    const unitNet = parseFloat(form.line_price_net) || 0;
    const ivaRate = parseFloat(form.line_iva_rate) || 0;
    const lineNet = qty * unitNet;
    const ivaAmount = +(lineNet * ivaRate / 100).toFixed(2);
    const lineTotal = +(lineNet + ivaAmount).toFixed(2);

    const lines = [{
      description: form.line_description,
      quantity: qty,
      unit_price_net: unitNet.toFixed(2),
      iva_rate: ivaRate.toFixed(2),
      iva_amount: ivaAmount.toFixed(2),
      line_total_net: lineNet.toFixed(2),
      line_total_with_iva: lineTotal.toFixed(2),
    }];

    setSaving(true); setError(null);
    try {
      const res = await billingApi.createManualInvoice({
        recipient_name: form.recipient_name,
        recipient_nif: form.recipient_nif || null,
        recipient_address: form.recipient_address || null,
        recipient_email: form.recipient_email || null,
        payment_method_name: form.payment_method_name || null,
        lines,
      });
      onCreated(res.data);
      onOpenChange(false);
      setForm({
        recipient_name: "", recipient_nif: "", recipient_address: "", recipient_email: "",
        payment_method_name: "", line_description: "", line_qty: "1", line_price_net: "", line_iva_rate: "10",
      });
    } catch {
      setError("No se pudo crear la factura.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nueva Factura Manual</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-klyp-gray">Factura sin reserva asociada — cliente directo.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Receptor *</Label>
              <Input value={form.recipient_name} onChange={(e) => setForm((p) => ({ ...p, recipient_name: e.target.value }))} placeholder="Nombre completo o empresa" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF/CIF</Label>
              <Input value={form.recipient_nif} onChange={(e) => setForm((p) => ({ ...p, recipient_nif: e.target.value }))} placeholder="12345678A" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.recipient_email} onChange={(e) => setForm((p) => ({ ...p, recipient_email: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.recipient_address} onChange={(e) => setForm((p) => ({ ...p, recipient_address: e.target.value }))} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Línea de factura</p>
            <div className="space-y-1">
              <Label className="text-xs">Descripción *</Label>
              <Input value={form.line_description} onChange={(e) => setForm((p) => ({ ...p, line_description: e.target.value }))} placeholder="Concepto del servicio" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" min="1" value={form.line_qty} onChange={(e) => setForm((p) => ({ ...p, line_qty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio neto *</Label>
                <Input type="number" min="0" step="0.01" value={form.line_price_net} onChange={(e) => setForm((p) => ({ ...p, line_price_net: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA %</Label>
                <select
                  value={form.line_iva_rate}
                  onChange={(e) => setForm((p) => ({ ...p, line_iva_rate: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="0">0%</option>
                  <option value="4">4%</option>
                  <option value="10">10%</option>
                  <option value="21">21%</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Método de pago (opcional)</Label>
            <Input value={form.payment_method_name} onChange={(e) => setForm((p) => ({ ...p, payment_method_name: e.target.value }))} placeholder="Transferencia, Efectivo…" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Creando…" : "Crear Factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

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
  const [showManual, setShowManual] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await billingApi.listInvoices({
        page, page_size: PAGE_SIZE,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setInvoices(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      setLoadError("No se pudieron cargar las facturas.");
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  const handleStatusChange = (value: StatusFilter) => { setStatusFilter(value); setPage(1); };

  const handleAction = async (id: string, action: "cancel" | "sent" | "credit-note") => {
    setActionLoading(id + action);
    try {
      let updated: Invoice;
      if (action === "cancel") updated = (await billingApi.cancelInvoice(id)).data;
      else if (action === "sent") updated = (await billingApi.markInvoiceSent(id)).data;
      else updated = (await billingApi.createCreditNote(id)).data;

      if (action === "credit-note") {
        // Añadir la nota de crédito al listado y actualizar la original
        setInvoices((prev) =>
          [updated, ...prev.map((inv) => inv.id === id ? { ...inv, status: "cancelled" as InvoiceStatus } : inv)]
        );
      } else {
        setInvoices((prev) => prev.map((inv) => inv.id === id ? updated : inv));
      }
    } catch { /* silencioso */ }
    finally { setActionLoading(null); }
  };

  const downloadPdf = (id: string, number: string) => {
    const url = `${API_URL}/api/v1/billing/invoices/${id}/pdf`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${number}.pdf`;
    link.click();
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
            {!loading && total > 0 && <>{total} factura{total !== 1 ? "s" : ""} en total.</>}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button onClick={() => setShowManual(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white h-10 gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
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
            Las facturas se emiten desde el detalle de cada reserva o aquí manualmente.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Nº Factura</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Receptor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray hidden sm:table-cell">Base Imp.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray hidden sm:table-cell">IVA</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray hidden lg:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const busy = actionLoading?.startsWith(inv.id) ?? false;
                  return (
                    <tr key={inv.id} className={`hover:bg-gray-50 transition-colors ${inv.status === "cancelled" ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-klyp-navy text-xs whitespace-nowrap">
                        {inv.invoice_number}
                        {inv.is_credit_note && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-normal">RECT</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-klyp-text-dark">{inv.recipient_name}</td>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-klyp-gray text-xs hidden lg:table-cell">
                        {formatDate(inv.issued_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Descargar PDF */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Descargar PDF"
                            onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>

                          {/* Marcar como enviada */}
                          {inv.status === "issued" && !inv.is_credit_note && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Marcar como enviada"
                              disabled={busy}
                              onClick={() => void handleAction(inv.id, "sent")}
                            >
                              {busy && actionLoading === inv.id + "sent"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Send className="h-3.5 w-3.5" />}
                            </Button>
                          )}

                          {/* Factura rectificativa */}
                          {(inv.status === "issued" || inv.status === "sent") && !inv.is_credit_note && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-amber-600 border-amber-200 hover:bg-amber-50"
                                  title="Emitir nota de crédito"
                                  disabled={busy}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Emitir factura rectificativa?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se generará una nota de crédito (RECT) con importes negativos
                                    y la factura <strong>{inv.invoice_number}</strong> quedará cancelada.
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={() => void handleAction(inv.id, "credit-note")}
                                  >
                                    Emitir rectificativa
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* Cancelar */}
                          {inv.status !== "cancelled" && inv.is_credit_note === false && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 border-red-200 hover:bg-red-50"
                                  title="Cancelar factura"
                                  disabled={busy}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Cancelar la factura {inv.invoice_number}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    La factura quedará marcada como cancelada. No se generará ningún documento adicional.
                                    Si necesitas rectificar los importes usa la nota de crédito.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Volver</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => void handleAction(inv.id, "cancel")}
                                  >
                                    Cancelar factura
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-klyp-gray">Página {page} de {pages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs px-3 py-1.5 rounded border border-gray-200 text-klyp-gray hover:bg-gray-50 disabled:opacity-40 min-h-[36px]"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="text-xs px-3 py-1.5 rounded border border-gray-200 text-klyp-gray hover:bg-gray-50 disabled:opacity-40 min-h-[36px]"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ManualInvoiceDialog
        open={showManual}
        onOpenChange={setShowManual}
        onCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
      />
    </div>
  );
}
