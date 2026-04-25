"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { PublicAccommodationType, PublicAvailabilityRequest } from "@/lib/publicApi";

const today = new Date().toISOString().split("T")[0]!;

const searchSchema = z
  .object({
    check_in: z.string().min(1, "Selecciona fecha de entrada"),
    check_out: z.string().min(1, "Selecciona fecha de salida"),
    accommodation_type_id: z.string().optional(),
    num_persons: z
      .number({ invalid_type_error: "Debe ser un número" })
      .int()
      .min(1, "Mínimo 1 persona")
      .max(50, "Máximo 50 personas"),
  })
  .refine((d) => d.check_out > d.check_in, {
    message: "La salida debe ser posterior a la entrada",
    path: ["check_out"],
  });

type SearchFormValues = z.infer<typeof searchSchema>;

interface BookingSearchFormProps {
  types: PublicAccommodationType[];
  onSearch: (data: PublicAvailabilityRequest) => void;
  isLoading: boolean;
  accentColor?: string;
}

export function BookingSearchForm({
  types,
  onSearch,
  isLoading,
  accentColor = "#2E6DB4",
}: BookingSearchFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      check_in: "",
      check_out: "",
      accommodation_type_id: "",
      num_persons: 2,
    },
  });

  const checkIn = watch("check_in");

  const onSubmit = (values: SearchFormValues) => {
    onSearch({
      check_in: values.check_in,
      check_out: values.check_out,
      accommodation_type_id: values.accommodation_type_id || null,
      num_persons: values.num_persons,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full rounded-xl bg-white shadow-lg border border-klyp-pale p-4 md:p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Fecha de entrada */}
        <div className="space-y-1.5">
          <Label htmlFor="check_in" className="flex items-center gap-1.5 text-klyp-text-dark">
            <CalendarDays className="h-4 w-4 text-klyp-accent" />
            Entrada
          </Label>
          <Input
            id="check_in"
            type="date"
            min={today}
            className="min-h-[44px]"
            aria-invalid={!!errors.check_in}
            {...register("check_in")}
          />
          {errors.check_in && (
            <p className="text-xs text-red-600" role="alert">
              {errors.check_in.message}
            </p>
          )}
        </div>

        {/* Fecha de salida */}
        <div className="space-y-1.5">
          <Label htmlFor="check_out" className="flex items-center gap-1.5 text-klyp-text-dark">
            <CalendarDays className="h-4 w-4 text-klyp-accent" />
            Salida
          </Label>
          <Input
            id="check_out"
            type="date"
            min={checkIn || today}
            className="min-h-[44px]"
            aria-invalid={!!errors.check_out}
            {...register("check_out")}
          />
          {errors.check_out && (
            <p className="text-xs text-red-600" role="alert">
              {errors.check_out.message}
            </p>
          )}
        </div>

        {/* Tipo de alojamiento */}
        <div className="space-y-1.5">
          <Label htmlFor="accommodation_type_id" className="text-klyp-text-dark">
            Tipo de alojamiento
          </Label>
          <select
            id="accommodation_type_id"
            className="flex h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...register("accommodation_type_id")}
          >
            <option value="">Todos los alojamientos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Número de personas */}
        <div className="space-y-1.5">
          <Label htmlFor="num_persons" className="flex items-center gap-1.5 text-klyp-text-dark">
            <Users className="h-4 w-4 text-klyp-accent" />
            Personas
          </Label>
          <Input
            id="num_persons"
            type="number"
            min={1}
            max={50}
            className="min-h-[44px]"
            aria-invalid={!!errors.num_persons}
            {...register("num_persons", { valueAsNumber: true })}
          />
          {errors.num_persons && (
            <p className="text-xs text-red-600" role="alert">
              {errors.num_persons.message}
            </p>
          )}
        </div>
      </div>

      {/* Botón de búsqueda */}
      <div className="mt-4 flex justify-center">
        <Button
          type="submit"
          disabled={isLoading}
          className="min-h-[44px] w-full sm:w-auto px-8 text-white"
          style={{ backgroundColor: accentColor }}
        >
          <Search className="mr-2 h-4 w-4" />
          {isLoading ? "Buscando..." : "Buscar disponibilidad"}
        </Button>
      </div>
    </form>
  );
}
