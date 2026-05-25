"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Save, Plus, Trash2,
  CheckCircle2, XCircle, Pencil, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  tenantsApi, paymentGatewaysApi,
  type TenantSummary, type TenantConfig, type PaymentGateway,
  type PaymentGatewayCreatePayload,
} from "@/lib/superadminApi";
import { extractApiErrorMessage } from "@/lib/utils";

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-klyp-gray mb-4">{children}</h3>;
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono"
      />
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShow(!show)}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ─── Formulario de gateway ────────────────────────────────────────────────────

interface GatewayFormData {
  type: "stripe" | "redsys";
  name: string;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  stripe_currency: string;
  redsys_merchant_code: string;
  redsys_terminal: string;
  redsys_secret_key: string;
  redsys_currency: string;
  redsys_environment: string;
  bizum_enabled: boolean;
}

function emptyForm(type: "stripe" | "redsys" = "stripe"): GatewayFormData {
  return {
    type,
    name: "",
    stripe_secret_key: "",
    stripe_webhook_secret: "",
    stripe_currency: "eur",
    redsys_merchant_code: "",
    redsys_terminal: "",
    redsys_secret_key: "",
    redsys_currency: "978",
    redsys_environment: "sandbox",
    bizum_enabled: false,
  };
}

interface GatewayDialogProps {
  tenantId: string;
  editing: PaymentGateway | null;
  onClose: () => void;
  onSaved: (gw: PaymentGateway) => void;
}

