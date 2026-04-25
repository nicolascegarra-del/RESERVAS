"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, Settings, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantsApi, type TenantSummary } from "@/lib/superadminApi";

function CreateTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (t: TenantSummary) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) { setError("Nombre y slug son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await tenantsApi.create({ name: name.trim(), slug: slug.trim() });
      onCreated(res.data);
      setName(""); setSlug("");
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear la empresa.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              placeholder="Camping El Pinar"
              value={name}
              onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (URL)</Label>
            <Input
              placeholder="camping-el-pinar"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            <p className="text-xs text-klyp-gray">Solo letras minúsculas, números y guiones.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmpresasPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tenantsApi.list();
      setTenants(res.data);
    } catch { /* silencioso */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  const toggleActive = async (tenant: TenantSummary) => {
    try {
      await tenantsApi.update(tenant.id, { is_active: !tenant.is_active });
      setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, is_active: !t.is_active } : t));
    } catch { /* silencioso */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Empresas</h1>
          <p className="text-sm text-klyp-gray mt-0.5">Gestión de todos los tenants del sistema.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />Nueva empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-klyp-gray">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay empresas registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border border-klyp-pale p-4 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${t.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-klyp-navy truncate">{t.name}</p>
                  <p className="text-xs text-klyp-gray">slug: <span className="font-mono">{t.slug}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span title="Stripe" className={`text-xs px-2 py-0.5 rounded-full ${t.stripe_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  Stripe {t.stripe_enabled ? "✓" : "—"}
                </span>
                <span title="SMTP" className={`text-xs px-2 py-0.5 rounded-full ${t.smtp_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  SMTP {t.smtp_enabled ? "✓" : "—"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-klyp-gray hover:text-red-600"
                  onClick={() => void toggleActive(t)}
                  title={t.is_active ? "Desactivar" : "Activar"}
                >
                  {t.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </Button>
                <Button asChild size="sm" variant="outline" className="min-h-[36px]">
                  <Link href={`/empresas/${t.id}/config`}>
                    <Settings className="mr-1.5 h-4 w-4" />Configurar
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTenantDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(t) => setTenants((prev) => [t, ...prev])}
      />
    </div>
  );
}
