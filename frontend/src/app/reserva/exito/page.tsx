"use client";

import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReservaExitoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-klyp-pale px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
        <h1 className="text-2xl font-bold text-klyp-navy">¡Reserva confirmada!</h1>
        <p className="text-klyp-gray">
          Tu pago se ha procesado correctamente. Recibirás un email de confirmación
          con todos los detalles de tu reserva y un enlace para cancelarla si lo necesitas.
        </p>
        <p className="text-sm text-klyp-gray">
          Revisa también tu carpeta de spam si no recibes el email en unos minutos.
        </p>
        <Button asChild className="mt-2 bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </main>
  );
}