function GatewayDialog({ tenantId, editing, onClose, onSaved }: GatewayDialogProps) {
  const [form, setForm] = useState<GatewayFormData>(
    editing
      ? {
          type: editing.type,
          name: editing.name,
          stripe_secret_key: "",
          stripe_webhook_secret: "",
          stripe_currency: editing.stripe_currency,
          redsys_merchant_code: editing.redsys_merchant_code ?? "",
          redsys_terminal: editing.redsys_terminal ?? "",
          redsys_secret_key: "",
          redsys_currency: editing.redsys_currency,
          redsys_environment: editing.redsys_environment,
          bizum_enabled: editing.bizum_enabled,
        }
      : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof GatewayFormData, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr("El nombre es obligatorio."); return; }
    setSaving(true); setErr(null);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { name: form.name };
        if (editing.type === "stripe") {
          if (form.stripe_secret_key) payload["stripe_secret_key"] = form.stripe_secret_key;
          if (form.stripe_webhook_secret) payload["stripe_webhook_secret"] = form.stripe_webhook_secret;
          payload["stripe_currency"] = form.stripe_currency;
        } else {
          payload["redsys_merchant_code"] = form.redsys_merchant_code || null;
          payload["redsys_terminal"] = form.redsys_terminal || null;
          if (form.redsys_secret_key) payload["redsys_secret_key"] = form.redsys_secret_key;
          payload["redsys_currency"] = form.redsys_currency;
          payload["redsys_environment"] = form.redsys_environment;
          payload["bizum_enabled"] = form.bizum_enabled;
        }
        const res = await paymentGatewaysApi.update(tenantId, editing.id, payload);
        onSaved(res.data);
      } else {
        const payload: PaymentGatewayCreatePayload = { type: form.type, name: form.name };
        if (form.type === "stripe") {
          if (form.stripe_secret_key) payload["stripe_secret_key"] = form.stripe_secret_key;
          if (form.stripe_webhook_secret) payload["stripe_webhook_secret"] = form.stripe_webhook_secret;
          payload["stripe_currency"] = form.stripe_currency;
        } else {
          payload["redsys_merchant_code"] = form.redsys_merchant_code || undefined;
          payload["redsys_terminal"] = form.redsys_terminal || undefined;
          if (form.redsys_secret_key) payload["redsys_secret_key"] = form.redsys_secret_key;
          payload["redsys_currency"] = form.redsys_currency;
          payload["redsys_environment"] = form.redsys_environment;
          payload["bizum_enabled"] = form.bizum_enabled;
        }
        const res = await paymentGatewaysApi.create(tenantId, payload);
        onSaved(res.data);
      }
      onClose();
    } catch (e) {
      setErr(extractApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-klyp-navy">
            {editing ? "Editar pasarela" : "Añadir pasarela de pago"}
          </h2>
          <button onClick={onClose} className="text-klyp-gray hover:text-klyp-navy text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <Label>Tipo de pasarela</Label>
              <div className="flex gap-3">
                {(["stripe", "redsys"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      form.type === t
                        ? "border-klyp-accent bg-klyp-accent/5 text-klyp-accent"
                        : "border-klyp-pale text-klyp-gray hover:border-klyp-accent/50"
                    }`}
                  >
                    {t === "stripe" ? "Stripe" : "Redsys TPV Virtual"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nombre identificativo</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Stripe Principal" />
          </div>

          {form.type === "stripe" && (
            <>
              <div className="space-y-1.5">
                <Label>
                  Secret Key{" "}
                  {editing?.stripe_secret_key_set && (
                    <span className="text-klyp-gray font-normal">(configurada — dejar vacío para mantener)</span>
                  )}
                </Label>
                <PasswordInput value={form.stripe_secret_key} onChange={(v) => set("stripe_secret_key", v)} placeholder="sk_live_... o sk_test_..." />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Webhook Secret{" "}
                  {editing?.stripe_webhook_secret_set && (
                    <span className="text-klyp-gray font-normal">(configurado)</span>
                  )}
                </Label>
                <PasswordInput value={form.stripe_webhook_secret} onChange={(v) => set("stripe_webhook_secret", v)} placeholder="whsec_..." />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Input value={form.stripe_currency} onChange={(e) => set("stripe_currency", e.target.value.toLowerCase())} className="w-24 font-mono uppercase" placeholder="eur" />
              </div>
            </>
          )}

          {form.type === "redsys" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Código de comercio / FUC</Label>
                  <Input value={form.redsys_merchant_code} onChange={(e) => set("redsys_merchant_code", e.target.value)} placeholder="999008881" maxLength={15} />
                </div>
                <div className="space-y-1.5">
                  <Label>Terminal</Label>
                  <Input value={form.redsys_terminal} onChange={(e) => set("redsys_terminal", e.target.value)} placeholder="001" maxLength={3} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Clave secreta (HMAC-SHA512){" "}
                  {editing?.redsys_secret_key_set && (
                    <span className="text-klyp-gray font-normal">(configurada — dejar vacío para mantener)</span>
                  )}
                </Label>
                <PasswordInput value={form.redsys_secret_key} onChange={(v) => set("redsys_secret_key", v)} placeholder="sq7HjrUOBfKmC576ILgskD5srU870gJ7..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Moneda (ISO 4217)</Label>
                  <Input value={form.redsys_currency} onChange={(e) => set("redsys_currency", e.target.value)} placeholder="978" maxLength={3} className="w-24" />
                  <p className="text-xs text-klyp-gray">978 = EUR</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Entorno</Label>
                  <select
                    value={form.redsys_environment}
                    onChange={(e) => set("redsys_environment", e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="sandbox">Sandbox (pruebas)</option>
                    <option value="production">Producción</option>
                  </select>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-klyp-pale bg-klyp-pale/30 p-3">
                <input
                  type="checkbox"
                  id="bizum-enabled"
                  checked={form.bizum_enabled}
                  onChange={(e) => setForm((p) => ({ ...p, bizum_enabled: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div>
                  <Label htmlFor="bizum-enabled" className="cursor-pointer">Activar Bizum</Label>
                  <p className="text-xs text-klyp-gray mt-0.5">
                    Permite pagar con Bizum además de tarjeta (usa las mismas credenciales Redsys).
                  </p>
                </div>
              </div>
            </>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-3 pt-2">
            <Button onClick={() => void handleSubmit()} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editing ? "Guardar cambios" : "Añadir pasarela"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tabla de gateways ────────────────────────────────────────────────────────

function GatewayBadge({ type }: { type: string }) {
  if (type === "stripe") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">Stripe</span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Redsys</span>
  );
}

interface GatewayTableProps {
  tenantId: string;
  gateways: PaymentGateway[];
  onEdit: (gw: PaymentGateway) => void;
  onToggle: (gw: PaymentGateway) => void;
  onDelete: (gw: PaymentGateway) => void;
  toggling: string | null;
  deleting: string | null;
}

function GatewayTable({ gateways, onEdit, onToggle, onDelete, toggling, deleting }: GatewayTableProps) {
  if (gateways.length === 0) {
    return (
      <div className="text-center py-10 text-klyp-gray text-sm border border-dashed border-klyp-pale rounded-lg">
        No hay pasarelas configuradas para esta empresa.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-klyp-pale">
      <table className="w-full text-sm">
        <thead className="bg-klyp-pale/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-klyp-navy">Nombre</th>
            <th className="text-left px-4 py-3 font-medium text-klyp-navy">Tipo</th>
            <th className="text-left px-4 py-3 font-medium text-klyp-navy">Estado</th>
            <th className="text-left px-4 py-3 font-medium text-klyp-navy">Credenciales</th>
            <th className="text-left px-4 py-3 font-medium text-klyp-navy">Entorno</th>
            <th className="text-right px-4 py-3 font-medium text-klyp-navy">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-klyp-pale">
          {gateways.map((gw) => (
            <tr key={gw.id} className="hover:bg-klyp-pale/20 transition-colors">
              <td className="px-4 py-3 font-medium text-klyp-navy">{gw.name}</td>
              <td className="px-4 py-3"><GatewayBadge type={gw.type} /></td>
              <td className="px-4 py-3">
                {gw.is_active ? (
                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Activa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-klyp-gray">
                    <XCircle className="h-3.5 w-3.5" /> Inactiva
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-klyp-gray">
                {gw.type === "stripe" ? (
                  <span>
                    SK: {gw.stripe_secret_key_set ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                    {" · "}Webhook: {gw.stripe_webhook_secret_set ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                    {" · "}{gw.stripe_currency.toUpperCase()}
                  </span>
                ) : (
                  <span>
                    FUC: {gw.redsys_merchant_code ?? <span className="text-red-500">—</span>}
                    {" · "}Term: {gw.redsys_terminal ?? <span className="text-red-500">—</span>}
                    {" · "}SK: {gw.redsys_secret_key_set ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                    {" · "}{gw.redsys_currency}
                    {gw.bizum_enabled && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Bizum</span>
                    )}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-klyp-gray">
                {gw.type === "redsys" ? (
                  <span className={gw.redsys_environment === "production" ? "text-green-700 font-medium" : "text-amber-600"}>
                    {gw.redsys_environment === "production" ? "Producción" : "Sandbox"}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-klyp-gray hover:text-klyp-navy"
                    title="Editar"
                    onClick={() => onEdit(gw)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${gw.is_active ? "text-green-600 hover:text-green-700" : "text-klyp-gray hover:text-green-600"}`}
                    title={gw.is_active ? "Desactivar" : "Activar"}
                    onClick={() => onToggle(gw)}
                    disabled={toggling === gw.id}
                  >
                    {toggling === gw.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-klyp-gray hover:text-red-600"
                    title="Eliminar"
                    onClick={() => onDelete(gw)}
                    disabled={deleting === gw.id}
                  >
                    {deleting === gw.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

type Tab = "gateways" | "smtp";

export default function TenantConfigPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("gateways");
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Gateway dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingGw, setEditingGw] = useState<PaymentGateway | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [gwError, setGwError] = useState<string | null>(null);

  // SMTP
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      tenantsApi.get(id),
      tenantsApi.getConfig(id),
      paymentGatewaysApi.list(id),
    ]).then(([tRes, cRes, gwRes]) => {
      setTenant(tRes.data);
      const c = cRes.data;
      setConfig(c);
      setSmtpEnabled(c.smtp_enabled);
      setSmtpHost(c.smtp_host ?? "");
      setSmtpPort(c.smtp_port);
      setSmtpUser(c.smtp_user ?? "");
      setSmtpFrom(c.smtp_from ?? "");
      setGateways(gwRes.data);
    }).catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSaveSmtp = async () => {
    setSaving(true); setError(null); setSuccess(false);
    const payload: Record<string, unknown> = {
      smtp_enabled: smtpEnabled,
      smtp_host: smtpHost || null,
      smtp_port: smtpPort,
      smtp_user: smtpUser || null,
      smtp_from: smtpFrom || null,
    };
    if (smtpPass) payload["smtp_password"] = smtpPass;
    try {
      const res = await tenantsApi.updateConfig(id, payload as Parameters<typeof tenantsApi.updateConfig>[1]);
      setConfig(res.data);
      setSmtpPass("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(extractApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  const handleToggle = async (gw: PaymentGateway) => {
    setToggling(gw.id); setGwError(null);
    try {
      const res = await paymentGatewaysApi.update(id, gw.id, { is_active: !gw.is_active });
      setGateways((prev) => prev.map((g) =>
        g.type === gw.type ? { ...g, is_active: false } : g
      ).map((g) => g.id === gw.id ? res.data : g));
    } catch (e) {
      setGwError(extractApiErrorMessage(e));
    } finally { setToggling(null); }
  };

  const handleDelete = async (gw: PaymentGateway) => {
    if (!confirm(`¿Eliminar la pasarela "${gw.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(gw.id); setGwError(null);
    try {
      await paymentGatewaysApi.delete(id, gw.id);
      setGateways((prev) => prev.filter((g) => g.id !== gw.id));
    } catch (e) {
      setGwError(extractApiErrorMessage(e));
    } finally { setDeleting(null); }
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 py-8 text-klyp-gray">
      <Loader2 className="animate-spin h-5 w-5" /><span>Cargando...</span>
    </div>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "gateways", label: "Pasarelas de pago" },
    { id: "smtp", label: "SMTP" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">{tenant?.name}</h1>
          <p className="text-sm text-klyp-gray">Configuración de pasarelas de pago y SMTP</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-klyp-pale">
        <nav className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-klyp-accent text-klyp-accent"
                  : "border-transparent text-klyp-gray hover:text-klyp-navy hover:border-klyp-pale"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Pasarelas de pago ─── */}
      {tab === "gateways" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-klyp-gray">
                Gestiona las pasarelas de pago de <strong className="text-klyp-navy">{tenant?.name}</strong>.
                Solo puede haber una activa por tipo.
              </p>
            </div>
            <Button
              onClick={() => { setEditingGw(null); setShowDialog(true); }}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" />Añadir
            </Button>
          </div>

          {gwError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{gwError}</div>
          )}

          <GatewayTable
            tenantId={id}
            gateways={gateways}
            onEdit={(gw) => { setEditingGw(gw); setShowDialog(true); }}
            onToggle={handleToggle}
            onDelete={handleDelete}
            toggling={toggling}
            deleting={deleting}
          />

          {gateways.some((g) => g.type === "redsys" && g.is_active) && (
            <div className="bg-klyp-pale/40 border border-klyp-pale rounded-lg p-4">
              <p className="text-xs text-klyp-gray font-medium mb-1">URL de notificación IPN (Redsys)</p>
              <code className="block bg-white border border-klyp-pale rounded px-3 py-2 text-xs font-mono text-klyp-navy break-all">
                {process.env["NEXT_PUBLIC_API_URL"] ?? ""}/api/v1/redsys/notification
              </code>
              <p className="text-xs text-klyp-gray mt-1">
                Configura esta URL en el portal Redsys como &quot;URL de notificación&quot; (Ds_Merchant_MerchantURL).
              </p>
            </div>
          )}
          {gateways.some((g) => g.type === "stripe" && g.is_active) && (
            <div className="bg-klyp-pale/40 border border-klyp-pale rounded-lg p-4">
              <p className="text-xs text-klyp-gray font-medium mb-1">URL del webhook (Stripe)</p>
              <code className="block bg-white border border-klyp-pale rounded px-3 py-2 text-xs font-mono text-klyp-navy break-all">
                {process.env["NEXT_PUBLIC_API_URL"] ?? ""}/api/v1/webhooks/stripe/{tenant?.slug}
              </code>
            </div>
          )}
        </div>
      )}

      {/* ─── SMTP ─── */}
      {tab === "smtp" && (
        <div className="bg-white rounded-lg border border-klyp-pale p-6 space-y-4">
          <SectionTitle>SMTP — Envío de emails</SectionTitle>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="smtp-enabled"
              checked={smtpEnabled}
              onChange={(e) => setSmtpEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="smtp-enabled">Habilitar envío de emails</Label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Host SMTP</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Puerto</Label>
              <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)} className="w-28" />
            </div>
            <div className="space-y-1.5">
              <Label>Usuario SMTP</Label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="reservas@tuempresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>
                Contraseña{" "}
                <span className="text-klyp-gray font-normal">{config?.smtp_password_set ? "(configurada)" : ""}</span>
              </Label>
              <PasswordInput value={smtpPass} onChange={setSmtpPass} placeholder="Dejar vacío para mantener" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email remitente (From)</Label>
              <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="Camping El Pinar <reservas@camping.com>" />
            </div>
          </div>

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
              Configuración SMTP guardada correctamente.
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button onClick={() => void handleSaveSmtp()} disabled={saving} className="min-h-[44px]">
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Guardar SMTP</>
            )}
          </Button>
        </div>
      )}

      {/* Dialog de gateway */}
      {showDialog && (
        <GatewayDialog
          tenantId={id}
          editing={editingGw}
          onClose={() => { setShowDialog(false); setEditingGw(null); }}
          onSaved={(gw) => {
            setGateways((prev) => {
              const exists = prev.find((g) => g.id === gw.id);
              return exists ? prev.map((g) => g.id === gw.id ? gw : g) : [...prev, gw];
            });
          }}
        />
      )}
    </div>
  );
}
