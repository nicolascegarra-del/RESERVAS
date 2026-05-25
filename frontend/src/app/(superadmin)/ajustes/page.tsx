"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Mail, Save, CheckCircle2, XCircle, Server,
  KeyRound, SendHorizonal, Wifi, AlertCircle, Trash2, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  systemApi, tenantsApi, advancedApi,
  type SystemSMTP, type TenantSummary, type PurgeOperationalDataResult,
} from "@/lib/superadminApi";
import { extractApiErrorMessage } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SMTPForm = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100">
      <div className="mt-0.5 h-8 w-8 rounded-md bg-klyp-pale flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-klyp-navy">{title}</p>
        <p className="text-xs text-klyp-gray">{description}</p>
      </div>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-klyp-gray mt-1">{children}</p>;
}

// ─── Borrado avanzado ─────────────────────────────────────────────────────────

const PURGE_TABLE_LABELS: Record<string, string> = {
  guest_upload_tokens: "Tokens de subida de documentos",
  reservation_access_codes: "Códigos de acceso",
  reservation_vehicles: "Matrículas de vehículos",
  reservation_guests: "Datos de viajeros",
  reservation_history: "Historial de reservas",
  reservation_change_requests: "Solicitudes de cambio",
  refund_orders: "Órdenes de devolución",
  reservation_payments: "Cobros",
  invoices_credit_notes: "Facturas rectificativas",
  invoices: "Facturas",
  invoice_sequences: "Contadores de factura",
  reservations: "Reservas",
  blockings: "Bloqueos de calendario",
  mail_logs: "Log de emails",
  access_logs: "Log de accesos",
};

