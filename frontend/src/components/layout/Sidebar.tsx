"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Ban,
  CalendarDays,
  RotateCcw,
  Settings,
  ChevronRight,
  ClipboardList,
  Mail,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useTenantBrandingStore } from "@/stores/tenantBrandingStore";
import { changeRequestsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

function resolveLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url}`;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  disabled?: boolean;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";
  const { logout } = useAuth();
  const { primary_color, accent_color, brand_name, logo_url, tenant_name } = useTenantBrandingStore();

  const primaryBg = primary_color || "#051937";
  const accentBg = accent_color || "#2E6DB4";
  const displayName = brand_name || tenant_name || "Klyp";
  const companyLabel = brand_name || tenant_name || null;
  const resolvedLogoUrl = resolveLogoUrl(logo_url);

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      try {
        const resp = await changeRequestsApi.countPending();
        setPendingCount(resp.data.pending);
      } catch {
        // silencioso — badge no crítico
      }
    };

    void load();
    // Refresca cada 30 segundos
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const navItems: NavItem[] = [
    {
      label: "Cuadro de Mandos",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Alojamientos",
      href: "/alojamientos",
      icon: Building2,
    },
    {
      label: "Bloqueos",
      href: "/bloqueos",
      icon: Ban,
      adminOnly: true,
    },
    {
      label: "Reservas",
      href: "/reservas",
      icon: CalendarDays,
    },
    {
      label: "Solicitudes",
      href: "/solicitudes",
      icon: ClipboardList,
      adminOnly: true,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: "Devoluciones",
      href: "/devoluciones",
      icon: RotateCcw,
    },
    {
      label: "Facturación",
      href: "/facturacion",
      icon: FileText,
    },
    {
      label: "Log de Emails",
      href: "/mail-logs",
      icon: Mail,
    },
    {
      label: "Configuración",
      href: "/configuracion",
      icon: Settings,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="flex h-full w-64 flex-col" style={{ backgroundColor: primaryBg }}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-4 gap-3">
        {resolvedLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvedLogoUrl} alt={displayName} className="h-8 w-8 rounded object-contain bg-white/10 p-0.5 shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: accentBg }}>
            <span className="text-white font-bold text-sm">{displayName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-tight">{displayName}</p>
          <p className="text-white/50 text-xs truncate">RESERVAS</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/30 cursor-not-allowed"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs bg-white/10 text-white/30 px-1.5 py-0.5 rounded">
                  Próximo
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              style={isActive ? { backgroundColor: accentBg } : {}}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
              {item.badge !== undefined ? (
                <span
                  className={cn(
                    "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold",
                    isActive ? "bg-white" : "bg-red-500 text-white",
                  )}
                  style={isActive ? { color: accentBg } : {}}
                >
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="ml-auto h-4 w-4" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer: info del usuario */}
      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="px-1">
          {user?.full_name && (
            <p className="text-white text-xs font-semibold truncate">{user.full_name}</p>
          )}
          <p className="text-white/50 text-xs truncate">{user?.email}</p>
          {companyLabel && (
            <p className="text-white/40 text-xs truncate mt-0.5">{companyLabel}</p>
          )}
        </div>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
