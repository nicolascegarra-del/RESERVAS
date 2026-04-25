"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Paintbrush, ShieldAlert } from "lucide-react";
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
import { CancellationPolicyCard } from "@/components/cancellations/CancellationPolicyCard";
import { BrandingEditor } from "@/components/branding/BrandingEditor";
import { cancellationsApi } from "@/lib/api";
import type { CancellationPolicy } from "@/types";

// ─── Formulario de nueva política ─────────────────────────────────────────────

interface NewPolicyForm {
  name: string;
  full_refund_days: number;
  partial_refund_days: number;
  partial_refund_percentage: number;
}

const DEFAULT_FORM: NewPolicyForm = {
  name: "",
  full_refund_days: 7,
  partial_refund_days: 2,
  partial_refund_percentage: 50,
};

function CreatePolicyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (policy: CancellationPolicy) => void;
}) {
  const [form, setForm] = useState<NewPolicyForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await cancellationsApi.createPolicy({
        name: form.name.trim(),
        full_refund_days: form.full_refund_days,
        partial_refund_days: form.partial_refund_days,
        partial_refund_percentage: form.partial_refund_percentage,
      });
      onCreated(res.data);
      setForm(DEFAULT_FORM);
      onOpenChange(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: { error?: { message?: string } } } };
      };
      const msg =
        axiosErr.response?.data?.detail?.error?.message ??
        "Error al crear la política.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">
            Nueva política de cancelación
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-klyp-gray">
            Define los tramos de reembolso según los días de antelación.
            Esta política se aplicará globalmente al tenant.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="policy-name">Nombre de la política *</Label>
            <Input
              id="policy-name"
              placeholder="Ej: Política estándar de camping"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="rounded-lg border border-klyp-pale p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
              Tramos de reembolso
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="full-refund-days">
                Tramo 1 — Días mínimos para reembolso completo (100%)
              </Label>
              <Input
                id="full-refund-days"
                type="number"
                min={1}
                value={form.full_refund_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    full_refund_days: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-klyp-gray">
                Si se cancela con ≥ {form.full_refund_days} días antes del check-in
                → reembolso del 100%.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partial-refund-days">
                Tramo 2 — Días mínimos para reembolso parcial
              </Label>
              <Input
                id="partial-refund-days"
                type="number"
                min={0}
                value={form.partial_refund_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    partial_refund_days: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-klyp-gray">
                Si se cancela entre {form.partial_refund_days} y{" "}
                {form.full_refund_days - 1} días antes → reembolso parcial.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partial-pct">Porcentaje de reembolso en Tramo 2</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="partial-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={form.partial_refund_percentage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      partial_refund_percentage: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-klyp-gray">%</span>
              </div>
            </div>

            <div className="rounded bg-red-50 px-3 py-2 text-sm">
              <span className="text-red-700 font-medium">Tramo 3</span>
              <span className="text-red-600">
                {" "}
                — &lt; {form.partial_refund_days} días antes → sin reembolso (0%)
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="bg-klyp-accent hover:bg-klyp-accent/90 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Crear política"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Cancelaciones ────────────────────────────────────────────────────────

function CancelacionesTab() {
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await cancellationsApi.listPolicies();
      setPolicies(res.data);
    } catch {
      setLoadError("No se pudieron cargar las políticas de cancelación.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-klyp-gray">
          Configura los tramos de reembolso que se aplican al cancelar reservas.
        </p>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva política
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-lg" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {loadError}
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-8 py-12 text-center">
          <p className="text-sm text-klyp-gray">
            No hay políticas configuradas. Crea una para que los reembolsos
            se calculen automáticamente al cancelar reservas.
          </p>
          <Button
            className="mt-4 bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear primera política
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <CancellationPolicyCard
              key={policy.id}
              policy={policy}
              onUpdated={(updated) =>
                setPolicies((prev) =>
                  prev.map((p) => (p.id === updated.id ? updated : p)),
                )
              }
              onDeleted={(id) =>
                setPolicies((prev) => prev.filter((p) => p.id !== id))
              }
            />
          ))}
        </div>
      )}

      <CreatePolicyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(policy) => setPolicies((prev) => [policy, ...prev])}
      />
    </div>
  );
}

// ─── Página de configuración ──────────────────────────────────────────────────

type Tab = "cancelaciones" | "apariencia";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "cancelaciones", label: "Cancelaciones", icon: ShieldAlert },
  { id: "apariencia", label: "Apariencia", icon: Paintbrush },
];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("cancelaciones");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Configuración</h1>
        <p className="mt-0.5 text-sm text-klyp-gray">
          Políticas de cancelación y apariencia de la landing pública.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-klyp-pale">
        <nav className="flex gap-1" aria-label="Secciones de configuración">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                  isActive
                    ? "border-klyp-accent text-klyp-accent"
                    : "border-transparent text-klyp-gray hover:text-klyp-navy hover:border-klyp-pale"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      <div>
        {activeTab === "cancelaciones" && <CancelacionesTab />}
        {activeTab === "apariencia" && <BrandingEditor />}
      </div>
    </div>
  );
}
