"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cancellationsApi } from "@/lib/api";
import type { CancellationPolicy } from "@/types";

interface CancellationPolicyCardProps {
  policy: CancellationPolicy;
  onUpdated: (updated: CancellationPolicy) => void;
  onDeleted: (id: string) => void;
}

export function CancellationPolicyCard({
  policy,
  onUpdated,
  onDeleted,
}: CancellationPolicyCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: policy.name,
    full_refund_days: policy.full_refund_days,
    partial_refund_days: policy.partial_refund_days,
    partial_refund_percentage: policy.partial_refund_percentage,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await cancellationsApi.updatePolicy(policy.id, form);
      onUpdated(res.data);
      setEditing(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: { error?: { message?: string } } } };
      };
      const msg =
        axiosErr.response?.data?.detail?.error?.message ??
        "Error al guardar la política.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await cancellationsApi.deletePolicy(policy.id);
      onDeleted(policy.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className={`border-klyp-pale ${!policy.is_active ? "opacity-60" : ""}`}>
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-base text-klyp-navy">
              {policy.name}
            </CardTitle>
            <p className="mt-0.5 text-xs text-klyp-gray">
              {policy.accommodation_type_id
                ? "Política por tipo de alojamiento"
                : "Política global del tenant"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {policy.is_active ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Activa
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                <XCircle className="h-3.5 w-3.5" />
                Inactiva
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tramos */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded bg-green-50 px-3 py-2">
              <span className="text-green-700 font-medium">
                ≥ {policy.full_refund_days} días antes
              </span>
              <span className="text-green-800 font-bold">100% reembolso</span>
            </div>
            <div className="flex items-center justify-between rounded bg-yellow-50 px-3 py-2">
              <span className="text-yellow-700 font-medium">
                {policy.partial_refund_days}–{policy.full_refund_days - 1} días antes
              </span>
              <span className="text-yellow-800 font-bold">
                {policy.partial_refund_percentage}% reembolso
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-red-50 px-3 py-2">
              <span className="text-red-700 font-medium">
                &lt; {policy.partial_refund_days} días antes
              </span>
              <span className="text-red-800 font-bold">Sin reembolso</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="min-h-[36px] text-xs"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="min-h-[36px] text-xs border-red-200 text-red-600 hover:bg-red-50"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de edición */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-klyp-navy">Editar política</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Días para reembolso completo (Tramo 1 — ≥ X días antes → 100%)
              </Label>
              <Input
                type="number"
                min={1}
                value={form.full_refund_days}
                onChange={(e) =>
                  setForm({ ...form, full_refund_days: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Días para reembolso parcial (Tramo 2 — X a {form.full_refund_days - 1}{" "}
                días antes)
              </Label>
              <Input
                type="number"
                min={0}
                max={form.full_refund_days - 1}
                value={form.partial_refund_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    partial_refund_days: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Porcentaje de reembolso en Tramo 2 (%)</Label>
              <Input
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
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-klyp-accent hover:bg-klyp-accent/90 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