function PurgeSection() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState<PurgeOperationalDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenantsApi.list()
      .then((res) => setTenants(res.data))
      .finally(() => setLoadingTenants(false));
  }, []);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null;
  const nameMatches = confirmName.trim().toLowerCase() === (selectedTenant?.name ?? "").toLowerCase();
  const canSubmit = selectedTenantId && nameMatches && password.length >= 6;

  const handlePurge = async () => {
    if (!canSubmit) return;
    setPurging(true); setError(null); setResult(null);
    try {
      const res = await advancedApi.purgeOperationalData(selectedTenantId, password);
      setResult(res.data);
      setConfirmName("");
      setPassword("");
    } catch (e) {
      setError(extractApiErrorMessage(e));
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-6 py-4 border-b border-red-100 bg-red-50">
        <div className="mt-0.5 h-8 w-8 rounded-md bg-red-100 flex items-center justify-center shrink-0">
          <Trash2 className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800">Borrado avanzado</p>
          <p className="text-xs text-red-600">
            Elimina todos los datos operativos de una empresa manteniendo su configuración.
            Esta acción es <strong>irreversible</strong>.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Aviso */}
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-medium">¿Para qué sirve esta función?</p>
            <p className="text-xs">
              Permite hacer una limpieza completa antes de la puesta en marcha real de un camping.
              Se borran reservas, facturas, cobros, logs, bloqueos y cualquier dato de prueba.
              Se mantienen: usuarios, alojamientos, tarifas, pasarelas de pago, métodos de pago,
              configuración SMTP, branding y políticas de cancelación.
            </p>
          </div>
        </div>

        {/* Paso 1: Empresa */}
        <div className="space-y-1.5">
          <Label>Paso 1 — Selecciona la empresa</Label>
          {loadingTenants ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : (
            <select
              value={selectedTenantId}
              onChange={(e) => { setSelectedTenantId(e.target.value); setConfirmName(""); setResult(null); setError(null); }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Seleccionar empresa —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Paso 2: Confirmación por nombre */}
        {selectedTenant && (
          <div className="space-y-1.5">
            <Label>
              Paso 2 — Escribe <strong className="font-semibold text-red-700">{selectedTenant.name}</strong> para confirmar
            </Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedTenant.name}
              className={confirmName && !nameMatches ? "border-red-400 focus-visible:ring-red-300" : ""}
            />
            {confirmName && !nameMatches && (
              <p className="text-xs text-red-600">El nombre no coincide.</p>
            )}
          </div>
        )}

        {/* Paso 3: Contraseña superadmin */}
        {selectedTenant && nameMatches && (
          <div className="space-y-1.5">
            <Label>Paso 3 — Tu contraseña de superadmin</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="font-mono"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Borrado completado para <strong>{result.tenant_name}</strong>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {Object.entries(result.deleted).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-green-800">{PURGE_TABLE_LABELS[key] ?? key}</span>
                  <span className={`font-mono font-semibold ${count > 0 ? "text-green-700" : "text-green-400"}`}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón */}
        <Button
          onClick={() => void handlePurge()}
          disabled={!canSubmit || purging}
          className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {purging ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Borrando datos...</>
          ) : (
            <><Trash2 className="h-4 w-4 mr-2" />Purgar datos operativos</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [sendTestEmailResult, setSendTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState<SMTPForm>({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_from: "",
  });

  useEffect(() => {
    systemApi.getSMTP()
      .then((res) => {
        const d: SystemSMTP = res.data;
        setForm({
          smtp_host: d.smtp_host ?? "",
          smtp_port: d.smtp_port,
          smtp_user: d.smtp_user ?? "",
          smtp_password: "",
          smtp_from: d.smtp_from ?? "",
        });
        setVerifiedAt(d.smtp_verified_at ?? null);
      })
      .catch(() => setError("Error al cargar la configuración."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false); setTestResult(null);
    try {
      const payload: Record<string, unknown> = {
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user || null,
        smtp_from: form.smtp_from || null,
      };
      if (form.smtp_password) payload["smtp_password"] = form.smtp_password;

      const res = await systemApi.updateSMTP(payload as Parameters<typeof systemApi.updateSMTP>[0]);
      setForm((p) => ({ ...p, smtp_password: "" }));
      setVerifiedAt(res.data.smtp_verified_at ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Error al guardar la configuración.");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await systemApi.testSMTP();
      setTestResult({ ok: true, message: "Conexión verificada correctamente." });
      setVerifiedAt(res.data.verified_at);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown } };
      const data = err.response?.data;
      let msg: string | undefined;
      if (data && typeof data === "object") {
        const d = data as { detail?: { error?: { message?: string } } | string };
        if (typeof d.detail === "object" && d.detail !== null) {
          msg = d.detail.error?.message;
        } else if (typeof d.detail === "string") {
          msg = d.detail;
        }
      }
      if (!msg && err.response?.status === 504) {
        msg = "Tiempo de respuesta agotado. El servidor tardó demasiado en responder.";
      }
      setTestResult({ ok: false, message: msg ?? "Error al conectar. Revisa host, puerto y credenciales." });
    } finally { setTesting(false); }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddr) return;
    setSendingTestEmail(true); setSendTestEmailResult(null);
    try {
      await systemApi.sendTestEmail(testEmailAddr);
      setSendTestEmailResult({ ok: true, message: `Email enviado a ${testEmailAddr}.` });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setSendTestEmailResult({ ok: false, message: err.response?.data?.detail?.error?.message ?? "Error al enviar." });
    } finally { setSendingTestEmail(false); }
  };

  const f = (key: keyof SMTPForm) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: key === "smtp_port" ? Number(e.target.value) : e.target.value })),
  });

  const isConfigured = Boolean(form.smtp_host && form.smtp_user && form.smtp_from);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <Skeleton className="h-8 w-48 rounded-md" />
          </div>
          <div className="px-6 py-5 space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Cabecera de página */}
      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Configuración del sistema</h1>
        <p className="text-sm text-klyp-gray mt-0.5">
          SMTP global de fallback — se usa cuando una empresa no tiene SMTP propio configurado.
        </p>
      </div>

      {/* Estado general */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${verifiedAt ? "bg-green-500" : "bg-amber-400"}`} />
        <div className="flex-1 min-w-0">
          {verifiedAt ? (
            <p className="text-sm text-klyp-navy font-medium">
              SMTP verificado el{" "}
              {new Date(verifiedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          ) : (
            <p className="text-sm text-klyp-navy font-medium">SMTP no verificado</p>
          )}
          <p className="text-xs text-klyp-gray">
            {verifiedAt
              ? "El servidor de correo global está configurado y funcionando."
              : "Completa la configuración y pulsa «Probar Conexión» para verificar."}
          </p>
        </div>
        {verifiedAt && (
          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 shrink-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Activo
          </Badge>
        )}
      </div>

      {/* Tarjeta principal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ── Sección: Conexión ── */}
        <SectionHeader
          icon={<Server className="h-4 w-4 text-klyp-accent" />}
          title="Servidor de correo"
          description="Host y puerto del servidor SMTP"
        />
        <div className="px-6 py-5 space-y-4 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Host SMTP</Label>
              <Input {...f("smtp_host")} placeholder="smtp.gmail.com" />
              <FieldHint>Dirección del servidor de correo saliente.</FieldHint>
            </div>
            <div className="space-y-1.5">
              <Label>Puerto</Label>
              <Input type="number" {...f("smtp_port")} />
              <FieldHint>587 (TLS) · 465 (SSL) · 25</FieldHint>
            </div>
          </div>
        </div>

        {/* ── Sección: Autenticación ── */}
        <SectionHeader
          icon={<KeyRound className="h-4 w-4 text-klyp-accent" />}
          title="Autenticación"
          description="Credenciales de acceso al servidor"
        />
        <div className="px-6 py-5 space-y-4 border-b border-gray-100">
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <Input {...f("smtp_user")} placeholder="noreply@tudominio.com" />
            <FieldHint>Normalmente coincide con la dirección de correo.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <Input
              type="password"
              {...f("smtp_password")}
              placeholder="Déjalo vacío para mantener la contraseña guardada"
              className="font-mono"
            />
            <FieldHint>Solo es necesario rellenar este campo si quieres cambiar la contraseña.</FieldHint>
          </div>
        </div>

        {/* ── Sección: Remitente ── */}
        <SectionHeader
          icon={<Mail className="h-4 w-4 text-klyp-accent" />}
          title="Dirección remitente"
          description="Dirección que aparecerá en el campo «De» de los emails"
        />
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="space-y-1.5">
            <Label>Email remitente (From)</Label>
            <Input type="email" {...f("smtp_from")} placeholder="noreply@tudominio.com" />
            <FieldHint>Se mostrará como remitente en todos los emails enviados por el sistema.</FieldHint>
          </div>
        </div>

        {/* ── Sección: Verificar ── */}
        <SectionHeader
          icon={<Wifi className="h-4 w-4 text-klyp-accent" />}
          title="Verificar configuración"
          description="Prueba la conexión y envía un email de prueba"
        />
        <div className="px-6 py-5 space-y-4 border-b border-gray-100">
          {/* Resultado del test de conexión */}
          {testResult && (
            <div className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${
              testResult.ok
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Botón probar conexión */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={testing || !isConfigured}
              onClick={() => void handleTest()}
              className="shrink-0"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              {testing ? "Probando..." : "Probar Conexión"}
            </Button>
            <p className="text-xs text-klyp-gray">
              {isConfigured
                ? "Envía un email de auto-test al remitente configurado."
                : "Completa el host, usuario y remitente para probar."}
            </p>
          </div>

          {/* Separador */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-klyp-navy mb-3">Enviar email de prueba a una dirección específica</p>
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Input
                  type="email"
                  placeholder="destinatario@ejemplo.com"
                  value={testEmailAddr}
                  onChange={(e) => setTestEmailAddr(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={sendingTestEmail || !testEmailAddr || !isConfigured}
                onClick={() => void handleSendTestEmail()}
                className="shrink-0"
              >
                {sendingTestEmail
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <SendHorizonal className="h-4 w-4 mr-2" />}
                {sendingTestEmail ? "Enviando..." : "Enviar prueba"}
              </Button>
            </div>
            {sendTestEmailResult && (
              <div className={`mt-3 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${
                sendTestEmailResult.ok
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {sendTestEmailResult.ok
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{sendTestEmailResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Sección: Info prioridad ── */}
        <div className="px-6 py-4 bg-klyp-pale/40 border-b border-gray-100">
          <div className="flex items-start gap-2.5 text-xs text-klyp-navy">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-klyp-accent shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Lógica de prioridad SMTP</p>
              <ol className="list-decimal list-inside space-y-0.5 text-klyp-gray">
                <li><strong className="text-klyp-navy">SMTP de la empresa</strong> — si la empresa tiene SMTP propio activo</li>
                <li><strong className="text-klyp-navy">SMTP global (este)</strong> — si la empresa no tiene SMTP configurado</li>
              </ol>
            </div>
          </div>
        </div>

        {/* ── Footer: Guardar ── */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {saved && (
              <p className="text-sm text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Configuración guardada correctamente.
              </p>
            )}
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-klyp-navy hover:bg-klyp-navy-light text-white shrink-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </div>

      {/* ─── Borrado avanzado ─── */}
      <div>
        <h2 className="text-lg font-semibold text-klyp-navy mb-3">Borrado avanzado</h2>
        <PurgeSection />
      </div>
    </div>
  );
}
