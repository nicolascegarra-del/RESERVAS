"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { reservationsApi, guestsApi, type DocsAlertItem } from "@/lib/api";
import { ROLE_LABELS } from "@/types";
import type { UserRole } from "@/types";

const roleBadgeVariant: Record<
  UserRole,
  "super-admin" | "company-admin" | "reception"
> = {
  super_admin: "super-admin",
  company_admin: "company-admin",
  reception: "reception",
};

interface Stats {
  total_units: number;
  active_reservations: number;
  guests_in_house: number;
  occupancy_pct_today: number;
  occupied_units_today: number;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [docsAlerts, setDocsAlerts] = useState<DocsAlertItem[]>([]);

  useEffect(() => {
    reservationsApi.getStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    guestsApi.docsAlerts(1)
      .then((res) => setDocsAlerts(res.data))
      .catch(() => setDocsAlerts([]));
  }, []);

  const formatShortDate = (iso: string): string => {
    const [, month, day] = iso.split("-");
    return `${day}/${month}`;
  };

  const statCards = [
    {
      title: "Alojamientos activos",
      value: stats?.total_units ?? 0,
      description: `${stats?.occupied_units_today ?? 0} ocupados hoy`,
      icon: Building2,
    },
    {
      title: "Reservas activas",
      value: stats?.active_reservations ?? 0,
      description: "Confirmadas, pendientes y en casa",
      icon: CalendarDays,
    },
    {
      title: "Huéspedes en casa",
      value: stats?.guests_in_house ?? 0,
      description: "Checked-in ahora mismo",
      icon: Users,
    },
    {
      title: "Ocupación hoy",
      value: `${stats?.occupancy_pct_today ?? 0}%`,
      description: `${stats?.occupied_units_today ?? 0} / ${stats?.total_units ?? 0} unidades`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-klyp-navy">
            Bienvenido{user?.full_name ? `, ${user.full_name}` : ""}
          </h2>
          <p className="mt-1 text-sm text-klyp-gray">
            Panel de control de Klyp RESERVAS
          </p>
        </div>
        {user && (
          <Badge variant={roleBadgeVariant[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        )}
      </div>

      {/* Banner de alerta — documentación de viajeros incompleta */}
      {docsAlerts.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                {docsAlerts.length} reserva
                {docsAlerts.length === 1 ? "" : "s"} con check-in inminente y
                documentación de viajeros incompleta
              </p>
              <p className="mt-0.5 text-xs text-orange-700">
                Revisa la documentación antes de la llegada para agilizar el
                check-in.
              </p>
              <ul className="mt-3 space-y-1.5">
                {docsAlerts.slice(0, 5).map((a) => (
                  <li key={a.reservation_id}>
                    <Link
                      href={`/reservas/${a.reservation_id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-orange-900 hover:underline"
                    >
                      <span className="font-medium">{a.guest_name}</span>
                      <span className="text-orange-700">
                        Entrada {formatShortDate(a.check_in)}
                      </span>
                      <span className="text-orange-700">
                        {a.completed_guests}/{a.num_persons} viajeros completos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {docsAlerts.length > 5 && (
                <p className="mt-2 text-xs text-orange-700">
                  y {docsAlerts.length - 5} más…
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid de estadísticas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
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
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-klyp-gray">
                      {card.title}
                    </CardTitle>
                    <Icon className="h-5 w-5 text-klyp-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-klyp-navy">
                      {card.value}
                    </div>
                    <CardDescription className="mt-1 text-xs">
                      {card.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
