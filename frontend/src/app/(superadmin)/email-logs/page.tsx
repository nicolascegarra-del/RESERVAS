"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail, RefreshCw, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Trash2, Eye, SlidersHorizontal, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { mailLogsApi } from "@/lib/api";
import type { MailLog } from "@/types";
import {
  MAIL_LOG_STATUS_LABELS,
  MAIL_LOG_STATUS_COLORS,
  MAIL_LOG_EMAIL_TYPE_LABELS,
  MAIL_LOG_SMTP_SOURCE_LABELS,
} from "@/types";

const PAGE_SIZE = 50;

type ColKey = "to_email" | "subject" | "email_type" | "smtp_source" | "sent_at";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "to_email",    label: "Destinatario" },
  { key: "subject",     label: "Asunto" },
  { key: "email_type",  label: "Tipo" },
  { key: "smtp_source", label: "SMTP" },
  { key: "sent_at",     label: "Fecha" },
];

function StatusIcon({ status }: { status: MailLog["status"] }) {
  if (status === "sent") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertCircle className="h-4 w-4 text-gray-400" />;
}

export default function SuperAdminMailLogsPage() {
  const [items, setItems] = useState<MailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [previewLog, setPreviewLog] = useState<MailLog | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set<ColKey>(["to_email", "subject", "email_type", "smtp_source", "sent_at"])
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colMenuOpen]);

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const load = useCallback(async (p: number, sf: string, tf: string) => {
    setLoading(true);
    try {
      const resp = await mailLogsApi.listAll({
        page: p,
        page_size: PAGE_SIZE,
        ...(sf !== "all" ? { status: sf } : {}),
        ...(tf !== "all" ? { email_type: tf } : {}),
      });
      setItems(resp.data.items);
      setTotal(resp.data.total);
      setPages(resp.data.pages);
      setPage(resp.data.page);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1, statusFilter, typeFilter); }, [load, statusFilter, typeFilter]);

  function handleStatusChange(v: string) { setStatusFilter(v); setPage(1); }
  function handleTypeChange(v: string) { setTypeFilter(v); setPage(1); }
  function handlePage(p: number) { setPage(p); void load(p, statusFilter, typeFilter); }

  async function handleClear() {
    setClearing(true);
    try {
      await mailLogsApi.deleteAll();
      void load(1, statusFilter, typeFilter);
    } finally {
      setClearing(false);
    }
  }

  const colSpan = 1 + visibleCols.size + 1; // status + visible + eye

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-klyp-accent" />
            Log de Emails
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Todos los emails enviados por el sistema — {total} registros
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(page, statusFilter, typeFilter)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={clearing || total === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Vaciar Logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Vaciar todos los logs de email?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente los {total} registros de email de todas las empresas. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => void handleClear()}
                >
                  Sí, vaciar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Filters + column chooser */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="failed">Error</SelectItem>
            <SelectItem value="no_smtp">Sin SMTP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="confirmation">Confirmación</SelectItem>
            <SelectItem value="reminder">Recordatorio</SelectItem>
            <SelectItem value="test">Prueba</SelectItem>
            <SelectItem value="guest_docs_request">Docs. viajeros</SelectItem>
          </SelectContent>
        </Select>

        {/* Column chooser */}
        <div className="relative ml-auto" ref={colMenuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColMenuOpen(v => !v)}
            className={colMenuOpen ? "border-klyp-accent text-klyp-accent" : ""}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Columnas
          </Button>
          {colMenuOpen && (
            <div className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-gray-200 bg-white shadow-md py-1">
              {ALL_COLS.map(({ key, label }) => (
                <button
                  key={key}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => toggleCol(key)}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${visibleCols.has(key) ? "border-klyp-accent bg-klyp-accent" : "border-gray-300"}`}>
                    {visibleCols.has(key) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email preview dialog */}
      <Dialog open={!!previewLog} onOpenChange={(open) => { if (!open) setPreviewLog(null); }}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-800 truncate pr-6">
              {previewLog?.subject}
            </DialogTitle>
            <p className="text-xs text-gray-500">Para: {previewLog?.to_email}</p>
          </DialogHeader>
          <div className="border border-gray-200 rounded-md overflow-hidden" style={{ height: 480 }}>
            {previewLog?.body_html && (
              <iframe
                srcDoc={previewLog.body_html}
                sandbox="allow-same-origin"
                className="w-full h-full"
                title="Vista previa del email"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                {visibleCols.has("to_email")    && <th className="text-left px-4 py-3 font-medium text-gray-600">Destinatario</th>}
                {visibleCols.has("subject")     && <th className="text-left px-4 py-3 font-medium text-gray-600">Asunto</th>}
                {visibleCols.has("email_type")  && <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>}
                {visibleCols.has("smtp_source") && <th className="text-left px-4 py-3 font-medium text-gray-600">SMTP</th>}
                {visibleCols.has("sent_at")     && <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>}
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={colSpan} className="px-4 py-12 text-center text-gray-400">Cargando…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={colSpan} className="px-4 py-12 text-center text-gray-400">No hay registros de email</td></tr>
              )}
              {!loading && items.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={log.status} />
                      <Badge className={`text-xs ${MAIL_LOG_STATUS_COLORS[log.status]}`}>
                        {MAIL_LOG_STATUS_LABELS[log.status]}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={log.error_message}>
                        {log.error_message}
                      </p>
                    )}
                  </td>
                  {visibleCols.has("to_email") && (
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{log.to_email}</span>
                    </td>
                  )}
                  {visibleCols.has("subject") && (
                    <td className="px-4 py-3 text-gray-600 max-w-[260px] truncate">{log.subject}</td>
                  )}
                  {visibleCols.has("email_type") && (
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {MAIL_LOG_EMAIL_TYPE_LABELS[log.email_type]}
                      </Badge>
                    </td>
                  )}
                  {visibleCols.has("smtp_source") && (
                    <td className="px-4 py-3 text-gray-500 text-xs">{MAIL_LOG_SMTP_SOURCE_LABELS[log.smtp_source]}</td>
                  )}
                  {visibleCols.has("sent_at") && (
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {log.body_html && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-klyp-accent"
                        onClick={() => setPreviewLog(log)}
                        title="Ver contenido"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Página {page} de {pages} · {total} registros
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => handlePage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
