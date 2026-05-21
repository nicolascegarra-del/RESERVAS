"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Users,
  TrendingUp,
  AlertTriangle,
  Settings2,
  X,
  Check,
} from "lucide-react";
import { OccupancyCalendar } from "@/components/reservations/OccupancyCalendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { reservationsApi, guestsApi, preferencesApi, type DocsAlertItem } from "@/lib/api";
import { ROLE_LABELS } from "@/types";
import type { UserRole } from "@/types";

const roleBadgeVariant: Record<UserRole, "super-admin" | "company-admin" | "reception"> = {
  super_admin: "super-admin",
  company_admin: "company-admin",
  reception: "reception",
};

// ─── Definición de widgets ────────────────────────────────────────────────────

const ALL_WIDGET_KEYS = [
  "stat_units",
  "stat_reservations",
  "stat_guests",
  "stat_occupancy",
  "docs_alerts",
  "occupancy_calendar",
] as const;

type WidgetKey = (typeof ALL_WIDGET_KEYS)[number];

const WIDGET_LABELS: Record<WidgetKey, string> = {
  stat_units:          "Alojamientos activos",
  stat_reservations:   "Reservas activas",
  stat_guests:         "Huéspedes en casa",
  stat_occupancy:      "Ocupación hoy",
  docs_alerts:         "Alertas de documentación",
  occupancy_calendar:  "Calendario de ocupación",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Stats {
  total_units: number;
  active_reservations: number;
  guests_in_house: number;
  occupancy_pct_today: number;
  occupied_units_today: number;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [docsAlerts, setDocsAlerts] = useState<DocsAlertItem[]>([]);

  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetKey>>(new Set(ALL_WIDGET_KEYS));
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Carga estadísticas
  useEffect(() => {
    reservationsApi.getStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // Carga alertas de documentación
  useEffect(() => {
    guestsApi.docsAlerts(1)
      .then((res) => setDocsAlerts(res.data))
      .catch(() => setDocsAlerts([]));
  }, []);

  // Carga preferencias de widgets desde la API
  useEffect(() => {
    preferencesApi.get()
      .then((res) => {
        const keys = res.data.widget_config.visible_widgets.filter(
          (k): k is WidgetKey => (ALL_WIDGET_KEYS as readonly string[]).includes(k)
        );
        setVisibleWidgets(new Set(keys));
      })
      .catch(() => { /* usa defaults */ })
      .finally(() => setPrefsLoading(false));
  }, []);

  const show = (k: WidgetKey) => visibleWidgets.has(k);

  const toggleWidget = (k: WidgetKey) => {
    setVisibleWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(k)) { next.delete(k); } else { next.add(k); }
      return next;
    });
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await preferencesApi.update({ visible_widgets: [...visibleWidgets] });
      setSaveOk(true);
      setTimeout(() => { setSaveOk(false); setShowSettings(false); }, 1200);
    } catch { /* silencioso */ }
    finally { setSaving(false); }
  };

  const formatShortDate = (iso: string): string => {
    const [, month, day] = iso.split("-");
    return `${day}/${month}`;
  };

  const statCards: { key: WidgetKey; title: string; value: number | string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      key: "stat_units",
      title: "Alojamientos activos",
      value: stats?.total_units ?? 0,
      description: `${stats?.occupied_units_today ?? 0} ocupados hoy`,
      icon: Building2,
    },
    {
      key: "stat_reservations",
      title: "Reservas activas",
      value: stats?.active_reservations ?? 0,
      description: "Confirmadas, pendientes y en casa",
      icon: CalendarDays,
    },
    {
      key: "stat_guests",
      title: "Huéspedes en casa",
      value: stats?.guests_in_house ?? 0,
      description: "Checked-in ahora mismo",
      icon: Users,
    },
    {
      key: "stat_occupancy",
      title: "Ocupación hoy",
      value: `${stats?.occupancy_pct_today ?? 0}%`,
      description: `${stats?.occupied_units_today ?? 0} / ${stats?.total_units ?? 0} unidades`,
      icon: TrendingUp,
    },
  ];

  const visibleStatCards = statCards.filter((c) => show(c.key));

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-klyp-navy">
            Bienvenido{user?.full_name ? `, ${user.full_name}` : ""}
          </h2>
          <p className="mt-1 text-sm text-klyp-gray">
            Panel de control de Klyp RESERVAS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Badge variant={roleBadgeVariant[user.role]}>
              {ROLE_LABELS[user.role]}
            </Badge>
          )}
          {!prefsLoading && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShowSettings((v) => !v)}
              title="Configurar widgets"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Panel de configuración de widgets */}
      {showSettings && (
        <div className="rounded-xl border border-klyp-accent/30 bg-klyp-pale p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-klyp-navy">Widgets visibles</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void handleSavePrefs()}
                disabled={saving}
                className="bg-klyp-accent hover:bg-klyp-accent/90 text-white h-8 px-3"
              >
                {saveOk ? <Check className="h-3.5 w-3.5" /> : saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_WIDGET_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => toggleWidget(k)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  visibleWidgets.has(k)
                    ? "bg-klyp-accent text-white border-klyp-accent"
                    : "bg-white text-klyp-gray border-gray-200 hover:border-klyp-accent/50"
                }`}
              >
                {WIDGET_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de documentación */}
      {show("docs_alerts") && docsAlerts.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                {docsAlerts.length} reserva{docsAlerts.length === 1 ? "" : "s"} con check-in
                inminente y documentación de viajeros incompleta
              </p>
              <p className="mt-0.5 text-xs text-orange-700">
                Revisa la documentación antes de la llegada para agilizar el check-in.
              </p>
              <ul className="mt-3 space-y-1.5">
                {docsAlerts.slice(0, 5).map((a) => (
                  <li key={a.reservation_id}>
                    <Link
                      href={`/reservas/${a.reservation_id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-orange-900 hover:underline"
                    >
                      <span className="font-medium">{a.guest_name}</span>
                      <span className="text-orange-700">Entrada {formatShortDate(a.check_in)}</span>
                      <span className="text-orange-700">
                        {a.completed_guests}/{a.num_persons} viajeros completos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {docsAlerts.length > 5 && (
                <p className="mt-2 text-xs text-orange-700">y {docsAlerts.length - 5} más…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid de estadísticas */}
      {visibleStatCards.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${visibleStatCards.length >= 4 ? "lg:grid-cols-4" : visibleStatCards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {(statsLoading ? statCards.filter((c) => show(c.key)) : visibleStatCards).map((card, i) =>
            statsLoading ? (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-5 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ) : (
              <Card key={card.key}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-klyp-gray">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-5 w-5 text-klyp-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-klyp-navy">{card.value}</div>
                  <CardDescription className="mt-1 text-xs">{card.description}</CardDescription>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* Calendario de ocupación */}
      {show("occupancy_calendar") && (
        <div className="rounded-xl border border-klyp-pale bg-white p-4 md:p-6">
          <OccupancyCalendar />
        </div>
      )}

      {/* Estado vacío si el usuario ocultó todos los widgets */}
      {!prefsLoading && visibleWidgets.size === 0 && (
        <div className="text-center py-12 text-klyp-gray">
          <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Todos los widgets están ocultos.</p>
          <button
            className="mt-2 text-xs text-klyp-accent underline"
            onClick={() => setShowSettings(true)}
          >
            Configura qué quieres ver
          </button>
        </div>
      )}
    </div>
  );
}
