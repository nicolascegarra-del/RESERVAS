"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  RotateCcw,
  Settings,
  ChevronRight,
  ClipboardList,
  Mail,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { changeRequestsApi } from "@/lib/api";

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
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Alojamientos",
      href: "/alojamientos",
      icon: Building2,
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
    <aside className="flex h-full w-64 flex-col bg-klyp-navy">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-klyp-navy-light px-6">
        <span className="font-display text-xl font-semibold text-white">
          Klyp
        </span>
        <span className="ml-2 text-sm font-medium text-klyp-pale/70">
          RESERVAS
        </span>
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
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-klyp-pale/40 cursor-not-allowed"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs bg-klyp-navy-light/50 text-klyp-pale/40 px-1.5 py-0.5 rounded">
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
                  ? "bg-klyp-accent text-white"
                  : "text-klyp-pale/80 hover:bg-klyp-navy-light hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
              {item.badge !== undefined ? (
                <span
                  className={cn(
                    "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold",
                    isActive
                      ? "bg-white text-klyp-accent"
                      : "bg-red-500 text-white",
                  )}
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

      {/* Footer del sidebar */}
      <div className="border-t border-klyp-navy-light p-4">
        <p className="text-xs text-klyp-pale/40 text-center">
          RESERVAS v4.0
        </p>
      </div>
    </aside>
  );
}
