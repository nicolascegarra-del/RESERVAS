"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { XCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// El componente interno usa useSearchParams, que requiere Suspense
function PagoKoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reservaId = searchParams.get("reserva");

  const handleVolverReserva = () => {
    if (reservaId) {
      router.push(`/reservas/${reservaId}`);
    } else {
      router.push("/reservas");
    }
  };

  const handleReintentar = () => {
    // Volver a la reserva para que el usuario pueda pulsar "Reintentar pago con Redsys"
    handleVolverReserva();
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-red-200 shadow-md">
        <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-9 w-9 text-red-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-klyp-navy">
              El pago no se ha podido completar
            </h1>
            <p className="text-sm text-klyp-gray">
              La operación fue cancelada o rechazada por la pasarela de pago.
              Puedes intentarlo de nuevo o volver a la reserva.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={handleReintentar}
              className="w-full bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Intentar de nuevo
            </Button>
            <Button
              variant="outline"
              onClick={handleVolverReserva}
              className="w-full border-klyp-accent text-klyp-accent hover:bg-klyp-accent/10 min-h-[44px]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la reserva
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PagoKoPage() {
  return (
    <Suspense>
      <PagoKoContent />
    </Suspense>
  );
}
