"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, XCircle, CheckCircle2, Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

const SLUG = process.env["NEXT_PUBLIC_TENANT_SLUG"] ?? "camping-el-pinar";

interface ConfirmInfo {
  reservation_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  num_persons: number;
  status: string;
  already_confirmed: boolean;
}

export default function ConfirmarReservaPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ConfirmInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    axios.get<ConfirmInfo>(`${apiBase}/api/v1/public/${SLUG}/confirm/${token}`)
      .then((res) => {
        setInfo(res.data);
        if (res.data.already_confirmed) setConfirmed(true);
      })
      .catch(() => setError("No se encontró la reserva o el enlace ha expirado."))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await axios.post(`${apiBase}/api/v1/public/${SLUG}/confirm/${token}`);
      setConfirmed(true);
    } catch { setError("Error al confirmar la asistencia."); }
    finally { setConfirming(false); }
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

  if (!info) return null;

  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (confirmed) return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
        <h1 className="text-2xl font-bold text-klyp-navy">¡Asistencia confirmada!</h1>
        <p className="text-klyp-gray">Gracias, {info.guest_name}. Hemos registrado tu confirmación de asistencia.</p>
        <div className="bg-klyp-pale rounded-lg p-4 text-sm space-y-1">
          <p><span className="text-klyp-gray">Entrada: </span><strong>{formatDate(info.check_in)}</strong></p>
          <p><span className="text-klyp-gray">Salida: </span><strong>{formatDate(info.check_out)}</strong></p>
        </div>
        <p className="text-sm text-klyp-gray">¡Te esperamos!</p>
        <Button asChild className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4 py-8">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-klyp-accent mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-klyp-navy">Recordatorio de reserva</h1>
          <p className="text-klyp-gray text-sm mt-1">¡Tu estancia es en 7 días! Por favor confirma tu asistencia.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-klyp-pale p-6 space-y-3">
          <h2 className="font-semibold text-klyp-navy">Hola, {info.guest_name}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-klyp-gray">Entrada</span>
            <span className="font-medium">{formatDate(info.check_in)}</span>
            <span className="text-klyp-gray">Salida</span>
            <span>{formatDate(info.check_out)}</span>
            <span className="text-klyp-gray">Personas</span>
            <span>{info.num_persons}</span>
          </div>
        </div>

        <Button
          onClick={() => void handleConfirm()}
          disabled={confirming}
          className="w-full min-h-[44px] bg-klyp-accent hover:bg-klyp-accent/90 text-white"
        >
          {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Confirmar mi asistencia"}
        </Button>

        <div className="text-center text-xs text-klyp-gray space-y-1">
          <p>Si no puedes asistir, cancela tu reserva con antelación.</p>
          <Link href="/" className="hover:text-klyp-navy">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
