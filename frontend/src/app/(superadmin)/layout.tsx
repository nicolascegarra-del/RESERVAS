"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Users, LogOut, ShieldCheck,
  Settings, Menu, X, ShieldCheck as LogIcon,
  ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

// ─── Estructura de navegación ─────────────────────────────────────────────────

type NavLink = { type: "link"; href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = {
  type: "section";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { href: string; label: string }[];
};
type NavEntry = NavLink | NavSection;

const NAV: NavEntry[] = [
  { type: "link", href: "/empresas", label: "Empresas", icon: Building2 },
  { type: "link", href: "/usuarios", label: "Usuarios", icon: Users },
  {
    type: "section",
    label: "Configuración",
    icon: Settings,
    children: [
      { href: "/ajustes", label: "SMTP" },
      { href: "/configuracion/superadmin-usuarios", label: "Usuarios SuperAdmin" },
      { href: "/configuracion-roles", label: "Permisos Roles" },
      { href: "/configuracion/borrado-avanzado", label: "Borrado Avanzado" },
    ],
  },
  {
    type: "section",
    label: "Registro Log",
    icon: LogIcon,
    children: [
      { href: "/registro-log/emails", label: "Log Emails" },
      { href: "/registro-log/accesos", label: "Log de Accesos" },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV.forEach((entry) => {
      if (entry.type === "section") {
        initial[entry.label] = false;
      }
    });
    return initial;
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user?.role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, user, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Auto-expand section if a child is active
  useEffect(() => {
    NAV.forEach((entry) => {
      if (entry.type === "section") {
        const hasActiveChild = entry.children.some((c) => pathname.startsWith(c.href));
        if (hasActiveChild) {
          setExpandedSections((prev) => ({ ...prev, [entry.label]: true }));
        }
      }
    });
  }, [pathname]);

  if (!isAuthenticated || user?.role !== "super_admin") return null;

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const SidebarContent = () => (
    <>
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-klyp-accent" />
            <span className="text-white font-bold text-sm">Super Admin</span>
          </div>
          <button
            className="lg:hidden text-white/60 hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-white/50 text-xs mt-0.5">Panel de Gestión</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((entry) => {
          if (entry.type === "link") {
            const isActive = pathname.startsWith(entry.href);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-klyp-accent text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {entry.label}
              </Link>
            );
          }

          // Section
          const Icon = entry.icon;
          const isOpen = expandedSections[entry.label] ?? false;
          const hasActiveChild = entry.children.some((c) => pathname.startsWith(c.href));

          return (
            <div key={entry.label}>
              <button
                onClick={() => toggleSection(entry.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  hasActiveChild
                    ? "text-white bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{entry.label}</span>
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  : <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                }
              </button>

              {isOpen && (
                <div className="ml-7 mt-0.5 space-y-0.5">
                  {entry.children.map((child) => {
                    const isChildActive = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                          isChildActive
                            ? "bg-klyp-accent text-white font-medium"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-2">
          <p className="text-white/60 text-xs truncate">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => { clearAuth(); router.replace("/login"); }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop (always visible) */}
      <aside className="hidden lg:flex w-64 bg-klyp-navy flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile (overlay) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-klyp-navy flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-klyp-navy border-b border-white/10 shrink-0">
          <button
            className="text-white/70 hover:text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-klyp-accent" />
            <span className="text-white font-bold text-sm">Super Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
