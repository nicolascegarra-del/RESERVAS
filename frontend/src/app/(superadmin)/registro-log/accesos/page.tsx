"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, CheckCircle, XCircle, ChevronLeft, ChevronRight, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { accessLogsApi } from "@/lib/api";
import type { AccessLog } from "@/lib/api";

const PAGE_SIZE = 50;
const STORAGE_KEY = "table_cols_access_logs";

const EVENT_LABELS: Record<string, string> = {
  login_success: "Login Exitoso",
  login_failure: "Login Fallido",
  logout: "Logout",
};

const EVENT_COLORS: Record<string, string> = {
  login_success: "bg-green-100 text-green-800",
  login_failure: "bg-red-100 text-red-800",
  logout: "bg-gray-100 text-gray-600",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Admin Empresa",
  reception: "Recepción",
};

type ColKey = "evento" | "usuario" | "rol" | "ip" | "detalle" | "fecha";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "evento",  label: "Evento"  },
  { key: "usuario", label: "Usuario" },
  { key: "rol",     label: "Rol"     },
  { key: "ip",      label: "IP"      },
  { key: "detalle", label: "Detalle" },
  { key: "fecha",   label: "Fecha"   },
];

const DEFAULT_COLS = new Set<ColKey>(ALL_COLS.map((c) => c.key));

function EventIcon({ type }: { type: string }) {
  if (type === "login_success") return <CheckCircle className="h-4 w-4 text-green-600" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

export default function AccessLogsPage() {
  const [items, setItems] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [clearing, setClearing] = useState(false);

  // ─── Columnas persistentes ─────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_COLS);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setVisibleCols(new Set(JSON.parse(stored) as ColKey[]));
    } catch { /* ignora datos corruptos */ }
  }, []);

  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const col = (k: ColKey) => visibleCols.has(k);
  const colSpan = visibleCols.size;

  // ─── Datos ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p: number, ef: string, email: string) => {
    setLoading(true);
    try {
      const resp = await accessLogsApi.listAll({
        page: p,
        page_size: PAGE_SIZE,
        ...(ef !== "all" ? { event_type: ef } : {}),
        ...(email ? { user_email: email } : {}),
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

  useEffect(() => { void load(1, eventFilter, emailSearch); }, [load, eventFilter, emailSearch]);

  function handleEventChange(v: string) { setEventFilter(v); setPage(1); }
  function handleEmailSearch() { setEmailSearch(emailInput); setPage(1); }
  function handlePage(p: number) { setPage(p); void load(p, eventFilter, emailSearch); }

  async function handleClear() {
    setClearing(true);
    try {
      await accessLogsApi.deleteAll();
      void load(1, eventFilter, emailSearch);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-klyp-accent" />
            Log de Accesos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registro de logins al sistema — {total} entradas
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(page, eventFilter, emailSearch)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={clearing || total === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Vaciar logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Vaciar todos los logs de acceso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente los {total} registros de acceso de todos los usuarios. Esta acción no se puede deshacer.
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={eventFilter} onValueChange={handleEventChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los eventos</SelectItem>
            <SelectItem value="login_success">Login Exitoso</SelectItem>
            <SelectItem value="login_failure">Login Fallido</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 flex-1 sm:max-w-xs">
          <Input
            placeholder="Buscar por email..."
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSearch()}
            className="text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleEmailSearch} className="shrink-0">
            Buscar
          </Button>
        </div>

        {/* Selector de columnas */}
        <div className="relative ml-auto" ref={colMenuRef}>
          <Button variant="outline" size="sm" className="h-[44px] gap-2" onClick={() => setShowColMenu((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Columnas
          </Button>
          {showColMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                    className="rounded"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {col("evento")  && <th className="text-left px-4 py-3 font-medium text-gray-600">Evento</th>}
                {col("usuario") && <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>}
                {col("rol")     && <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>}
                {col("ip")      && <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>}
                {col("detalle") && <th className="text-left px-4 py-3 font-medium text-gray-600">Detalle</th>}
                {col("fecha")   && <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-400">Cargando…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-400">
                    No hay registros de acceso
                  </td>
                </tr>
              )}
              {!loading && items.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  {col("evento") && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EventIcon type={log.event_type} />
                        <Badge className={`text-xs ${EVENT_COLORS[log.event_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {EVENT_LABELS[log.event_type] ?? log.event_type}
                        </Badge>
                      </div>
                    </td>
                  )}
                  {col("usuario") && <td className="px-4 py-3 font-medium text-gray-800">{log.user_email}</td>}
                  {col("rol") && (
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.user_role ? (ROLE_LABELS[log.user_role] ?? log.user_role) : "—"}
                    </td>
                  )}
                  {col("ip") && (
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.ip_address ?? "—"}</td>
                  )}
                  {col("detalle") && (
                    <td className="px-4 py-3 text-gray-400 text-xs">{log.detail ?? "—"}</td>
                  )}
                  {col("fecha") && (
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.accessed_at).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  )}
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
