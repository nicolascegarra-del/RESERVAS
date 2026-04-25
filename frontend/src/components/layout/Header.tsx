"use client";

import { useEffect, useState } from "react";
import { LogOut, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { adminApi, type TenantSummary } from "@/lib/api";
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

export function Header() {
  const { user, logout } = useAuth();
  const { selectedTenantId, setSelectedTenantId } = useAuthStore();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);

  // Cargar lista de tenants solo para super_admin
  useEffect(() => {
    if (user?.role !== "super_admin") return;
    adminApi
      .listTenants()
      .then((res) => {
        setTenants(res.data);
        // Auto-seleccionar si solo hay uno
        if (res.data.length === 1 && !selectedTenantId) {
          setSelectedTenantId(res.data[0]!.id);
        }
      })
      .catch(() => {
        // Silencioso — no crítico para la carga del header
      });
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await logout();
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <header className="flex h-16 items-center justify-between border-b border-klyp-pale bg-white px-6 shadow-sm">
      {/* Selector de tenant para super_admin */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-klyp-accent shrink-0" />
          <select
            value={selectedTenantId ?? ""}
            onChange={(e) => setSelectedTenantId(e.target.value || null)}
            className="rounded-md border border-klyp-pale bg-white px-2 py-1 text-sm text-klyp-text-dark focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-1"
          >
            <option value="">— Selecciona tenant —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {!selectedTenantId && (
            <span className="text-xs text-red-500 font-medium">
              Selecciona un tenant para continuar
            </span>
          )}
        </div>
      )}

      {/* Título — solo visible si no es super_admin (para no colapsar el header) */}
      {!isSuperAdmin && (
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-klyp-navy">Panel de control</h1>
        </div>
      )}

      {/* Info del usuario + logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-klyp-text-dark">
              <User className="h-4 w-4 text-klyp-gray" />
              <span className="hidden sm:block font-medium">
                {user.full_name || user.email}
              </span>
            </div>
            <Badge variant={roleBadgeVariant[user.role]}>
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-2 text-klyp-gray hover:text-red-600 min-h-[44px]"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:block">Salir</span>
        </Button>
      </div>
    </header>
  );
}
