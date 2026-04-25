"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, XCircle, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

const SLUG = process.env["NEXT_PUBLIC_TENANT_SLUG"] ?? "camping-el-pinar";

interface CancelPreview {
  reservation_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  num_persons: number;
  total_price: string;
  currency: string;
  status: string;
  policy_name: string | null;
  full_refund_days: number | null;
  partial_refund_days: number | null;
  partial_refund_percentage: number | null;
  days_until_checkin: number;
  estimated_refund: string;
  refund_description: string;
}

export default function CancelarReservaPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<CancelPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    axios.get<CancelPreview>(`${apiBase}/api/v1/public/${SLUG}/cancel/${token}`)
      .then((res) => setPreview(res.data))
      .catch(() => setError("No se encontró la reserva o el enlace ha expirado."))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.post(`${apiBase}/api/v1/public/${SLUG}/cancel/${token}`);
      setCancelled(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al cancelar la reserva.");
    } finally { setCancelling(false); }
  };

  if (isLoading) return (
    <main className="flex min-h-screen items-center justify-center bg-klyp-pale">
      <Loader2 className="h-8 w-8 animate-spin text-klyp-accent" />
    </main>
  );

  if (error) return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-xl font-bold text-klyp-navy">Error</h1>
        <p className="text-klyp-gray">{error}</p>
        <Button asChild variant="outline"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Inicio</Link></Button>
      </div>
    </main>
  );

  if (cancelled) return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <h1 className="text-xl font-bold text-klyp-navy">Reserva cancelada</h1>
        <p className="text-klyp-gray">Tu reserva ha sido cancelada correctamente.</p>
        {preview && parseFloat(preview.estimated_refund) > 0 && (
          <p className="text-sm text-klyp-gray">
            Recibirás un reembolso de <strong>{parseFloat(preview.estimated_refund).toFixed(2)} {preview.currency.toUpperCase()}</strong>.
          </p>
        )}
        <Button asChild className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );

  if (!preview) return null;

  const isCancellable = preview.status === "confirmed" || preview.status === "pending_payment";
  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalNum = parseFloat(preview.total_price);
  const refundNum = parseFloat(preview.estimated_refund);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4 py-8">
      <div className="max-w-lg w-full space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-klyp-navy">Cancelar reserva</h1>
          <p className="text-klyp-gray text-sm mt-1">Revisa los detalles y la política de cancelación.</p>
        </div>

        {/* Datos de la reserva */}
        <div className="bg-white rounded-xl shadow-sm border border-klyp-pale p-6 space-y-3">
          <h2 className="font-semibold text-klyp-navy">Tu reserva</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-klyp-gray">Titular</span>
            <span className="font-medium">{preview.guest_name}</span>
            <span className="text-klyp-gray">Entrada</span>
            <span>{formatDate(preview.check_in)}</span>
            <span className="text-klyp-gray">Salida</span>
            <span>{formatDate(preview.check_out)}</span>
            <span className="text-klyp-gray">Personas</span>
            <span>{preview.num_persons}</span>
            <span className="text-klyp-gray">Total pagado</span>
            <span className="font-semibold">{totalNum.toFixed(2)} {preview.currency.toUpperCase()}</span>
          </div>
        </div>

        {/* Política de cancelación */}
        <div className="bg-white rounded-xl shadow-sm border border-klyp-pale p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-klyp-accent" />
            <h2 className="font-semibold text-klyp-navy">Política de cancelación</h2>
          </div>
          {preview.policy_name ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{preview.policy_name}</p>
              <ul className="space-y-1 text-klyp-gray">
                <li>≥ {preview.full_refund_days} días antes → reembolso del 100%</li>
                {preview.partial_refund_days !== null && (
                  <li>≥ {preview.partial_refund_days} días antes → reembolso del {preview.partial_refund_percentage}%</li>
                )}
                <li className="text-red-600">{"<"} {preview.partial_refund_days} días antes → sin reembolso</li>
              </ul>
            </div>
          ) : (
            <p className="text-sm text-klyp-gray">No hay política de cancelación configurada para este alojamiento.</p>
          )}
        </div>

        {/* Estimación de reembolso */}
        <div className={`rounded-xl border p-5 ${refundNum > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <p className="text-sm font-medium mb-1">{refundNum > 0 ? "💚" : "⚠️"} Reembolso estimado</p>
          <p className="text-2xl font-bold text-klyp-navy">{refundNum.toFixed(2)} {preview.currency.toUpperCase()}</p>
          <p className="text-xs text-klyp-gray mt-1">{preview.refund_description}</p>
          <p className="text-xs text-klyp-gray">{preview.days_until_checkin} días hasta el check-in</p>
        </div>

        {isCancellable ? (
          <Button
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white"
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cancelación"}
          </Button>
        ) : (
          <div className="rounded-lg bg-gray-100 p-4 text-sm text-center text-klyp-gray">
            Esta reserva no se puede cancelar (estado: {preview.status}).
          </div>
        )}

        <div className="text-center">
          <Link href="/" className="text-xs text-klyp-gray hover:text-klyp-navy">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
