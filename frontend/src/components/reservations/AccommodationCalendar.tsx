"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, TrendingUp, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reservationsApi, type CalendarDay, type CalendarMonth } from "@/lib/api";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAYS_ES = ["L", "M", "X", "J", "V", "S", "D"];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "confirmed", label: "Confirmada" },
  { value: "pending_payment", label: "Pago pendiente" },
  { value: "checked_in", label: "En casa" },
  { value: "checked_out", label: "Checkout" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No show" },
];

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-emerald-500",
  pending_payment: "bg-yellow-400",
  checked_in: "bg-blue-500",
  checked_out: "bg-purple-400",
  cancelled: "bg-gray-300",
  no_show: "bg-orange-400",
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  pending_payment: "bg-yellow-100 text-yellow-800",
  checked_in: "bg-blue-100 text-blue-800",
  checked_out: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-orange-100 text-orange-700",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmada",
  pending_payment: "Pago pendiente",
  checked_in: "En casa",
  checked_out: "Checkout",
  cancelled: "Cancelada",
  no_show: "No show",
};

function occupancyBg(pct: number) {
  if (pct === 0) return "bg-white";
  if (pct < 30) return "bg-emerald-50";
  if (pct < 60) return "bg-yellow-50";
  if (pct < 85) return "bg-orange-50";
  return "bg-red-50";
}

