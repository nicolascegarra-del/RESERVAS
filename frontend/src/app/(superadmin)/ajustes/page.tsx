"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { systemApi, type SystemSMTP } from "@/lib/superadminApi";

// ─── Toggle switch ────────────────────────────────────────────────────────────

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

// ─── Página ───────────────────────────────────────────────────────────────────

type SMTPForm = {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
};

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<SMTPForm>({
    smtp_enabled: false,
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
          smtp_enabled: d.smtp_enabled,
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
        smtp_enabled: form.smtp_enabled,
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
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setTestResult({ ok: false, message: err.response?.data?.detail?.error?.message ?? "Error al conectar." });
    } finally { setTesting(false); }
  };

  const f = (key: keyof SMTPForm) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: key === "smtp_port" ? Number(e.target.value) : e.target.value })),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Configuración del sistema</h1>
        <p className="text-sm text-klyp-gray mt-0.5">
          SMTP global de fallback — se usa cuando una empresa no tiene su propio SMTP configurado.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Cabecera */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-klyp-pale flex items-center justify-center">
              <Mail className="h-5 w-5 text-klyp-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-klyp-navy">SMTP global</p>
              <p className="text-xs text-klyp-gray">Servidor de correo de fallback para todo el sistema</p>
            </div>
            <ToggleSwitch
              enabled={form.smtp_enabled}
              onChange={() => setForm((p) => ({ ...p, smtp_enabled: !p.smtp_enabled }))}
            />
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Servidor SMTP (Host)</Label>
                <Input {...f("smtp_host")} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Puerto</Label>
                <Input type="number" {...f("smtp_port")} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Usuario</Label>
                <Input {...f("smtp_user")} placeholder="noreply@tudominio.com" />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  {...f("smtp_password")}
                  placeholder="••••••••••••"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Email remitente (From)</Label>
                <Input type="email" {...f("smtp_from")} placeholder="noreply@tudominio.com" />
              </div>
            </div>

            {/* Estado de verificación + botón */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <div className="flex-1">
                {testResult ? (
                  <p className={`text-sm flex items-center gap-1.5 ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${testResult.ok ? "bg-green-500" : "bg-red-500"}`} />
                    {testResult.message}
                  </p>
                ) : verifiedAt ? (
                  <p className="text-sm text-green-600 flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Configuración probada y funcionando — {new Date(verifiedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                ) : (
                  <p className="text-sm text-klyp-gray">Guarda los datos y pulsa &quot;Probar Conexión&quot;.</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={testing || !form.smtp_host}
                onClick={() => void handleTest()}
                className="shrink-0"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {testing ? "Probando..." : "Probar Conexión"}
              </Button>
            </div>

            {/* Info sobre la prioridad */}
            <div className="rounded-lg bg-klyp-pale border border-klyp-accent/20 px-4 py-3 text-xs text-klyp-navy space-y-1">
              <p className="font-semibold">Lógica de prioridad SMTP:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-klyp-gray">
                <li><strong className="text-klyp-navy">SMTP de la empresa</strong> — si la empresa tiene SMTP propio activo</li>
                <li><strong className="text-klyp-navy">SMTP global (este)</strong> — si la empresa no tiene SMTP configurado</li>
              </ol>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && (
              <p className="text-sm text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Configuración guardada correctamente.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-klyp-accent hover:bg-klyp-accent/90 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
