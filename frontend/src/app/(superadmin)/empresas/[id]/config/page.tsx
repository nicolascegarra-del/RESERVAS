"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenantsApi, type TenantSummary, type TenantConfig } from "@/lib/superadminApi";
import { extractApiErrorMessage } from "@/lib/utils";

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

export default function TenantConfigPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Stripe
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeKey, setStripeKey] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripeCurrency, setStripeCurrency] = useState("eur");

  // SMTP
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  // Redsys
  const [redsysEnabled, setRedsysEnabled] = useState(false);
  const [redsysMerchantCode, setRedsysMerchantCode] = useState("");
  const [redsysTerminal, setRedsysTerminal] = useState("");
  const [redsysKey, setRedsysKey] = useState("");
  const [redsysCurrency, setRedsysCurrency] = useState("978");
  const [redsysEnvironment, setRedsysEnvironment] = useState("sandbox");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redsys: estado de guardado independiente
  const [redsysSaving, setRedsysSaving] = useState(false);
  const [redsysSuccess, setRedsysSuccess] = useState(false);
  const [redsysError, setRedsysError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([tenantsApi.get(id), tenantsApi.getConfig(id)]).then(([tRes, cRes]) => {
      setTenant(tRes.data);
      const c = cRes.data;
      setConfig(c);
      setStripeEnabled(c.stripe_enabled);
      setStripeCurrency(c.stripe_currency);
      setSmtpEnabled(c.smtp_enabled);
      setSmtpHost(c.smtp_host ?? "");
      setSmtpPort(c.smtp_port);
      setSmtpUser(c.smtp_user ?? "");
      setSmtpFrom(c.smtp_from ?? "");
      setRedsysEnabled(c.redsys_enabled);
      setRedsysMerchantCode(c.redsys_merchant_code ?? "");
      setRedsysTerminal(c.redsys_terminal ?? "");
      setRedsysCurrency(c.redsys_currency);
      setRedsysEnvironment(c.redsys_environment);
    }).catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false);
    const payload: Record<string, unknown> = {
      stripe_enabled: stripeEnabled,
      stripe_currency: stripeCurrency,
      smtp_enabled: smtpEnabled,
      smtp_host: smtpHost || null,
      smtp_port: smtpPort,
      smtp_user: smtpUser || null,
      smtp_from: smtpFrom || null,
    };
    if (stripeKey) payload["stripe_secret_key"] = stripeKey;
    if (stripeWebhook) payload["stripe_webhook_secret"] = stripeWebhook;
    if (smtpPass) payload["smtp_password"] = smtpPass;

    try {
      const res = await tenantsApi.updateConfig(id, payload as Parameters<typeof tenantsApi.updateConfig>[1]);
      setConfig(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(extractApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  const handleSaveRedsys = async () => {
    setRedsysSaving(true); setRedsysError(null); setRedsysSuccess(false);
    const payload: Record<string, unknown> = {
      redsys_enabled: redsysEnabled,
      redsys_merchant_code: redsysMerchantCode || null,
      redsys_terminal: redsysTerminal || null,
      redsys_currency: redsysCurrency,
      redsys_environment: redsysEnvironment,
    };
    if (redsysKey) payload["redsys_secret_key"] = redsysKey;

    try {
      const res = await tenantsApi.updateConfig(id, payload as Parameters<typeof tenantsApi.updateConfig>[1]);
      setConfig(res.data);
      setRedsysKey("");
      setRedsysSuccess(true);
      setTimeout(() => setRedsysSuccess(false), 3000);
    } catch (e: unknown) {
      setRedsysError(extractApiErrorMessage(e));
    } finally { setRedsysSaving(false); }
  };

  if (isLoading) return <div className="flex items-center gap-2 py-8 text-klyp-gray"><Loader2 className="animate-spin h-5 w-5" /><span>Cargando...</span></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">{tenant?.name}</h1>
          <p className="text-sm text-klyp-gray">Configuración de pasarelas de pago y SMTP</p>
        </div>
      </div>

      {/* Stripe */}
      <div className="bg-white rounded-lg border border-klyp-pale p-6 space-y-4">
        <SectionTitle>Stripe — Pagos online</SectionTitle>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="stripe-enabled" checked={stripeEnabled} onChange={(e) => setStripeEnabled(e.target.checked)} className="h-4 w-4" />
          <Label htmlFor="stripe-enabled">Habilitar pagos con Stripe</Label>
        </div>
        <div className="space-y-1.5">
          <Label>Secret Key <span className="text-klyp-gray font-normal">{config?.stripe_secret_key_set ? "(configurada — dejar vacío para mantener)" : "(no configurada)"}</span></Label>
          <PasswordInput value={stripeKey} onChange={setStripeKey} placeholder="sk_live_... o sk_test_..." />
        </div>
        <div className="space-y-1.5">
          <Label>Webhook Secret <span className="text-klyp-gray font-normal">{config?.stripe_webhook_secret_set ? "(configurado)" : "(no configurado)"}</span></Label>
          <PasswordInput value={stripeWebhook} onChange={setStripeWebhook} placeholder="whsec_..." />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Input value={stripeCurrency} onChange={(e) => setStripeCurrency(e.target.value.toLowerCase())} placeholder="eur" className="w-24 font-mono uppercase" />
        </div>
        <p className="text-xs text-klyp-gray">
          URL del webhook para Stripe: <code className="bg-gray-100 px-1 rounded">/api/v1/webhooks/stripe/{tenant?.slug}</code>
        </p>
      </div>

      {/* SMTP */}
      <div className="bg-white rounded-lg border border-klyp-pale p-6 space-y-4">
        <SectionTitle>SMTP — Envío de emails</SectionTitle>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="smtp-enabled" checked={smtpEnabled} onChange={(e) => setSmtpEnabled(e.target.checked)} className="h-4 w-4" />
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
            <Label>Contraseña <span className="text-klyp-gray font-normal">{config?.smtp_password_set ? "(configurada)" : ""}</span></Label>
            <PasswordInput value={smtpPass} onChange={setSmtpPass} placeholder="Dejar vacío para mantener" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email remitente (From)</Label>
            <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="Camping El Pinar <reservas@camping.com>" />
          </div>
        </div>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          Configuración guardada correctamente.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button onClick={() => void handleSave()} disabled={saving} className="min-h-[44px]">
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
        ) : (
          <><Save className="mr-2 h-4 w-4" />Guardar Stripe y SMTP</>
        )}
      </Button>

      {/* Redsys */}
      <div className="bg-white rounded-lg border border-klyp-pale p-6 space-y-4">
        <SectionTitle>Redsys — TPV Virtual</SectionTitle>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="redsys-enabled"
            checked={redsysEnabled}
            onChange={(e) => setRedsysEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="redsys-enabled">Habilitar pagos con Redsys</Label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Código de comercio / FUC</Label>
            <Input
              value={redsysMerchantCode}
              onChange={(e) => setRedsysMerchantCode(e.target.value)}
              placeholder="Ej: 999008881"
              maxLength={15}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Terminal</Label>
            <Input
              value={redsysTerminal}
              onChange={(e) => setRedsysTerminal(e.target.value)}
              placeholder="Ej: 001"
              maxLength={3}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Clave secreta (HMAC-SHA512){" "}
              <span className="text-klyp-gray font-normal">
                {config?.redsys_secret_key_set
                  ? "(configurada — dejar vacío para mantener)"
                  : "(no configurada)"}
              </span>
            </Label>
            <PasswordInput
              value={redsysKey}
              onChange={setRedsysKey}
              placeholder="sq7HjrUOBfKmC576ILgskD5srU870gJ7..."
            />
            <p className="text-xs text-amber-600">
              Al cambiar la clave, Redsys se deshabilitará automáticamente hasta que la reactives manualmente.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Moneda (ISO 4217 numérico)</Label>
            <Input
              value={redsysCurrency}
              onChange={(e) => setRedsysCurrency(e.target.value)}
              placeholder="978"
              maxLength={3}
              className="w-24"
            />
            <p className="text-xs text-klyp-gray">978 = EUR</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Entorno</Label>
            <select
              value={redsysEnvironment}
              onChange={(e) => setRedsysEnvironment(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-48"
            >
              <option value="sandbox">Sandbox (pruebas)</option>
              <option value="production">Producción</option>
            </select>
            <p className="text-xs text-klyp-gray">
              Sandbox:{" "}
              <code className="bg-gray-100 px-1 rounded">sis-t.redsys.es</code>
              {" · "}Producción:{" "}
              <code className="bg-gray-100 px-1 rounded">sis.redsys.es</code>
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>URL de notificación IPN</Label>
            <p className="text-xs text-klyp-gray mb-1">
              Configura esta URL en el portal de Redsys como &quot;URL de notificación&quot; (Ds_Merchant_MerchantURL):
            </p>
            <code className="block bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-klyp-navy break-all">
              {process.env["NEXT_PUBLIC_API_URL"] ?? ""}/api/v1/redsys/notification
            </code>
          </div>
        </div>

        {redsysSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            Configuración de Redsys guardada correctamente.
          </div>
        )}
        {redsysError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {redsysError}
          </div>
        )}

        <Button
          onClick={() => void handleSaveRedsys()}
          disabled={redsysSaving}
          variant="outline"
          className="min-h-[44px] border-klyp-accent text-klyp-accent hover:bg-klyp-accent hover:text-white"
        >
          {redsysSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando Redsys...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Guardar Redsys</>
          )}
        </Button>
      </div>
    </div>
  );
}
