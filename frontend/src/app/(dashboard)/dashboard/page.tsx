"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Users,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { reservationsApi } from "@/lib/api";
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

  useEffect(() => {
    reservationsApi.getStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

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
