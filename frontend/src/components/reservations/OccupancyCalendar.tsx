"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  LogIn,
  Euro,
  CalendarDays,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { reservationsApi, type CalendarDay, type CalendarMonth } from "@/lib/api";

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAYS_ES_MIN = ["L", "M", "X", "J", "V", "S", "D"];

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; row: string }> = {
  confirmed:       { label: "Confirmada",      dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800", row: "bg-emerald-50 border-emerald-200" },
  pending_payment: { label: "Pago pendiente",  dot: "bg-yellow-400",  badge: "bg-yellow-100 text-yellow-800",  row: "bg-yellow-50  border-yellow-200"  },
  checked_in:      { label: "En casa",         dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-800",      row: "bg-blue-50   border-blue-200"      },
  checked_out:     { label: "Checkout",        dot: "bg-purple-400",  badge: "bg-purple-100 text-purple-800",  row: "bg-purple-50 border-purple-200"    },
  cancelled:       { label: "Cancelada",       dot: "bg-gray-300",    badge: "bg-gray-100   text-gray-500",    row: "bg-gray-50   border-gray-200"      },
  no_show:         { label: "No show",         dot: "bg-orange-400",  badge: "bg-orange-100 text-orange-700",  row: "bg-orange-50 border-orange-200"    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function occupancyBg(pct: number): string {
  if (pct === 0)   return "bg-white";
  if (pct < 30)    return "bg-emerald-50";
  if (pct < 60)    return "bg-yellow-50";
  if (pct < 85)    return "bg-orange-50";
  return "bg-red-50";
}

function occupancyText(pct: number): string {
  if (pct === 0)   return "text-gray-400";
  if (pct < 30)    return "text-emerald-700";
  if (pct < 60)    return "text-yellow-700";
  if (pct < 85)    return "text-orange-700";
  return "text-red-700";
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0]!;
}

function isoWeekStart(iso: string): string {
  // Returns Monday of the week containing `iso`
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0]!;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? "bg-gray-300"}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${cfg?.badge ?? "bg-gray-100 text-gray-600"}`}>
      {cfg?.label ?? status}
    </span>
  );
}

interface ReservationRowProps {
  r: CalendarDay["reservations"][number];
  onClick?: () => void;
}

function ReservationRow({ r, onClick }: ReservationRowProps) {
  const cfg = STATUS_CONFIG[r.status];
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer hover:opacity-80 transition-opacity ${cfg?.row ?? "bg-gray-50 border-gray-200"}`}
    >
      <StatusDot status={r.status} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-klyp-navy truncate">{r.guest_name}</p>
        <p className="text-xs text-klyp-gray">
          {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {r.nights} noche{r.nights !== 1 ? "s" : ""} · {r.num_persons} pax
        </p>
      </div>
      <StatusBadge status={r.status} />
    </div>
  );
}

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function KpiBar({ data }: { data: CalendarMonth }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <div className="flex items-center gap-1.5 rounded-lg bg-klyp-pale px-3 py-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-klyp-accent" />
        <span className="text-klyp-gray">Ocup. media</span>
        <span className="font-semibold text-klyp-navy">{data.avg_occupancy_pct}%</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-klyp-pale px-3 py-1.5">
        <LogIn className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-klyp-gray">Check-ins</span>
        <span className="font-semibold text-klyp-navy">{data.total_check_ins}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-klyp-pale px-3 py-1.5">
        <Users className="h-3.5 w-3.5 text-klyp-accent" />
        <span className="text-klyp-gray">Reservas activas</span>
        <span className="font-semibold text-klyp-navy">{data.total_reservations}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-klyp-pale px-3 py-1.5">
        <Euro className="h-3.5 w-3.5 text-klyp-accent" />
        <span className="text-klyp-gray">Ingresos</span>
        <span className="font-semibold text-klyp-navy">
          {data.total_revenue.toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
        </span>
      </div>
    </div>
  );
}

// ─── Vista mensual ────────────────────────────────────────────────────────────

interface MonthViewProps {
  data: CalendarMonth;
  today: string;
  onDaySelect: (day: CalendarDay) => void;
  selectedDate: string | null;
}

