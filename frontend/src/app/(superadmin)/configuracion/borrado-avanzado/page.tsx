"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantsApi, advancedApi, type TenantSummary, type PurgeOperationalDataResult } from "@/lib/superadminApi";
import { extractApiErrorMessage } from "@/lib/utils";

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

export default function BorradoAvanzadoPage() {
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
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Borrado avanzado</h1>
        <p className="text-sm text-klyp-gray mt-0.5">
          Elimina todos los datos operativos de una empresa manteniendo su configuración.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 space-y-5">

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
    </div>
  );
}
