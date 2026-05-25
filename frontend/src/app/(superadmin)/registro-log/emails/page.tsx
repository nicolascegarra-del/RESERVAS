"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail, RefreshCw, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Trash2, Eye,
  ChevronsUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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

type SortKey = "to_email" | "subject" | "email_type" | "smtp_source" | "sent_at" | "status";
type SortDir = "asc" | "desc";

function StatusIcon({ status }: { status: MailLog["status"] }) {
  if (status === "sent") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertCircle className="h-4 w-4 text-gray-400" />;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 ml-1 text-klyp-accent" />
    : <ChevronDown className="h-3.5 w-3.5 ml-1 text-klyp-accent" />;
}

function sortItems(items: MailLog[], key: SortKey | null, dir: SortDir): MailLog[] {
  if (!key) return items;
  return [...items].sort((a, b) => {
    let av: string = "", bv: string = "";
    if (key === "to_email") { av = a.to_email; bv = b.to_email; }
    else if (key === "subject") { av = a.subject; bv = b.subject; }
    else if (key === "email_type") { av = a.email_type; bv = b.email_type; }
    else if (key === "smtp_source") { av = a.smtp_source; bv = b.smtp_source; }
    else if (key === "status") { av = a.status; bv = b.status; }
    else if (key === "sent_at") { av = a.sent_at; bv = b.sent_at; }
    const cmp = av.localeCompare(bv, "es", { sensitivity: "base" });
    return dir === "asc" ? cmp : -cmp;
  });
}

export default function SuperAdminMailLogsPage() {
  const [items, setItems] = useState<MailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [clearing, setClearing] = useState(false);
  const [previewLog, setPreviewLog] = useState<MailLog | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handlePage(p: number) { setPage(p); void load(p, statusFilter, typeFilter); }

  async function handleClear() {
    setClearing(true);
    try {
      await mailLogsApi.deleteAll();
      void load(1, statusFilter, typeFilter);
    } finally { setClearing(false); }
  }

  const displayedItems = sortItems(
    recipientFilter
      ? items.filter((i) => i.to_email.toLowerCase().includes(recipientFilter.toLowerCase()))
      : items,
    sortKey,
    sortDir,
  );

  const thClass = "text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100";

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
          <Button variant="outline" size="sm" onClick={() => void load(page, statusFilter, typeFilter)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={clearing || total === 0}>
                <Trash2 className="h-4 w-4 mr-2" />Vaciar logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Vaciar todos los logs de email?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente los {total} registros. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleClear()}>
                  Sí, vaciar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
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
        <div className="flex gap-2 flex-1 sm:max-w-xs">
          <Input
            placeholder="Buscar destinatario..."
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setRecipientFilter(recipientInput); }}
            className="text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => setRecipientFilter(recipientInput)} className="shrink-0">
            Buscar
          </Button>
          {recipientFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setRecipientFilter(""); setRecipientInput(""); }} className="shrink-0">
              ✕
            </Button>
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
            {previewLog?.body_html ? (
              <iframe
                srcDoc={previewLog.body_html}
                sandbox="allow-same-origin"
                className="w-full h-full"
                title="Vista previa del email"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No hay contenido HTML para este email.
              </div>
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
                <th className={thClass} onClick={() => handleSort("status")}>
                  <span className="inline-flex items-center">Estado<SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("to_email")}>
                  <span className="inline-flex items-center">Destinatario<SortIcon col="to_email" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort("subject")}>
                  <span className="inline-flex items-center">Asunto<SortIcon col="subject" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("email_type")}>
                  <span className="inline-flex items-center">Tipo<SortIcon col="email_type" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={`${thClass} hidden lg:table-cell`} onClick={() => handleSort("smtp_source")}>
                  <span className="inline-flex items-center">SMTP<SortIcon col="smtp_source" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("sent_at")}>
                  <span className="inline-flex items-center">Fecha<SortIcon col="sent_at" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Cargando…</td></tr>
              )}
              {!loading && displayedItems.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No hay registros de email</td></tr>
              )}
              {!loading && displayedItems.map((log) => (
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
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{log.to_email}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 max-w-[260px] truncate">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{MAIL_LOG_EMAIL_TYPE_LABELS[log.email_type]}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {MAIL_LOG_SMTP_SOURCE_LABELS[log.smtp_source]}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleString("es-ES", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-klyp-accent"
                      onClick={() => setPreviewLog(log)}
                      title="Ver contenido"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
