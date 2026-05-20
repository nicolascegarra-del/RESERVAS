"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Users, Building2, Loader2,
  PauseCircle, PlayCircle, ChevronUp, ChevronDown, SlidersHorizontal,
  Upload, AlertTriangle, CreditCard, Mail, Info, LogIn, Globe,
  GripVertical, Palette, Save,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
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
import { tenantsApi, type TenantSummary, type TenantCreatePayload } from "@/lib/superadminApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantUsersDialog } from "./TenantUsersDialog";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ─── Formulario compartido ────────────────────────────────────────────────────

type TenantFormData = {
  name: string; slug: string; legal_name: string; cif: string; address: string;
  postal_code: string; municipality: string; province: string;
  contact_email: string; contact_phone: string; bank_account: string;
  max_company_admins: number; max_reception_users: number;
};

const emptyForm = (): TenantFormData => ({
  name: "", slug: "", legal_name: "", cif: "", address: "",
  postal_code: "", municipality: "", province: "",
  contact_email: "", contact_phone: "", bank_account: "",
  max_company_admins: 5, max_reception_users: 20,
});

function TenantFormFields({ form, setForm }: {
  form: TenantFormData;
  setForm: React.Dispatch<React.SetStateAction<TenantFormData>>;
}) {
  const field = (key: keyof TenantFormData) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: key.startsWith("max_") ? Number(e.target.value) : e.target.value })),
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Datos básicos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-full">
            <Label>Nombre comercial <span className="text-red-500">*</span></Label>
            <Input {...field("name")} required />
          </div>
          <div className="space-y-1.5 col-span-full">
            <Label>Slug (URL único) <span className="text-red-500">*</span></Label>
            <Input {...field("slug")} placeholder="mi-empresa" required />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Datos fiscales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-full">
            <Label>Razón social</Label>
            <Input {...field("legal_name")} />
          </div>
          <div className="space-y-1.5">
            <Label>CIF / NIF</Label>
            <Input {...field("cif")} />
          </div>
          <div className="space-y-1.5">
            <Label>Cuenta bancaria</Label>
            <Input {...field("bank_account")} placeholder="ES00 0000..." />
          </div>
          <div className="space-y-1.5 col-span-full">
            <Label>Domicilio fiscal</Label>
            <Input {...field("address")} />
          </div>
          <div className="space-y-1.5">
            <Label>Código postal</Label>
            <Input {...field("postal_code")} />
          </div>
          <div className="space-y-1.5">
            <Label>Municipio</Label>
            <Input {...field("municipality")} />
          </div>
          <div className="space-y-1.5">
            <Label>Provincia</Label>
            <Input {...field("province")} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-full">
            <Label>Email de contacto</Label>
            <Input type="email" {...field("contact_email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input {...field("contact_phone")} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Límites de usuarios</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Máx. Admin Empresa</Label>
            <Input type="number" min={1} max={100} {...field("max_company_admins")} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. Gestión</Label>
            <Input type="number" min={1} max={500} {...field("max_reception_users")} />
          </div>
        </div>
      </div>
      <p className="text-xs text-klyp-gray">Los campos con <span className="text-red-500 font-medium">*</span> son obligatorios. El resto puede completarse después.</p>
    </div>
  );
}

// ─── Dialogo Crear ────────────────────────────────────────────────────────────

function CreateTenantDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (t: TenantSummary) => void;
}) {
  const [form, setForm] = useState<TenantFormData>(emptyForm());
  const [config, setConfig] = useState<ConfigFormData>(emptyConfig());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!form.name || !form.slug) { setError("Nombre y slug son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const payload: TenantCreatePayload = {
        ...form,
        legal_name: form.legal_name || null,
        cif: form.cif || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        municipality: form.municipality || null,
        province: form.province || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        bank_account: form.bank_account || null,
      };
      const res = await tenantsApi.create(payload);
      let newTenant = res.data;

      // Subir logo si se seleccionó uno
      if (logoFile) {
        const logoRes = await tenantsApi.uploadLogo(newTenant.id, logoFile);
        newTenant = logoRes.data;
      }

      // Aplicar config Stripe/SMTP si se rellenó algo
      const hasStripeConfig = config.stripe_secret_key || config.stripe_webhook_secret || config.stripe_enabled;
      const hasSmtpConfig = config.smtp_host || config.smtp_user || config.smtp_password || config.smtp_enabled;
      if (hasStripeConfig || hasSmtpConfig) {
        const configPayload: Record<string, unknown> = {
          stripe_enabled: config.stripe_enabled,
          stripe_currency: config.stripe_currency,
          smtp_enabled: config.smtp_enabled,
          smtp_host: config.smtp_host || null,
          smtp_port: config.smtp_port,
          smtp_user: config.smtp_user || null,
          smtp_from: config.smtp_from || null,
        };
        if (config.stripe_secret_key) configPayload["stripe_secret_key"] = config.stripe_secret_key;
        if (config.stripe_webhook_secret) configPayload["stripe_webhook_secret"] = config.stripe_webhook_secret;
        if (config.smtp_password) configPayload["smtp_password"] = config.smtp_password;
        await tenantsApi.updateConfig(newTenant.id, configPayload as Parameters<typeof tenantsApi.updateConfig>[1]);
      }

      onCreated(newTenant);
      setForm(emptyForm());
      setConfig(emptyConfig());
      setLogoFile(null);
      setLogoPreview(null);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear la empresa.");
    } finally { setSaving(false); }
  };

  const cfgField = (key: ConfigStringKey) => ({
    value: String(config[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((p) => ({ ...p, [key]: key === "smtp_port" ? Number(e.target.value) : e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(emptyForm()); setConfig(emptyConfig()); setError(null); } onOpenChange(v); }}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* ── Cabecera visual ── */}
        <div className="bg-klyp-navy px-6 py-5 rounded-t-lg">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {!logoPreview && <Building2 className="h-7 w-7 text-white/60" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoPreview && <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight">
                {form.name || "Nueva Empresa"}
              </h2>
              <p className="text-white/50 text-xs mt-0.5">{form.slug || "slug-de-la-empresa"}</p>
            </div>
            <span className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium bg-green-400/20 text-green-300 border border-green-400/30">
              Nueva
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full mb-4 grid grid-cols-3 h-auto p-1">
              <TabsTrigger value="general" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>General</span>
              </TabsTrigger>
              <TabsTrigger value="stripe" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span>Stripe</span>
                {config.stripe_enabled && <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-purple-500 ml-0.5" />}
              </TabsTrigger>
              <TabsTrigger value="smtp" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>SMTP</span>
                {config.smtp_enabled && <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-blue-500 ml-0.5" />}
              </TabsTrigger>
            </TabsList>

            {/* ── General ── */}
            <TabsContent value="general" className="space-y-5 mt-0">
              {/* Logo upload */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white overflow-hidden shrink-0">
                  {!logoPreview && <Building2 className="h-6 w-6 text-gray-300" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview && <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoFile ? "Cambiar Logo" : "Añadir Logo"}
                  </Button>
                  <p className="text-xs text-klyp-gray mt-1">PNG, JPEG, WebP o SVG</p>
                </div>
              </div>
              <TenantFormFields form={form} setForm={setForm} />
            </TabsContent>

            {/* ── Stripe ── */}
            <TabsContent value="stripe" className="space-y-4 mt-0">
              <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors" style={{
                borderColor: config.stripe_enabled ? "rgb(147 51 234 / 0.3)" : "rgb(229 231 235)",
                backgroundColor: config.stripe_enabled ? "rgb(250 245 255)" : "rgb(249 250 251)",
              }}>
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.stripe_enabled ? "bg-purple-100" : "bg-gray-100"}`}>
                    <CreditCard className={`h-5 w-5 ${config.stripe_enabled ? "text-purple-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-klyp-navy">TPV virtual (Stripe)</p>
                    <p className="text-xs text-klyp-gray">Pagos online con tarjeta</p>
                  </div>
                </div>
                <ToggleSwitch enabled={config.stripe_enabled} onChange={() => setConfig((p) => ({ ...p, stripe_enabled: !p.stripe_enabled }))} />
              </div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Clave secreta (Secret Key)</Label>
                  <Input type="password" {...cfgField("stripe_secret_key")} placeholder="sk_live_..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Webhook Secret</Label>
                  <Input type="password" {...cfgField("stripe_webhook_secret")} placeholder="whsec_..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Moneda</Label>
                  <Input {...cfgField("stripe_currency")} placeholder="EUR" maxLength={3} className="uppercase w-24" />
                </div>
              </div>
            </TabsContent>

            {/* ── SMTP ── */}
            <TabsContent value="smtp" className="space-y-4 mt-0">
              <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors" style={{
                borderColor: config.smtp_enabled ? "rgb(59 130 246 / 0.3)" : "rgb(229 231 235)",
                backgroundColor: config.smtp_enabled ? "rgb(239 246 255)" : "rgb(249 250 251)",
              }}>
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.smtp_enabled ? "bg-blue-100" : "bg-gray-100"}`}>
                    <Mail className={`h-5 w-5 ${config.smtp_enabled ? "text-blue-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-klyp-navy">Correo SMTP propio</p>
                    <p className="text-xs text-klyp-gray">Emails transaccionales de esta empresa</p>
                  </div>
                </div>
                <ToggleSwitch enabled={config.smtp_enabled} onChange={() => setConfig((p) => ({ ...p, smtp_enabled: !p.smtp_enabled }))} />
              </div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Servidor (Host)</Label>
                    <Input {...cfgField("smtp_host")} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Puerto</Label>
                    <Input type="number" {...cfgField("smtp_port")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Usuario</Label>
                  <Input {...cfgField("smtp_user")} placeholder="noreply@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Contraseña</Label>
                  <Input type="password" {...cfgField("smtp_password")} placeholder="Contraseña SMTP" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Email remitente (From)</Label>
                  <Input type="email" {...cfgField("smtp_from")} placeholder="noreply@empresa.com" />
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 bg-klyp-pale rounded-lg border border-klyp-accent/20 text-xs text-klyp-gray">
                <Info className="h-3.5 w-3.5 text-klyp-accent shrink-0 mt-0.5" />
                <span>Si no hay SMTP propio configurado, se usará el <strong className="text-klyp-navy">SMTP global</strong> del sistema como fallback.</span>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Creando..." : "Crear Empresa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogo Editar ───────────────────────────────────────────────────────────

type ConfigFormData = {
  stripe_enabled: boolean;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  stripe_currency: string;
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
  redsys_enabled: boolean;
  redsys_merchant_code: string;
  redsys_terminal: string;
  redsys_secret_key: string;
  redsys_currency: string;
  redsys_environment: string;
};
type ConfigStringKey = Exclude<keyof ConfigFormData, "stripe_enabled" | "smtp_enabled" | "redsys_enabled">;

const emptyConfig = (): ConfigFormData => ({
  stripe_enabled: false, stripe_secret_key: "", stripe_webhook_secret: "", stripe_currency: "EUR",
  smtp_enabled: false, smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "", smtp_from: "",
  redsys_enabled: false, redsys_merchant_code: "", redsys_terminal: "", redsys_secret_key: "", redsys_currency: "978", redsys_environment: "sandbox",
});

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-klyp-accent" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function EditTenantDialog({ tenant, open, onOpenChange, onUpdated }: {
  tenant: TenantSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (t: TenantSummary) => void;
}) {
  const [form, setForm] = useState<TenantFormData>({
    name: tenant.name,
    slug: tenant.slug,
    legal_name: tenant.legal_name ?? "",
    cif: tenant.cif ?? "",
    address: tenant.address ?? "",
    postal_code: tenant.postal_code ?? "",
    municipality: tenant.municipality ?? "",
    province: tenant.province ?? "",
    contact_email: tenant.contact_email ?? "",
    contact_phone: tenant.contact_phone ?? "",
    bank_account: tenant.bank_account ?? "",
    max_company_admins: tenant.max_company_admins,
    max_reception_users: tenant.max_reception_users,
  });
  const [config, setConfig] = useState<ConfigFormData>(emptyConfig());
  const [configMeta, setConfigMeta] = useState({ stripe_secret_key_set: false, stripe_webhook_secret_set: false, smtp_password_set: false, smtp_verified_at: null as string | null, redsys_secret_key_set: false });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    tenant.logo_url ? `${API_URL}${tenant.logo_url}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState({
    brand_name: tenant.brand_name ?? "",
    tagline: tenant.tagline ?? "",
    primary_color: tenant.primary_color ?? "",
    accent_color: tenant.accent_color ?? "",
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingConfig(true);
    tenantsApi.getConfig(tenant.id)
      .then((res) => {
        const d = res.data;
        setConfig({
          stripe_enabled: d.stripe_enabled,
          stripe_secret_key: "",
          stripe_webhook_secret: "",
          stripe_currency: d.stripe_currency,
          smtp_enabled: d.smtp_enabled,
          smtp_host: d.smtp_host ?? "",
          smtp_port: d.smtp_port,
          smtp_user: d.smtp_user ?? "",
          smtp_password: "",
          smtp_from: d.smtp_from ?? "",
          redsys_enabled: d.redsys_enabled,
          redsys_merchant_code: d.redsys_merchant_code ?? "",
          redsys_terminal: d.redsys_terminal ?? "",
          redsys_secret_key: "",
          redsys_currency: d.redsys_currency,
          redsys_environment: d.redsys_environment,
        });
        setConfigMeta({
          stripe_secret_key_set: d.stripe_secret_key_set,
          stripe_webhook_secret_set: d.stripe_webhook_secret_set,
          smtp_password_set: d.smtp_password_set,
          smtp_verified_at: d.smtp_verified_at ?? null,
          redsys_secret_key_set: d.redsys_secret_key_set,
        });
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, [open, tenant.id]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await tenantsApi.uploadLogo(tenant.id, file);
      onUpdated(res.data);
      setLogoPreview(res.data.logo_url ? `${API_URL}${res.data.logo_url}` : null);
    } catch {
      setError("Error al subir el logo.");
    } finally { setUploadingLogo(false); }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true); setSmtpTestResult(null);
    try {
      const res = await tenantsApi.testSMTP(tenant.id);
      setSmtpTestResult({ ok: true, message: "Conexión verificada correctamente." });
      setConfigMeta((p) => ({ ...p, smtp_verified_at: res.data.verified_at }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setSmtpTestResult({ ok: false, message: err.response?.data?.detail?.error?.message ?? "Error al conectar." });
    } finally { setTestingSmtp(false); }
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) { setError("Nombre y slug son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const configPayload: Record<string, unknown> = {
        stripe_enabled: config.stripe_enabled,
        stripe_currency: config.stripe_currency,
        smtp_enabled: config.smtp_enabled,
        smtp_host: config.smtp_host || null,
        smtp_port: config.smtp_port,
        smtp_user: config.smtp_user || null,
        smtp_from: config.smtp_from || null,
        redsys_enabled: config.redsys_enabled,
        redsys_merchant_code: config.redsys_merchant_code || null,
        redsys_terminal: config.redsys_terminal || null,
        redsys_currency: config.redsys_currency,
        redsys_environment: config.redsys_environment,
      };
      if (config.stripe_secret_key) configPayload["stripe_secret_key"] = config.stripe_secret_key;
      if (config.stripe_webhook_secret) configPayload["stripe_webhook_secret"] = config.stripe_webhook_secret;
      if (config.smtp_password) configPayload["smtp_password"] = config.smtp_password;
      if (config.redsys_secret_key) configPayload["redsys_secret_key"] = config.redsys_secret_key;

      const [tenantRes] = await Promise.all([
        tenantsApi.update(tenant.id, {
          ...form,
          legal_name: form.legal_name || null,
          cif: form.cif || null,
          address: form.address || null,
          postal_code: form.postal_code || null,
          municipality: form.municipality || null,
          province: form.province || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          bank_account: form.bank_account || null,
        }),
        tenantsApi.updateConfig(tenant.id, configPayload as Parameters<typeof tenantsApi.updateConfig>[1]),
      ]);
      onUpdated(tenantRes.data);
      setSmtpTestResult(null);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al guardar los cambios.");
    } finally { setSaving(false); }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true); setBrandingError(null); setBrandingSuccess(false);
    try {
      const payload = {
        brand_name: branding.brand_name || null,
        tagline: branding.tagline || null,
        primary_color: HEX_RE.test(branding.primary_color) ? branding.primary_color : null,
        accent_color: HEX_RE.test(branding.accent_color) ? branding.accent_color : null,
      };
      const res = await tenantsApi.update(tenant.id, payload);
      onUpdated(res.data);
      setBrandingSuccess(true);
      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch {
      setBrandingError("No se pudo guardar el branding.");
    } finally { setSavingBranding(false); }
  };

  const cfgField = (key: ConfigStringKey) => ({
    value: String(config[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((p) => ({ ...p, [key]: key === "smtp_port" ? Number(e.target.value) : e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* ── Cabecera visual ── */}
        <div className="bg-klyp-navy px-6 py-5 rounded-t-lg">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {!logoPreview && <Building2 className="h-7 w-7 text-white/60" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoPreview && <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight truncate">{tenant.name}</h2>
              <p className="text-white/50 text-xs mt-0.5 truncate">{tenant.slug}</p>
            </div>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
              tenant.is_active ? "bg-green-400/20 text-green-300 border border-green-400/30" : "bg-red-400/20 text-red-300 border border-red-400/30"
            }`}>
              {tenant.is_active ? "Activa" : "Suspendida"}
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full mb-4 grid grid-cols-5 h-auto p-1">
              <TabsTrigger value="general" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>General</span>
              </TabsTrigger>
              <TabsTrigger value="stripe" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span>Stripe</span>
                {config.stripe_enabled && <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-purple-500 ml-0.5" />}
              </TabsTrigger>
              <TabsTrigger value="smtp" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>SMTP</span>
                {config.smtp_enabled && <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-blue-500 ml-0.5" />}
              </TabsTrigger>
              <TabsTrigger value="redsys" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span>Redsys</span>
                {config.redsys_enabled && <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-green-500 ml-0.5" />}
              </TabsTrigger>
              <TabsTrigger value="branding" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                <Palette className="h-3.5 w-3.5 shrink-0" />
                <span>Branding</span>
              </TabsTrigger>
            </TabsList>

            {/* ── General ── */}
            <TabsContent value="general" className="space-y-5 mt-0">
              {/* Logo upload */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white overflow-hidden shrink-0">
                  {!logoPreview && <Building2 className="h-6 w-6 text-gray-300" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview && <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => void handleLogoChange(e)}
                  />
                  <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploadingLogo ? "Subiendo..." : "Cambiar Logo"}
                  </Button>
                  <p className="text-xs text-klyp-gray mt-1">PNG, JPEG, WebP o SVG</p>
                </div>
              </div>

              <TenantFormFields form={form} setForm={setForm} />
            </TabsContent>

            {/* ── Stripe ── */}
            <TabsContent value="stripe" className="space-y-4 mt-0">
              {loadingConfig ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
              ) : (
                <>
                  {/* Status toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors" style={{
                    borderColor: config.stripe_enabled ? "rgb(147 51 234 / 0.3)" : "rgb(229 231 235)",
                    backgroundColor: config.stripe_enabled ? "rgb(250 245 255)" : "rgb(249 250 251)",
                  }}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.stripe_enabled ? "bg-purple-100" : "bg-gray-100"}`}>
                        <CreditCard className={`h-5 w-5 ${config.stripe_enabled ? "text-purple-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-klyp-navy">TPV virtual (Stripe)</p>
                        <p className="text-xs text-klyp-gray">Pagos online con tarjeta</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={config.stripe_enabled} onChange={() => setConfig((p) => ({ ...p, stripe_enabled: !p.stripe_enabled }))} />
                  </div>

                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Clave secreta (Secret Key)</Label>
                      <Input type="password" {...cfgField("stripe_secret_key")} placeholder={configMeta.stripe_secret_key_set ? "sk_••••••••••••••••••••" : "sk_live_..."} />
                      {configMeta.stripe_secret_key_set && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                          Configurada — deja en blanco para mantener la actual
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Webhook Secret</Label>
                      <Input type="password" {...cfgField("stripe_webhook_secret")} placeholder={configMeta.stripe_webhook_secret_set ? "whsec_••••••••••••••••••" : "whsec_..."} />
                      {configMeta.stripe_webhook_secret_set && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                          Configurado — deja en blanco para mantener el actual
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Moneda</Label>
                      <Input {...cfgField("stripe_currency")} placeholder="EUR" maxLength={3} className="uppercase w-24" />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── SMTP ── */}
            <TabsContent value="smtp" className="space-y-4 mt-0">
              {loadingConfig ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
              ) : (
                <>
                  {/* Status toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors" style={{
                    borderColor: config.smtp_enabled ? "rgb(59 130 246 / 0.3)" : "rgb(229 231 235)",
                    backgroundColor: config.smtp_enabled ? "rgb(239 246 255)" : "rgb(249 250 251)",
                  }}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.smtp_enabled ? "bg-blue-100" : "bg-gray-100"}`}>
                        <Mail className={`h-5 w-5 ${config.smtp_enabled ? "text-blue-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-klyp-navy">Correo SMTP propio</p>
                        <p className="text-xs text-klyp-gray">Emails transaccionales de esta empresa</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={config.smtp_enabled} onChange={() => setConfig((p) => ({ ...p, smtp_enabled: !p.smtp_enabled }))} />
                  </div>

                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Servidor (Host)</Label>
                        <Input {...cfgField("smtp_host")} placeholder="smtp.gmail.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Puerto</Label>
                        <Input type="number" {...cfgField("smtp_port")} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Usuario</Label>
                      <Input {...cfgField("smtp_user")} placeholder="noreply@empresa.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Contraseña</Label>
                      <Input type="password" {...cfgField("smtp_password")} placeholder={configMeta.smtp_password_set ? "••••••••••••" : "Contraseña SMTP"} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Email remitente (From)</Label>
                      <Input type="email" {...cfgField("smtp_from")} placeholder="noreply@empresa.com" />
                    </div>
                  </div>

                  {/* Estado de verificación + botón probar */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      {smtpTestResult ? (
                        <p className={`text-sm flex items-center gap-1.5 ${smtpTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                          <span className={`inline-block h-2 w-2 rounded-full ${smtpTestResult.ok ? "bg-green-500" : "bg-red-500"}`} />
                          {smtpTestResult.message}
                        </p>
                      ) : configMeta.smtp_verified_at ? (
                        <p className="text-sm text-green-600 flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                          Configuración probada y funcionando — {new Date(configMeta.smtp_verified_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      ) : (
                        <p className="text-sm text-klyp-gray">Guarda los datos y pulsa &quot;Probar Conexión&quot;.</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={testingSmtp || !config.smtp_host}
                      onClick={() => void handleTestSmtp()}
                      className="shrink-0"
                    >
                      {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {testingSmtp ? "Probando..." : "Probar Conexión"}
                    </Button>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-klyp-pale rounded-lg border border-klyp-accent/20 text-xs text-klyp-gray">
                    <Info className="h-3.5 w-3.5 text-klyp-accent shrink-0 mt-0.5" />
                    <span>Si no hay SMTP propio configurado, se usará el <strong className="text-klyp-navy">SMTP global</strong> del sistema como fallback.</span>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Redsys ── */}
            <TabsContent value="redsys" className="space-y-4 mt-0">
              {loadingConfig ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors" style={{
                    borderColor: config.redsys_enabled ? "rgb(22 163 74 / 0.3)" : "rgb(229 231 235)",
                    backgroundColor: config.redsys_enabled ? "rgb(240 253 244)" : "rgb(249 250 251)",
                  }}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.redsys_enabled ? "bg-green-100" : "bg-gray-100"}`}>
                        <CreditCard className={`h-5 w-5 ${config.redsys_enabled ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-klyp-navy">TPV Virtual (Redsys)</p>
                        <p className="text-xs text-klyp-gray">Pagos online con tarjeta vía Redsys</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={config.redsys_enabled} onChange={() => setConfig((p) => ({ ...p, redsys_enabled: !p.redsys_enabled }))} />
                  </div>
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Código de comercio / FUC</Label>
                        <Input {...cfgField("redsys_merchant_code")} placeholder="Ej: 999008881" maxLength={15} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Terminal</Label>
                        <Input {...cfgField("redsys_terminal")} placeholder="Ej: 001" maxLength={3} className="w-28" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">
                        Clave secreta (HMAC-SHA512)
                        {configMeta.redsys_secret_key_set && (
                          <span className="ml-2 normal-case font-normal text-green-600">— configurada, dejar vacío para mantener</span>
                        )}
                      </Label>
                      <Input type="password" {...cfgField("redsys_secret_key")} placeholder="sq7HjrUOBfKmC576ILgskD5srU870gJ7..." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Moneda (ISO 4217 numérico)</Label>
                        <Input {...cfgField("redsys_currency")} placeholder="978" maxLength={3} className="w-24" />
                        <p className="text-xs text-klyp-gray">978 = EUR</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Entorno</Label>
                        <select
                          value={config.redsys_environment}
                          onChange={(e) => setConfig((p) => ({ ...p, redsys_environment: e.target.value }))}
                          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full"
                        >
                          <option value="sandbox">Sandbox (pruebas)</option>
                          <option value="production">Producción</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">URL de notificación IPN</Label>
                      <code className="block bg-white border border-gray-200 rounded px-3 py-2 text-xs font-mono text-klyp-navy break-all">
                        {process.env["NEXT_PUBLIC_API_URL"] ?? ""}/api/v1/redsys/notification
                      </code>
                      <p className="text-xs text-klyp-gray">Configura esta URL en el portal de Redsys como URL de notificación.</p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Branding ── */}
            <TabsContent value="branding" className="space-y-5 mt-0">
              {/* Live preview bar */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="h-10 flex items-center px-4 gap-3"
                  style={{ backgroundColor: HEX_RE.test(branding.primary_color) ? branding.primary_color : "#051937" }}
                >
                  <div
                    className="h-5 w-5 rounded-full border-2 border-white/40"
                    style={{ backgroundColor: HEX_RE.test(branding.accent_color) ? branding.accent_color : "#2E6DB4" }}
                  />
                  <span className="text-white text-sm font-semibold truncate">
                    {branding.brand_name || tenant.name}
                  </span>
                  {branding.tagline && (
                    <span className="text-white/60 text-xs truncate">{branding.tagline}</span>
                  )}
                </div>
              </div>

              {/* Logo upload (re-uses the same input/handler) */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="h-14 w-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white overflow-hidden shrink-0">
                  {!logoPreview && <Building2 className="h-5 w-5 text-gray-300" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview && <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />}
                </div>
                <div>
                  <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploadingLogo ? "Subiendo..." : "Cambiar Logo"}
                  </Button>
                  <p className="text-xs text-klyp-gray mt-1">PNG, JPEG, WebP o SVG</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre de marca */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Nombre de marca</Label>
                  <Input
                    placeholder={tenant.name}
                    value={branding.brand_name}
                    onChange={(e) => setBranding((p) => ({ ...p, brand_name: e.target.value }))}
                  />
                </div>
                {/* Tagline */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Tagline</Label>
                  <Input
                    placeholder="Slogan corto..."
                    value={branding.tagline}
                    onChange={(e) => setBranding((p) => ({ ...p, tagline: e.target.value }))}
                  />
                </div>
                {/* Color primario */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Color primario</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={HEX_RE.test(branding.primary_color) ? branding.primary_color : "#051937"}
                      onChange={(e) => setBranding((p) => ({ ...p, primary_color: e.target.value }))}
                      className="h-10 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5 shrink-0"
                    />
                    <Input
                      placeholder="#051937"
                      value={branding.primary_color}
                      onChange={(e) => setBranding((p) => ({ ...p, primary_color: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                  {branding.primary_color && !HEX_RE.test(branding.primary_color) && (
                    <p className="text-xs text-red-500">Formato incorrecto (ej: #051937)</p>
                  )}
                </div>
                {/* Color de acento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-klyp-gray uppercase tracking-wide">Color de acento</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={HEX_RE.test(branding.accent_color) ? branding.accent_color : "#2E6DB4"}
                      onChange={(e) => setBranding((p) => ({ ...p, accent_color: e.target.value }))}
                      className="h-10 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5 shrink-0"
                    />
                    <Input
                      placeholder="#2E6DB4"
                      value={branding.accent_color}
                      onChange={(e) => setBranding((p) => ({ ...p, accent_color: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                  {branding.accent_color && !HEX_RE.test(branding.accent_color) && (
                    <p className="text-xs text-red-500">Formato incorrecto (ej: #2E6DB4)</p>
                  )}
                </div>
              </div>

              {brandingError && <p className="text-sm text-red-600">{brandingError}</p>}
              {brandingSuccess && <p className="text-sm text-green-600">Branding guardado correctamente.</p>}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handleSaveBranding()}
                  disabled={savingBranding}
                  className="bg-klyp-accent hover:bg-klyp-accent/90 text-white"
                >
                  {savingBranding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {savingBranding ? "Guardando..." : "Guardar Branding"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogo Eliminar ─────────────────────────────────────────────────────────

function DeleteTenantDialog({ tenant, open, onOpenChange, onDeleted }: {
  tenant: TenantSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!password) { setError("Introduce tu contraseña."); return; }
    setSaving(true); setError(null);
    try {
      await tenantsApi.hardDelete(tenant.id, password);
      onDeleted();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al eliminar la empresa.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPassword(""); setError(null); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Eliminar empresa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Acción irreversible</p>
              <p className="text-xs text-red-700 mt-1">
                Se eliminarán <strong>todos</strong> los datos de <strong>{tenant.name}</strong>:
                reservas, alojamientos, usuarios y configuración.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tu contraseña de superadmin</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleDelete(); }}
              placeholder="Contraseña"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleDelete()} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar Definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tipos de columnas ────────────────────────────────────────────────────────

type ColKey = "logo" | "nombre" | "cif" | "municipio" | "estado" | "stripe" | "smtp" | "creada";
type SortKey = "nombre" | "municipio" | "creada";
type SortDir = "asc" | "desc";

const STORAGE_KEY_EMPRESAS = "table_cols_empresas";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "logo", label: "Logo" },
  { key: "nombre", label: "Nombre" },
  { key: "cif", label: "CIF" },
  { key: "municipio", label: "Municipio" },
  { key: "estado", label: "Estado" },
  { key: "stripe", label: "Stripe" },
  { key: "smtp", label: "SMTP" },
  { key: "creada", label: "Creada" },
];

const DEFAULT_COLS_EMPRESAS = new Set<ColKey>(ALL_COLS.map((c) => c.key));
const ALL_COL_KEYS = ALL_COLS.map((c) => c.key) as ColKey[];

function loadEmpresasColState(): { visible: Set<ColKey>; order: ColKey[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_EMPRESAS);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return { visible: new Set(parsed as ColKey[]), order: [...ALL_COL_KEYS] };
      }
      const s = parsed as { visible?: string[]; order?: string[] };
      const order = ((s.order ?? ALL_COL_KEYS) as ColKey[]).filter((k) => ALL_COL_KEYS.includes(k));
      for (const k of ALL_COL_KEYS) { if (!order.includes(k)) order.push(k); }
      return { visible: new Set((s.visible ?? ALL_COL_KEYS) as ColKey[]), order };
    }
  } catch { /* ignore */ }
  return { visible: DEFAULT_COLS_EMPRESAS, order: [...ALL_COL_KEYS] };
}

function saveEmpresasColState(order: ColKey[], visible: Set<ColKey>) {
  localStorage.setItem(STORAGE_KEY_EMPRESAS, JSON.stringify({ visible: [...visible], order }));
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EmpresasPage() {
  const router = useRouter();
  const { setSelectedTenant } = useAuthStore();

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<TenantSummary | null>(null);
  const [usersTenant, setUsersTenant] = useState<TenantSummary | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<"all" | "active" | "suspended">("all");

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_COLS_EMPRESAS);
  const [colOrder, setColOrder] = useState<ColKey[]>([...ALL_COL_KEYS]);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tenantsApi.list();
      setTenants(res.data);
    } catch { /* silencioso */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetchTenants(); }, [fetchTenants]);

  useEffect(() => {
    const { visible, order } = loadEmpresasColState();
    setVisibleCols(visible);
    setColOrder(order);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSuspend = async (t: TenantSummary) => {
    setSuspending(t.id);
    try {
      const res = await tenantsApi.suspend(t.id);
      setTenants((prev) => prev.map((x) => x.id === t.id ? res.data : x));
    } catch { /* silencioso */ }
    finally { setSuspending(null); }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = tenants
    .filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.cif ?? "").toLowerCase().includes(q) && !(t.municipality ?? "").toLowerCase().includes(q)) return false;
      }
      if (filterState === "active" && !t.is_active) return false;
      if (filterState === "suspended" && t.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "nombre") { av = a.name; bv = b.name; }
      else if (sortKey === "municipio") { av = a.municipality ?? ""; bv = b.municipality ?? ""; }
      else if (sortKey === "creada") { av = a.created_at; bv = b.created_at; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const col = (k: ColKey) => visibleCols.has(k);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />)
      : <ChevronUp className="h-3 w-3 ml-1 inline opacity-20" />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-klyp-navy">Empresas</h1>
          <p className="text-sm text-klyp-gray mt-0.5">Gestión de todos los clientes del sistema.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px] shrink-0">
          <Plus className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nueva Empresa</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar por nombre, CIF o municipio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-[44px] w-full sm:max-w-xs"
        />
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value as "all" | "active" | "suspended")}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="suspended">Suspendidas</option>
        </select>
        <div className="relative ml-auto" ref={colMenuRef}>
          <Button variant="outline" size="sm" className="h-[44px] gap-2" onClick={() => setShowColMenu((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Columnas
          </Button>
          {showColMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
              {colOrder.map((key) => {
                const c = ALL_COLS.find((x) => x.key === key)!;
                return (
                  <label
                    key={c.key}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.key); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromKey = e.dataTransfer.getData("text/plain") as ColKey;
                      if (fromKey === c.key) return;
                      setColOrder((prev) => {
                        const next = [...prev];
                        const fromIdx = next.indexOf(fromKey);
                        const toIdx = next.indexOf(c.key);
                        next.splice(fromIdx, 1);
                        next.splice(toIdx, 0, fromKey);
                        saveEmpresasColState(next, visibleCols);
                        return next;
                      });
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm select-none"
                  >
                    <GripVertical className="h-4 w-4 text-gray-300 shrink-0 cursor-grab" />
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.key)}
                      onChange={() => setVisibleCols((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.key)) { next.delete(c.key); } else { next.add(c.key); }
                        saveEmpresasColState(colOrder, next);
                        return next;
                      })}
                      className="rounded"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-klyp-gray">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay empresas{search ? " que coincidan con la búsqueda" : ""}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {colOrder.filter(k => visibleCols.has(k)).map(k => {
                  if (k === "logo") return <th key="logo" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray w-14">Logo</th>;
                  if (k === "nombre") return <th key="nombre" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("nombre")}>Nombre<SortIcon k="nombre" /></th>;
                  if (k === "cif") return <th key="cif" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">CIF</th>;
                  if (k === "municipio") return <th key="municipio" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("municipio")}>Municipio<SortIcon k="municipio" /></th>;
                  if (k === "estado") return <th key="estado" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>;
                  if (k === "stripe") return <th key="stripe" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Stripe</th>;
                  if (k === "smtp") return <th key="smtp" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">SMTP</th>;
                  if (k === "creada") return <th key="creada" className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("creada")}>Creada<SortIcon k="creada" /></th>;
                  return null;
                })}
                <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.is_active ? "opacity-55" : ""}`}>
                  {colOrder.filter(k => visibleCols.has(k)).map(k => {
                    if (k === "logo") return (
                      <td key="logo" className="px-4 py-3">
                        <div className="h-9 w-9 rounded-md border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                          {!t.logo_url && <Building2 className="h-4 w-4 text-gray-300" />}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {t.logo_url && <img src={`${API_URL}${t.logo_url}`} alt={t.name} className="h-full w-full object-contain" />}
                        </div>
                      </td>
                    );
                    if (k === "nombre") return (
                      <td key="nombre" className="px-4 py-3">
                        <p className="font-medium text-klyp-navy">{t.name}</p>
                        <p className="text-xs text-klyp-gray">{t.slug}</p>
                      </td>
                    );
                    if (k === "cif") return <td key="cif" className="px-4 py-3 text-klyp-gray">{t.cif ?? "—"}</td>;
                    if (k === "municipio") return <td key="municipio" className="px-4 py-3 text-klyp-gray">{t.municipality ?? "—"}</td>;
                    if (k === "estado") return (
                      <td key="estado" className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.is_active ? "Activa" : "Suspendida"}
                        </span>
                      </td>
                    );
                    if (k === "stripe") return (
                      <td key="stripe" className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.stripe_enabled ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.stripe_enabled ? "Activo" : "No"}
                        </span>
                      </td>
                    );
                    if (k === "smtp") return (
                      <td key="smtp" className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.smtp_enabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.smtp_enabled ? "Activo" : "No"}
                        </span>
                      </td>
                    );
                    if (k === "creada") return (
                      <td key="creada" className="px-4 py-3 text-klyp-gray text-xs whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString("es-ES")}
                      </td>
                    );
                    return null;
                  })}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0" title="Acceder como empresa"
                        onClick={() => { setSelectedTenant(t.id, t.name); router.push("/dashboard"); }}
                        disabled={!t.is_active}
                      >
                        <LogIn className="h-4 w-4 text-klyp-accent" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Gestionar usuarios" onClick={() => setUsersTenant(t)}>
                        <Users className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver página pública"
                        onClick={() => window.open(`/${t.slug}`, "_blank")}
                      >
                        <Globe className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar empresa" onClick={() => setEditTenant(t)}>
                        <Pencil className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0"
                        title={t.is_active ? "Suspender empresa" : "Activar empresa"}
                        disabled={suspending === t.id}
                        onClick={() => void handleSuspend(t)}
                      >
                        {suspending === t.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-klyp-gray" />
                          : t.is_active
                            ? <PauseCircle className="h-4 w-4 text-amber-500" />
                            : <PlayCircle className="h-4 w-4 text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Eliminar empresa" onClick={() => setDeleteTenant(t)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-klyp-gray">
            {filtered.length} de {tenants.length} empresa{tenants.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <CreateTenantDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(t) => setTenants((prev) => [t, ...prev])}
      />
      {editTenant && (
        <EditTenantDialog
          tenant={editTenant}
          open={true}
          onOpenChange={(v) => { if (!v) setEditTenant(null); }}
          onUpdated={(t) => {
            setTenants((prev) => prev.map((x) => x.id === t.id ? t : x));
            setEditTenant(t);
          }}
        />
      )}
      {deleteTenant && (
        <DeleteTenantDialog
          tenant={deleteTenant}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteTenant(null); }}
          onDeleted={() => {
            setTenants((prev) => prev.filter((x) => x.id !== deleteTenant.id));
            setDeleteTenant(null);
          }}
        />
      )}
      {usersTenant && (
        <TenantUsersDialog
          tenant={usersTenant}
          open={true}
          onOpenChange={(v) => { if (!v) setUsersTenant(null); }}
        />
      )}
    </div>
  );
}
