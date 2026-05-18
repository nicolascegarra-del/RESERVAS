"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, Loader2, Building2, UserCog } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { rolePermissionsApi, type RolePermission } from "@/lib/superadminApi";

const ROLE_META = {
  company_admin: {
    label: "Admin Empresa",
    description: "Usuario que gestiona los alojamientos, precios y configuración de la empresa.",
    icon: Building2,
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  reception: {
    label: "Gestión",
    description: "Empleado que trabaja a diario con la aplicación: reservas, check-in y check-out.",
    icon: UserCog,
    color: "bg-green-50 border-green-200",
    badgeColor: "bg-green-100 text-green-700",
  },
} as const;

function PermissionToggle({
  perm,
  onToggle,
  disabled,
}: {
  perm: RolePermission;
  onToggle: (perm: RolePermission, value: boolean) => Promise<void>;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (value: boolean) => {
    setLoading(true);
    try { await onToggle(perm, value); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-white/60 transition-colors">
      <span className="text-sm text-klyp-navy">{perm.label}</span>
      <button
        role="switch"
        aria-checked={perm.is_enabled}
        disabled={disabled || loading}
        onClick={() => void handleChange(!perm.is_enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-klyp-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${perm.is_enabled ? "bg-klyp-accent" : "bg-gray-200"}`}
      >
        <span className="sr-only">{perm.is_enabled ? "Activado" : "Desactivado"}</span>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${perm.is_enabled ? "translate-x-5" : "translate-x-0"}`} />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          </span>
        )}
      </button>
    </div>
  );
}

export default function ConfiguracionRolesPage() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await rolePermissionsApi.list();
      setPermissions(res.data);
    } catch { /* silencioso */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetchPermissions(); }, [fetchPermissions]);

  const handleToggle = async (perm: RolePermission, value: boolean) => {
    const key = `${perm.role}:${perm.permission_key}`;
    setSavingKey(key);
    try {
      const res = await rolePermissionsApi.update({ role: perm.role, permission_key: perm.permission_key, is_enabled: value });
      setPermissions((prev) =>
        prev.map((p) => p.role === perm.role && p.permission_key === perm.permission_key ? { ...p, is_enabled: res.data.is_enabled } : p)
      );
    } catch { /* silencioso */ }
    finally { setSavingKey(null); }
  };

  const byRole = (role: string) => permissions.filter((p) => p.role === role);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-klyp-accent" />
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Configuración de Roles</h1>
          <p className="text-sm text-klyp-gray mt-0.5">
            Activa o desactiva permisos para cada rol. Los cambios se aplican a todos los usuarios de ese rol.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(["company_admin", "reception"] as const).map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            const perms = byRole(role);

            return (
              <div key={role} className={`rounded-xl border-2 ${meta.color} overflow-hidden`}>
                <div className="px-5 py-4 border-b border-current border-opacity-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/70">
                      <Icon className="h-5 w-5 text-klyp-navy" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-klyp-navy">{meta.label}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badgeColor}`}>{role}</span>
                      </div>
                      <p className="text-xs text-klyp-gray mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 divide-y divide-white/40">
                  {perms.length === 0 ? (
                    <p className="text-sm text-klyp-gray py-4 text-center">Sin permisos configurados.</p>
                  ) : (
                    perms.map((p) => (
                      <PermissionToggle
                        key={p.permission_key}
                        perm={p}
                        onToggle={handleToggle}
                        disabled={savingKey !== null && savingKey !== `${p.role}:${p.permission_key}`}
                      />
                    ))
                  )}
                </div>
                <div className="px-5 py-3 bg-white/30 border-t border-white/40">
                  <p className="text-xs text-klyp-gray">
                    {perms.filter((p) => p.is_enabled).length} de {perms.length} permisos activos
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
