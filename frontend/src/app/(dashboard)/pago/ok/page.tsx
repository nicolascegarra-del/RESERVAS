"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// El componente interno usa useSearchParams, que requiere Suspense
function PagoOkContent() {
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-green-200 shadow-md">
        <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-klyp-navy">
              Pago procesado correctamente
            </h1>
            <p className="text-sm text-klyp-gray">
              Tu pago ha sido procesado satisfactoriamente.
              En breve recibirás una confirmación.
            </p>
          </div>

          <Button
            onClick={handleVolverReserva}
            className="w-full bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la reserva
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PagoOkPage() {
  return (
    <Suspense>
      <PagoOkContent />
    </Suspense>
  );
}