function occupancyText(pct: number) {
  if (pct === 0) return "text-gray-400";
  if (pct < 30) return "text-emerald-700";
  if (pct < 60) return "text-yellow-700";
  if (pct < 85) return "text-orange-700";
  return "text-red-700";
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

interface Props {
  accommodationTypeId?: string;
}

export function AccommodationCalendar({ accommodationTypeId }: Props) {
  const router = useRouter();
  const now = new Date();
  const todayIso = now.toISOString().split("T")[0]!;

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const load = useCallback(async (y: number, m: number, status: string) => {
    setLoading(true);
    setLoadError(null);
    setSelectedDay(null);
    try {
      const res = await reservationsApi.getCalendar(y, m, {
        accommodationTypeId: accommodationTypeId,
        status: status || undefined,
      });
      setData(res.data);
    } catch {
      setLoadError("No se pudo cargar el calendario.");
    } finally {
      setLoading(false);
    }
  }, [accommodationTypeId]);

  useEffect(() => { void load(year, month, statusFilter); }, [year, month, statusFilter, load]);

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const buildGrid = (days: CalendarDay[]) => {
    if (!days.length) return [];
    const first = days[0]!.weekday;
    const grid: (CalendarDay | null)[] = [...Array(first).fill(null), ...days];
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  };

  const grid = data ? buildGrid(data.days) : [];

  return (
    <div className="space-y-4">
      {/* Header: nav + filtro estado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prev} className="min-h-[36px] min-w-[36px] p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-klyp-navy w-40 text-center text-sm">
            {MONTHS_ES[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={next} className="min-h-[36px] min-w-[36px] p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); }}
            className="text-xs text-klyp-accent hover:bg-klyp-accent/10 min-h-[36px]"
          >
            Hoy
          </Button>
        </div>

        {/* Filtro estado */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-klyp-pale bg-white px-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {data && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-klyp-pale px-2.5 py-1">
            <TrendingUp className="h-3 w-3 text-klyp-accent" />
            <span className="text-klyp-gray">Ocup. media</span>
            <strong className="text-klyp-navy">{data.avg_occupancy_pct}%</strong>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-klyp-pale px-2.5 py-1">
            <LogIn className="h-3 w-3 text-emerald-600" />
            <span className="text-klyp-gray">Entradas</span>
            <strong className="text-klyp-navy">{data.total_check_ins}</strong>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-klyp-pale px-2.5 py-1">
            <span className="text-klyp-gray">Reservas activas</span>
            <strong className="text-klyp-navy">{data.total_reservations}</strong>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-klyp-pale px-2.5 py-1">
            <span className="text-klyp-gray">Ingresos</span>
            <strong className="text-klyp-navy">{data.total_revenue.toLocaleString("es-ES", { minimumFractionDigits: 0 })} €</strong>
          </span>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      {/* Grid */}
      <div className="rounded-xl border border-klyp-pale bg-white overflow-visible">
        <div className="grid grid-cols-7 border-b border-klyp-pale bg-klyp-pale/50">
          {DAYS_ES.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-klyp-gray">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-klyp-gray gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-klyp-accent border-t-transparent" />
            Cargando...
          </div>
        ) : (
          <div className="grid grid-cols-7 divide-x divide-y divide-klyp-pale/60">
            {grid.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="min-h-[80px] bg-klyp-pale/20" />;
              const isToday = day.date === todayIso;
              const isSelected = selectedDay?.date === day.date;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={[
                    "min-h-[80px] p-1.5 text-left transition-all cursor-pointer",
                    occupancyBg(day.occupancy_pct),
                    isSelected ? "ring-2 ring-inset ring-klyp-accent" : "hover:brightness-95",
                  ].join(" ")}
                >
                  <span className={[
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-klyp-accent text-white" : "text-klyp-navy",
                  ].join(" ")}>
                    {new Date(day.date + "T00:00:00").getDate()}
                  </span>

                  {day.occupied_units > 0 && (
                    <div className={`text-xs font-bold mt-0.5 ${occupancyText(day.occupancy_pct)}`}>
                      {day.occupancy_pct}%
                    </div>
                  )}

                  {day.reservations.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {day.reservations.slice(0, 5).map(r => (
                        <span key={r.id} className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status] ?? "bg-gray-300"}`} />
                      ))}
                    </div>
                  )}

                  {(day.check_ins > 0 || day.check_outs > 0) && (
                    <div className="mt-0.5 text-xs">
                      {day.check_ins > 0 && <span className="text-emerald-700 font-medium">↓{day.check_ins}</span>}
                      {day.check_outs > 0 && <span className="text-blue-700 font-medium ml-0.5">↑{day.check_outs}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel detalle del día */}
      {selectedDay && (
        <div className="rounded-xl border border-klyp-pale bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-klyp-navy text-sm capitalize">
              {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("es-ES", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="text-klyp-gray hover:text-klyp-navy text-lg">×</button>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-klyp-gray">
              Ocupación: <strong className={occupancyText(selectedDay.occupancy_pct)}>
                {selectedDay.occupancy_pct}%
              </strong> ({selectedDay.occupied_units}/{selectedDay.total_units} uds.)
            </span>
            {selectedDay.check_ins > 0 && <span className="text-emerald-700">↓ {selectedDay.check_ins} entradas</span>}
            {selectedDay.check_outs > 0 && <span className="text-blue-700">↑ {selectedDay.check_outs} salidas</span>}
          </div>

          {selectedDay.reservations.length === 0 ? (
            <p className="text-sm text-klyp-gray py-2">Sin reservas este día con el filtro aplicado.</p>
          ) : (
            <div className="space-y-2">
              {selectedDay.reservations.map(r => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/reservas/${r.id}`)}
                  className="flex items-center gap-3 text-sm border border-klyp-pale rounded-lg px-3 py-2 cursor-pointer hover:bg-klyp-pale/30 transition-colors"
                >
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[r.status] ?? "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-klyp-navy">{r.guest_name}</span>
                    <span className="text-klyp-gray ml-2 text-xs">
                      {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {r.nights}n · {r.num_persons} pax
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  {r.total_price != null && (
                    <span className="text-klyp-navy font-medium text-xs shrink-0">{r.total_price.toFixed(0)} €</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-klyp-gray">
        <span className="font-medium">Ocupación:</span>
        {[
          { color: "bg-white border border-gray-200", label: "0%" },
          { color: "bg-emerald-100", label: "< 30%" },
          { color: "bg-yellow-100", label: "30–60%" },
          { color: "bg-orange-100", label: "60–85%" },
          { color: "bg-red-100", label: "> 85%" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-5 rounded ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
