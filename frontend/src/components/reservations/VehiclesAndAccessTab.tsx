"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Car, KeyRound, Plus, Trash2, RefreshCw, Loader2, Zap, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { reservationsApi } from "@/lib/api";
import type { ReservationVehicle, ReservationAccessCode } from "@/types";

interface Props {
  reservationId: string;
  numPersons: number;
}

// ─── Matrícula individual ─────────────────────────────────────────────────────

function PlateItem({
  vehicle,
  onDelete,
}: {
  vehicle: ReservationVehicle;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await reservationsApi.deleteVehicle(vehicle.reservation_id, vehicle.id);
      onDelete(vehicle.id);
    } catch {
      // silencioso
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 text-klyp-gray shrink-0" />
        <span className="font-mono font-semibold text-klyp-navy tracking-wider text-sm">
          {vehicle.plate}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
        onClick={() => void handleDelete()}
        disabled={deleting}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ─── Código de acceso individual ──────────────────────────────────────────────

function CodeItem({
  code,
  onRegenerate,
}: {
  code: ReservationAccessCode;
  onRegenerate: (updated: ReservationAccessCode) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await reservationsApi.regenerateAccessCode(code.reservation_id, code.id);
      onRegenerate(res.data);
    } catch {
      // silencioso
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-klyp-pale text-xs font-bold text-klyp-navy shrink-0">
          {code.person_index}
        </div>
        <span className="font-mono font-bold text-klyp-navy tracking-[0.2em] text-base">
          {code.code}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-klyp-gray hover:bg-klyp-pale"
          onClick={() => void handleCopy()}
          title="Copiar código"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-klyp-gray hover:bg-klyp-pale"
          onClick={() => void handleRegenerate()}
          disabled={regenerating}
          title="Regenerar código"
        >
          {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function VehiclesAndAccessTab({ reservationId, numPersons }: Props) {
  const [vehicles, setVehicles] = useState<ReservationVehicle[]>([]);
  const [codes, setCodes] = useState<ReservationAccessCode[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPlate, setNewPlate] = useState("");
  const [addingPlate, setAddingPlate] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);

  const [generatingAll, setGeneratingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        reservationsApi.listVehicles(reservationId),
        reservationsApi.listAccessCodes(reservationId),
      ]);
      setVehicles(vRes.data);
      setCodes(cRes.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => { void load(); }, [load]);

  const handleAddPlate = async () => {
    const normalized = newPlate.trim().toUpperCase();
    if (!normalized) { setPlateError("Introduce una matrícula."); return; }
    setAddingPlate(true);
    setPlateError(null);
    try {
      const res = await reservationsApi.addVehicle(reservationId, normalized);
      setVehicles((prev) => [...prev, res.data]);
      setNewPlate("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setPlateError(err.response?.data?.detail?.error?.message ?? "Error al añadir la matrícula.");
    } finally {
      setAddingPlate(false);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const res = await reservationsApi.generateAccessCodes(reservationId);
      setCodes(res.data);
    } catch {
      // silencioso
    } finally {
      setGeneratingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Matrículas ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Car className="h-4 w-4 text-klyp-navy" />
          <h3 className="text-sm font-semibold text-klyp-navy uppercase tracking-wide">
            Matrículas de vehículos
          </h3>
          <span className="ml-auto text-xs text-klyp-gray">{vehicles.length} registrada{vehicles.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-2 mb-3">
          {vehicles.length === 0 && (
            <p className="text-sm text-klyp-gray text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Sin matrículas registradas
            </p>
          )}
          {vehicles.map((v) => (
            <PlateItem
              key={v.id}
              vehicle={v}
              onDelete={(id) => setVehicles((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newPlate}
            onChange={(e) => { setNewPlate(e.target.value.toUpperCase()); setPlateError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddPlate(); }}
            placeholder="1234ABC"
            className="font-mono uppercase h-[44px]"
            maxLength={20}
          />
          <Button
            onClick={() => void handleAddPlate()}
            disabled={addingPlate || !newPlate.trim()}
            className="bg-klyp-accent hover:bg-klyp-accent/90 text-white h-[44px] shrink-0"
          >
            {addingPlate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Añadir</span>
          </Button>
        </div>
        {plateError && <p className="text-xs text-red-600 mt-1">{plateError}</p>}
      </section>

      <div className="border-t border-gray-100" />

      {/* ── Códigos de torno ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-klyp-navy" />
          <h3 className="text-sm font-semibold text-klyp-navy uppercase tracking-wide">
            Códigos de torno
          </h3>
          <span className="text-xs text-klyp-gray">({numPersons} persona{numPersons !== 1 ? "s" : ""})</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 text-xs"
            onClick={() => void handleGenerateAll()}
            disabled={generatingAll}
            title={codes.length > 0 ? "Regenerar todos los códigos" : "Generar códigos"}
          >
            {generatingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : codes.length > 0
                ? <RefreshCw className="h-3.5 w-3.5" />
                : <Zap className="h-3.5 w-3.5" />}
            {codes.length > 0 ? "Regenerar todos" : "Generar códigos"}
          </Button>
        </div>

        <div className="space-y-2">
          {codes.length === 0 && (
            <p className="text-sm text-klyp-gray text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Sin códigos generados — pulsa «Generar códigos»
            </p>
          )}
          {codes.map((c) => (
            <CodeItem
              key={c.id}
              code={c}
              onRegenerate={(updated) =>
                setCodes((prev) => prev.map((x) => x.id === updated.id ? updated : x))
              }
            />
          ))}
        </div>

        {codes.length > 0 && (
          <p className="text-xs text-klyp-gray mt-2 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Regenerar un código invalida el anterior.
          </p>
        )}
      </section>

    </div>
  );
}