function MonthView({ data, today, onDaySelect, selectedDate }: MonthViewProps) {
  const buildGrid = (days: CalendarDay[]) => {
    if (!days.length) return [];
    const firstWeekday = days[0]!.weekday; // 0=lunes
    const grid: (CalendarDay | null)[] = [...Array(firstWeekday).fill(null), ...days];
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  };

  const grid = buildGrid(data.days);

  return (
    <div className="rounded-xl border border-klyp-pale bg-white overflow-visible">
      {/* Cabecera días semana */}
      <div className="grid grid-cols-7 border-b border-klyp-pale">
        {DAYS_ES_MIN.map((d, i) => (
          <div key={i} className="py-2 text-center text-xs font-semibold text-klyp-gray">{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 divide-x divide-y divide-klyp-pale/60">
        {grid.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[90px] bg-klyp-pale/20" />;

          const isToday = day.date === today;
          const isSelected = selectedDate === day.date;
          const hasRes = day.reservations.length > 0;
          const activeRes = day.reservations.filter(r => !["cancelled", "no_show"].includes(r.status));

          return (
            <button
              key={day.date}
              onClick={() => onDaySelect(day)}
              className={[
                "min-h-[90px] p-1.5 text-left transition-all cursor-pointer relative",
                occupancyBg(day.occupancy_pct),
                isSelected ? "ring-2 ring-inset ring-klyp-accent" : "hover:brightness-95",
              ].join(" ")}
            >
              {/* Número del día */}
              <span className={[
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                isToday ? "bg-klyp-accent text-white" : "text-klyp-navy",
              ].join(" ")}>
                {new Date(day.date + "T00:00:00").getDate()}
              </span>

              {/* % ocupación si hay unidades */}
              {day.occupied_units > 0 && (
                <span className={`block text-xs font-bold mt-0.5 ${occupancyText(day.occupancy_pct)}`}>
                  {day.occupancy_pct}%
                </span>
              )}

              {/* Dots de reservas */}
              {hasRes && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {day.reservations.slice(0, 6).map((r) => (
                    <StatusDot key={r.id} status={r.status} />
                  ))}
                  {day.reservations.length > 6 && (
                    <span className="text-xs text-klyp-gray">+{day.reservations.length - 6}</span>
                  )}
                </div>
              )}

              {/* Indicadores check-in/out */}
              {(day.check_ins > 0 || day.check_outs > 0) && (
                <div className="mt-0.5 flex gap-1 text-xs">
                  {day.check_ins > 0 && <span className="text-emerald-700 font-medium">↓{day.check_ins}</span>}
                  {day.check_outs > 0 && <span className="text-blue-700 font-medium">↑{day.check_outs}</span>}
                </div>
              )}

              {/* Indicador de reservas activas */}
              {activeRes.length > 0 && (
                <span className="absolute top-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-klyp-accent/10 text-klyp-accent text-xs font-bold">
                  {activeRes.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vista semanal ────────────────────────────────────────────────────────────

interface WeekViewProps {
  data: CalendarMonth;
  weekStart: string;  // ISO date of Monday
  today: string;
  onReservationClick: (id: string) => void;
}

function WeekView({ data, weekStart, today, onReservationClick }: WeekViewProps) {
  const dayMap = new Map<string, CalendarDay>(data.days.map(d => [d.date, d]));
  const weekDays: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStart, i);
    const d = dayMap.get(iso);
    if (d) weekDays.push(d);
  }

  if (weekDays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-klyp-pale bg-white p-10 text-center text-klyp-gray">
        Esta semana no está dentro del mes seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {weekDays.map((day) => {
        const isToday = day.date === today;
        const d = new Date(day.date + "T00:00:00");
        const label = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

        return (
          <div key={day.date} className={`rounded-xl border ${isToday ? "border-klyp-accent" : "border-klyp-pale"} bg-white overflow-hidden`}>
            {/* Cabecera del día */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${isToday ? "bg-klyp-accent/10" : occupancyBg(day.occupancy_pct)}`}>
              <div className="flex items-center gap-3">
                <span className={`capitalize font-semibold text-sm ${isToday ? "text-klyp-accent" : "text-klyp-navy"}`}>
                  {label}
                </span>
                {isToday && (
                  <span className="text-xs font-medium text-klyp-accent bg-klyp-accent/10 px-1.5 py-0.5 rounded-full">Hoy</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-klyp-gray">
                {day.check_ins > 0 && <span className="text-emerald-700 font-medium">↓ {day.check_ins} check-in{day.check_ins > 1 ? "s" : ""}</span>}
                {day.check_outs > 0 && <span className="text-blue-700 font-medium">↑ {day.check_outs} check-out{day.check_outs > 1 ? "s" : ""}</span>}
                {day.occupied_units > 0 && (
                  <span className={`font-bold ${occupancyText(day.occupancy_pct)}`}>
                    {day.occupancy_pct}% ({day.occupied_units}/{day.total_units} uds.)
                  </span>
                )}
              </div>
            </div>

            {/* Reservas del día */}
            {day.reservations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-klyp-gray/60">Sin reservas este día</p>
            ) : (
              <div className="divide-y divide-klyp-pale/60">
                {day.reservations.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onReservationClick(r.id)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-klyp-pale/30 cursor-pointer transition-colors"
                  >
                    <StatusDot status={r.status} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-klyp-navy">{r.guest_name}</span>
                      <span className="text-xs text-klyp-gray ml-2">
                        {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {r.nights}n · {r.num_persons} pax
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                    {r.total_price != null && (
                      <span className="text-xs font-semibold text-klyp-navy shrink-0">{r.total_price.toFixed(0)} €</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Panel lateral de día (vista mensual) ─────────────────────────────────────

interface DayDetailPanelProps {
  day: CalendarDay;
  onClose: () => void;
  onReservationClick: (id: string) => void;
}

function DayDetailPanel({ day, onClose, onReservationClick }: DayDetailPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-klyp-pale shadow-lg p-4 space-y-3 h-fit">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-klyp-gray uppercase tracking-wide">Detalle del día</p>
          <h3 className="font-semibold text-klyp-navy capitalize text-sm">
            {fmtDateLong(day.date)}
          </h3>
        </div>
        <button onClick={onClose} className="text-klyp-gray hover:text-klyp-navy text-xl leading-none p-1">×</button>
      </div>

      {/* KPIs del día */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-klyp-pale p-2">
          <p className="text-klyp-gray">Ocupación</p>
          <p className="font-bold text-klyp-navy text-base">{day.occupancy_pct}%</p>
          <p className="text-klyp-gray">{day.occupied_units}/{day.total_units} uds.</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <p className="text-emerald-700">Check-ins</p>
          <p className="font-bold text-emerald-700 text-base">{day.check_ins}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2">
          <p className="text-blue-700">Check-outs</p>
          <p className="font-bold text-blue-700 text-base">{day.check_outs}</p>
        </div>
      </div>

      {/* Lista de reservas */}
      {day.reservations.length === 0 ? (
        <p className="text-sm text-klyp-gray text-center py-4">Sin reservas este día</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {day.reservations.map((r) => (
            <ReservationRow
              key={r.id}
              r={r}
              onClick={() => onReservationClick(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Leyenda ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-klyp-gray">
      <span className="font-medium">Estados:</span>
      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
        <span key={status} className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ─── Status filter options ────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "confirmed", label: "Confirmada" },
  { value: "pending_payment", label: "Pago pendiente" },
  { value: "checked_in", label: "En casa" },
  { value: "checked_out", label: "Checkout" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No show" },
];

// ─── Componente principal ─────────────────────────────────────────────────────

type ViewMode = "month" | "week";

export function OccupancyCalendar() {
  const router = useRouter();
  const now = new Date();
  const todayIso = now.toISOString().split("T")[0]!;

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekStart, setWeekStart] = useState<string>(isoWeekStart(todayIso));
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
        status: status || undefined,
      });
      setData(res.data);
    } catch {
      setLoadError("No se pudo cargar el calendario. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(year, month, statusFilter); }, [year, month, statusFilter, load]);

  // Sincronizar semana con el mes cuando se cambia de mes
  const goPrevMonth = () => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    setYear(newYear); setMonth(newMonth);
    setWeekStart(isoWeekStart(`${newYear}-${String(newMonth).padStart(2, "0")}-01`));
  };
  const goNextMonth = () => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    setYear(newYear); setMonth(newMonth);
    setWeekStart(isoWeekStart(`${newYear}-${String(newMonth).padStart(2, "0")}-01`));
  };

  const goPrevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const goNextWeek = () => setWeekStart(prev => addDays(prev, 7));

  // Cuando se navega semana, asegurarse de que el mes cargado es el correcto
  useEffect(() => {
    const weekStartDate = new Date(weekStart + "T00:00:00");
    // Si la semana empieza en un mes diferente al cargado, cargar ese mes
    const targetMonth = weekStartDate.getMonth() + 1;
    const targetYear = weekStartDate.getFullYear();
    if (targetYear !== year || targetMonth !== month) {
      setYear(targetYear);
      setMonth(targetMonth);
    }
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReservationClick = (id: string) => {
    router.push(`/reservas/${id}`);
  };

  // Semana actual en formato "21 – 27 abr 2026"
  const weekLabel = (() => {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(addDays(weekStart, 6) + "T00:00:00");
    const startStr = start.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const endStr = end.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    return `${startStr} – ${endStr}`;
  })();

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Navegación de periodo */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={viewMode === "month" ? goPrevMonth : goPrevWeek}
            className="min-h-[36px] min-w-[36px] p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center min-w-[180px]">
            <p className="font-bold text-klyp-navy text-base">
              {viewMode === "month"
                ? `${MONTHS_ES[month - 1]} ${year}`
                : weekLabel}
            </p>
            {viewMode === "week" && (
              <p className="text-xs text-klyp-gray">{MONTHS_ES[month - 1]} {year}</p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={viewMode === "month" ? goNextMonth : goNextWeek}
            className="min-h-[36px] min-w-[36px] p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Botón "Hoy" */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now2 = new Date();
              setYear(now2.getFullYear()); setMonth(now2.getMonth() + 1);
              setWeekStart(isoWeekStart(todayIso));
            }}
            className="text-klyp-accent hover:bg-klyp-accent/10 text-xs min-h-[36px]"
          >
            Hoy
          </Button>
        </div>

        {/* Filtro estado */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-klyp-pale bg-white px-2 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent self-start"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Toggle vista */}
        <div className="flex items-center gap-1 rounded-lg bg-klyp-pale p-1 self-start">
          <button
            onClick={() => setViewMode("month")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors min-h-[32px] ${
              viewMode === "month" ? "bg-white shadow-sm text-klyp-navy" : "text-klyp-gray hover:text-klyp-navy"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Mes
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors min-h-[32px] ${
              viewMode === "week" ? "bg-white shadow-sm text-klyp-navy" : "text-klyp-gray hover:text-klyp-navy"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Semana
          </button>
        </div>
      </div>

      {/* KPIs */}
      {data && <KpiBar data={data} />}

      {/* Leyenda */}
      <Legend />

      {/* ─── Contenido ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-klyp-gray text-sm gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-klyp-accent border-t-transparent" />
          Cargando...
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700 text-sm">
          {loadError}
        </div>
      ) : data ? (
        <>
          {viewMode === "month" && (
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <MonthView
                  data={data}
                  today={todayIso}
                  selectedDate={selectedDay?.date ?? null}
                  onDaySelect={(day) => setSelectedDay(prev => prev?.date === day.date ? null : day)}
                />
              </div>
              {/* Panel lateral */}
              <div className="xl:w-72">
                {selectedDay ? (
                  <DayDetailPanel
                    day={selectedDay}
                    onClose={() => setSelectedDay(null)}
                    onReservationClick={handleReservationClick}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-klyp-pale bg-white p-6 text-center text-sm text-klyp-gray flex flex-col items-center gap-2">
                    <CalendarDays className="h-8 w-8 text-klyp-pale" />
                    <p>Haz clic en un día para ver el detalle</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <WeekView
              data={data}
              weekStart={weekStart}
              today={todayIso}
              onReservationClick={handleReservationClick}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
