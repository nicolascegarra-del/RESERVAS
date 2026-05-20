"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, Paintbrush, ShieldAlert, Bell, ChevronDown, ChevronUp,
  Save, Check, Users, Pencil, PauseCircle, PlayCircle, UserPlus, UserX,
  CreditCard, Trash2,
} from "lucide-react";
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
import { cancellationsApi, settingsApi, companyUsersApi, billingApi, type CompanyUser, type TenantLimits } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { CancellationPolicy, MailNotificationConfig, PaymentMethod, PaymentMethodType } from "@/types";
import { PAYMENT_METHOD_TYPE_LABELS as METHOD_LABELS } from "@/types";

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

// ─── Tab: Mail Notificaciones ─────────────────────────────────────────────────

const RECIPIENT_LABELS: Record<string, string> = {
  cliente: "Al cliente",
  empresa: "A la empresa",
  "recepción": "A recepción",
};

function NotificationRow({
  config,
  onSaved,
}: {
  config: MailNotificationConfig;
  onSaved: (updated: MailNotificationConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(config.enabled);
  const [subject, setSubject] = useState(config.subject);
  const [bodyText, setBodyText] = useState(config.body_text);
  const [daysBefore, setDaysBefore] = useState<number | null>(config.days_before);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.updateMailNotification(config.notification_type, {
        enabled,
        subject,
        body_text: bodyText,
        ...(config.is_time_based ? { days_before: daysBefore } : {}),
      });
      onSaved(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silencioso
    } finally {
      setSaving(false);
    }
  };

  const isDocType = config.notification_type.startsWith("guest_docs");

  return (
    <div className={`rounded-lg border transition-colors ${enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"}`}>
      {/* Cabecera de la fila */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none ${
            enabled ? "bg-klyp-accent" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
              enabled ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
            }`}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${enabled ? "text-gray-900" : "text-gray-400"}`}>
              {config.label}
            </p>
            {config.is_time_based && daysBefore !== null && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {daysBefore} día{daysBefore !== 1 ? "s" : ""} antes
              </span>
            )}
            {isDocType && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Documentos
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{config.description}</p>
        </div>

        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {RECIPIENT_LABELS[config.recipient] ?? config.recipient}
        </span>

        <button
          onClick={() => setOpen(!open)}
          className="text-gray-400 hover:text-gray-600 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Panel expandido */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
          {/* Campo días antes — solo para notificaciones de tiempo */}
          {config.is_time_based && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex-1">
                <label className="text-xs font-medium text-blue-700">Días antes del check-in</label>
                <p className="text-xs text-blue-500 mt-0.5">¿Con cuánta antelación enviar este recordatorio?</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={daysBefore ?? 1}
                  onChange={(e) => setDaysBefore(parseInt(e.target.value) || 1)}
                  className="w-16 text-sm text-center border border-blue-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
                />
                <span className="text-sm text-blue-700">día{(daysBefore ?? 1) !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Asunto del email</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-klyp-accent/30 focus:border-klyp-accent"
              placeholder="Asunto del email..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Cuerpo del email</label>
            <textarea
              rows={6}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-klyp-accent/30 focus:border-klyp-accent resize-y font-mono"
              placeholder="Texto del email..."
            />
            <p className="text-xs text-gray-400">
              Variables: {"{nombre}"}, {"{email}"}, {"{check_in}"}, {"{check_out}"}, {"{personas}"}, {"{total}"}, {"{empresa}"}
              {isDocType && <span className="text-amber-600">, {"{enlace_documentos}"}</span>}
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[36px]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? "Guardado" : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MailNotificacionesTab() {
  const [configs, setConfigs] = useState<MailNotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await settingsApi.getMailNotifications();
        setConfigs(res.data);
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaved = (updated: MailNotificationConfig) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.notification_type === updated.notification_type ? updated : c
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg border border-gray-100 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  const docsConfigs = configs.filter((c) => c.notification_type.startsWith("guest_docs"));
  const clientConfigs = configs.filter((c) => c.recipient === "cliente" && !c.notification_type.startsWith("guest_docs"));
  const internalConfigs = configs.filter((c) => c.recipient !== "cliente");

  return (
    <div className="space-y-6">
      <p className="text-sm text-klyp-gray">
        Activa o desactiva las notificaciones de email y personaliza asunto, texto y temporización para cada evento.
      </p>

      {/* Documentos de viajeros */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Documentos de viajeros
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Emails para la recogida de DNI/pasaportes antes del check-in. Usa {"{enlace_documentos}"} para insertar el enlace de carga.
          </p>
        </div>
        <div className="space-y-2">
          {docsConfigs.map((cfg) => (
            <NotificationRow key={cfg.notification_type} config={cfg} onSaved={handleSaved} />
          ))}
        </div>
      </div>

      {/* Notificaciones al cliente */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Notificaciones al cliente
        </h3>
        <div className="space-y-2">
          {clientConfigs.map((cfg) => (
            <NotificationRow key={cfg.notification_type} config={cfg} onSaved={handleSaved} />
          ))}
        </div>
      </div>

      {/* Notificaciones internas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Notificaciones internas
        </h3>
        <div className="space-y-2">
          {internalConfigs.map((cfg) => (
            <NotificationRow key={cfg.notification_type} config={cfg} onSaved={handleSaved} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Usuarios ────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  company_admin: "Admin Empresa",
  reception: "Gestión",
};

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-klyp-accent";
  const textColor = pct >= 100 ? "text-red-600 font-semibold" : "text-klyp-navy font-medium";
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-klyp-gray">{label}</span>
        <span className={textColor}>{used} / {max}</span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (u: CompanyUser) => void;
}) {
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "reception" as "company_admin" | "reception" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.password) { setError("Todos los campos son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await companyUsersApi.create(form);
      onCreated(res.data);
      setForm({ email: "", full_name: "", password: "", role: "reception" });
      onOpenChange(false);
    } catch (e) {
      setError(extractApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña *</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "company_admin" | "reception" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, open, onOpenChange, onUpdated }: {
  user: CompanyUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (u: CompanyUser) => void;
}) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.full_name) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const res = await companyUsersApi.update(user.id, { full_name: form.full_name, role: form.role });
      if (newPassword.trim()) {
        await companyUsersApi.resetPassword(user.id, newPassword.trim());
      }
      onUpdated(res.data);
      onOpenChange(false);
    } catch (e) {
      setError(extractApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-gray-50 text-klyp-gray" />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "company_admin" | "reception" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Nueva contraseña <span className="text-klyp-gray font-normal">(opcional)</span></Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Dejar en blanco para no cambiar" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosTab() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [limits, setLimits] = useState<TenantLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<CompanyUser | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [suspendConfirm, setSuspendConfirm] = useState<CompanyUser | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, limitsRes] = await Promise.all([
        companyUsersApi.list(),
        companyUsersApi.getLimits(),
      ]);
      setUsers(usersRes.data);
      setLimits(limitsRes.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleToggleSuspend = async (u: CompanyUser) => {
    setActionPending(u.id);
    try {
      const res = await companyUsersApi.update(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => x.id === u.id ? res.data : x));
      if (limits) {
        const adminCount = users.filter((x) => x.role === "company_admin" && (x.id === u.id ? !u.is_active : x.is_active)).length;
        const receptionCount = users.filter((x) => x.role === "reception" && (x.id === u.id ? !u.is_active : x.is_active)).length;
        setLimits({ ...limits, active_company_admins: adminCount, active_reception_users: receptionCount });
      }
    } catch {
      // silencioso
    } finally { setActionPending(null); setSuspendConfirm(null); }
  };

  const handleCreated = (u: CompanyUser) => {
    setUsers((prev) => [u, ...prev]);
    if (limits) {
      setLimits({
        ...limits,
        active_company_admins: u.role === "company_admin" ? limits.active_company_admins + 1 : limits.active_company_admins,
        active_reception_users: u.role === "reception" ? limits.active_reception_users + 1 : limits.active_reception_users,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-klyp-gray">
          Crea y gestiona los usuarios de gestión y administración de tu empresa.
        </p>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Barras de uso */}
      {limits && (
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
          <UsageBar label="Admin Empresa" used={limits.active_company_admins} max={limits.max_company_admins} />
          <UsageBar label="Gestión / Recepción" used={limits.active_reception_users} max={limits.max_reception_users} />
        </div>
      )}

      {/* Lista de usuarios */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-klyp-gray rounded-lg border border-dashed border-klyp-pale">
          <UserX className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay usuarios creados aún.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-klyp-navy">
                    {u.full_name}
                    <p className="sm:hidden text-xs text-klyp-gray mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-klyp-gray text-xs hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === "company_admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {u.is_active ? "Activo" : "Suspendido"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar" onClick={() => setEditUser(u)}>
                        <Pencil className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0"
                        title={u.is_active ? "Suspender" : "Activar"}
                        disabled={actionPending === u.id}
                        onClick={() => setSuspendConfirm(u)}
                      >
                        {actionPending === u.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-klyp-gray" />
                          : u.is_active
                            ? <PauseCircle className="h-4 w-4 text-amber-500" />
                            : <PlayCircle className="h-4 w-4 text-green-500" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-klyp-gray">
            {users.length} usuario{users.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />

      {editUser && (
        <EditUserDialog
          user={editUser}
          open={true}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          onUpdated={(u) => { setUsers((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditUser(null); }}
        />
      )}

      {suspendConfirm && (
        <Dialog open={true} onOpenChange={() => setSuspendConfirm(null)}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>{suspendConfirm.is_active ? "¿Suspender usuario?" : "¿Activar usuario?"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-klyp-gray py-2">
              {suspendConfirm.is_active
                ? <>Se suspenderá la cuenta de <strong>{suspendConfirm.full_name}</strong>. No podrá iniciar sesión.</>
                : <>Se reactivará la cuenta de <strong>{suspendConfirm.full_name}</strong>.</>}
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSuspendConfirm(null)}>Cancelar</Button>
              <Button
                className={suspendConfirm.is_active ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                disabled={actionPending === suspendConfirm.id}
                onClick={() => void handleToggleSuspend(suspendConfirm)}
              >
                {actionPending === suspendConfirm.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : suspendConfirm.is_active ? "Suspender" : "Activar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Tab: Métodos de Pago ─────────────────────────────────────────────────────

const MANUAL_METHOD_TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia Bancaria" },
  { value: "tpv_manual", label: "TPV (manual)" },
];

interface CreateMethodForm {
  name: string;
  method_type: PaymentMethodType;
  iban: string;
  bank_name: string;
  is_default: boolean;
}

const DEFAULT_METHOD_FORM: CreateMethodForm = {
  name: "",
  method_type: "cash",
  iban: "",
  bank_name: "",
  is_default: false,
};

function CreateMethodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (method: PaymentMethod) => void;
}) {
  const [form, setForm] = useState<CreateMethodForm>(DEFAULT_METHOD_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const config: Record<string, string> | null =
        form.method_type === "bank_transfer" && (form.iban || form.bank_name)
          ? { iban: form.iban, bank_name: form.bank_name }
          : null;
      const res = await billingApi.createPaymentMethod({
        name: form.name.trim(),
        method_type: form.method_type,
        config,
        is_default: form.is_default,
      });
      onCreated(res.data);
      setForm(DEFAULT_METHOD_FORM);
      onOpenChange(false);
    } catch (e) {
      setError(extractApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-klyp-navy">Nuevo método de pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              placeholder="Ej: Caja principal, BBVA..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              value={form.method_type}
              onChange={(e) => setForm({ ...form, method_type: e.target.value as PaymentMethodType })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MANUAL_METHOD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {form.method_type === "bank_transfer" && (
            <div className="space-y-3 rounded-lg border border-klyp-pale p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-klyp-gray">
                Datos bancarios
              </p>
              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input
                  placeholder="ES12 3456 7890 1234 5678 9012"
                  value={form.iban}
                  onChange={(e) => setForm({ ...form, iban: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del banco</Label>
                <Input
                  placeholder="BBVA, Santander..."
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-default"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="is-default">Método por defecto</Label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear método"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetodosPagoTab() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "company_admin" || user?.role === "super_admin";

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PaymentMethod | null>(null);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billingApi.listPaymentMethods();
      setMethods(res.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMethods(); }, [fetchMethods]);

  const handleToggleActive = async (method: PaymentMethod) => {
    setActionPending(method.id);
    try {
      const res = await billingApi.updatePaymentMethod(method.id, {
        is_active: !method.is_active,
      });
      setMethods((prev) => prev.map((m) => (m.id === method.id ? res.data : m)));
    } catch {
      // silencioso
    } finally { setActionPending(null); }
  };

  const handleToggleDefault = async (method: PaymentMethod) => {
    setActionPending(method.id);
    try {
      const res = await billingApi.updatePaymentMethod(method.id, {
        is_default: !method.is_default,
      });
      setMethods((prev) => prev.map((m) => (m.id === method.id ? res.data : m)));
    } catch {
      // silencioso
    } finally { setActionPending(null); }
  };

  const handleDelete = async (method: PaymentMethod) => {
    setActionPending(method.id);
    try {
      await billingApi.deletePaymentMethod(method.id);
      setMethods((prev) => prev.filter((m) => m.id !== method.id));
    } catch {
      // silencioso
    } finally { setActionPending(null); setDeleteConfirm(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-klyp-gray">
          Configura los métodos de pago disponibles para registrar cobros de reservas.
          Stripe y Redsys se configuran desde el panel de superadmin.
        </p>
        {canManage && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo método
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-8 py-12 text-center">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm text-klyp-gray">No hay métodos de pago configurados.</p>
          {canManage && (
            <Button
              className="mt-4 bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear primer método
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray hidden sm:table-cell">Por defecto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {methods.map((method) => (
                <tr key={method.id} className={`hover:bg-gray-50 transition-colors ${!method.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-klyp-navy">{method.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {METHOD_LABELS[method.method_type] ?? method.method_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {method.is_default && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Defecto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      method.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {method.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-klyp-gray"
                          disabled={actionPending === method.id}
                          title={method.is_active ? "Desactivar" : "Activar"}
                          onClick={() => void handleToggleActive(method)}
                        >
                          {method.is_active ? <PauseCircle className="h-4 w-4 text-amber-500" /> : <PlayCircle className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={actionPending === method.id}
                          title={method.is_default ? "Quitar como defecto" : "Poner como defecto"}
                          onClick={() => void handleToggleDefault(method)}
                        >
                          <Check className={`h-4 w-4 ${method.is_default ? "text-green-600" : "text-gray-300"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          disabled={actionPending === method.id}
                          title="Eliminar"
                          onClick={() => setDeleteConfirm(method)}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateMethodDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(m) => setMethods((prev) => [...prev, m])}
      />

      {deleteConfirm && (
        <Dialog open={true} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>¿Eliminar método de pago?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-klyp-gray py-2">
              Se eliminará <strong>{deleteConfirm.name}</strong>. Esta acción no se puede deshacer.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={actionPending === deleteConfirm.id}
                onClick={() => void handleDelete(deleteConfirm)}
              >
                {actionPending === deleteConfirm.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Página de configuración ──────────────────────────────────────────────────

type Tab = "cancelaciones" | "apariencia" | "mail" | "usuarios" | "metodos-pago";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "apariencia", label: "Apariencia", icon: Paintbrush },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "metodos-pago", label: "Métodos de Pago", icon: CreditCard },
  { id: "mail", label: "Mail Notificaciones", icon: Bell },
  { id: "cancelaciones", label: "Cancelaciones", icon: ShieldAlert },
];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("apariencia");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Configuración</h1>
        <p className="mt-0.5 text-sm text-klyp-gray">
          Apariencia, notificaciones de email y políticas de cancelación.
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
        {activeTab === "mail" && <MailNotificacionesTab />}
        {activeTab === "usuarios" && <UsuariosTab />}
        {activeTab === "metodos-pago" && <MetodosPagoTab />}
      </div>
    </div>
  );
}
