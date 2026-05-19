"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mailLogsApi } from "@/lib/api";
import type { MailLog } from "@/types";
import {
  MAIL_LOG_STATUS_LABELS,
  MAIL_LOG_STATUS_COLORS,
  MAIL_LOG_EMAIL_TYPE_LABELS,
  MAIL_LOG_SMTP_SOURCE_LABELS,
} from "@/types";

const PAGE_SIZE = 50;

function StatusIcon({ status }: { status: MailLog["status"] }) {
  if (status === "sent") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertCircle className="h-4 w-4 text-gray-400" />;
}

export default function MailLogsPage() {
  const [items, setItems] = useState<MailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async (p: number, sf: string, tf: string) => {
    setLoading(true);
    try {
      const resp = await mailLogsApi.listTenant({
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

  function handleStatusChange(v: string) {
    setStatusFilter(v);
    setPage(1);
  }
  function handleTypeChange(v: string) {
    setTypeFilter(v);
    setPage(1);
  }
  function handlePage(p: number) {
    setPage(p);
    void load(p, statusFilter, typeFilter);
  }

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
            Emails enviados por tu empresa — {total} registros
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(page, statusFilter, typeFilter)}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Destinatario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Asunto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">SMTP</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No hay registros de email
                  </td>
                </tr>
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
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{log.to_email}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 max-w-[260px] truncate">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {MAIL_LOG_EMAIL_TYPE_LABELS[log.email_type]}
                    </Badge>
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
              <Button
                variant="outline" size="sm"
                disabled={page <= 1}
                onClick={() => handlePage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={page >= pages}
                onClick={() => handlePage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
