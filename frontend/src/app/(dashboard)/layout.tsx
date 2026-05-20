"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, user, selectedTenantId, selectedTenantName, setSelectedTenant } =
    useAuthStore();

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (isSuperAdmin && !selectedTenantId) {
      // Superadmin sin empresa seleccionada → volver al panel superadmin
      router.replace("/empresas");
    }
  }, [isAuthenticated, isSuperAdmin, selectedTenantId, router]);

  if (!isAuthenticated) return null;
  if (isSuperAdmin && !selectedTenantId) return null;

  const handleExitImpersonation = () => {
    setSelectedTenant(null, null);
    router.replace("/empresas");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-klyp-pale">
      {/* Sidebar — oculto en móvil, visible en desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Banner de impersonación (solo visible para superadmin) */}
        {isSuperAdmin && selectedTenantId && (
          <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-white text-sm shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                Actuando como empresa: <strong>{selectedTenantName ?? selectedTenantId}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-white hover:bg-amber-600 hover:text-white border border-white/30"
              onClick={handleExitImpersonation}
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </Button>
          </div>
        )}

        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
