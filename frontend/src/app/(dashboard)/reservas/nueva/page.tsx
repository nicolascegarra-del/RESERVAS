"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityGrid } from "@/components/reservations/AvailabilityGrid";
import { PriceBreakdown } from "@/components/reservations/PriceBreakdown";
import { GuestForm, type GuestFormValues } from "@/components/reservations/GuestForm";
import { reservationsApi, accommodationsApi } from "@/lib/api";
import type {
  AccommodationType,
  Extra,
  UnitAvailability,
  AvailabilityResult,
  PriceCalculationResult,
} from "@/types";

// ─── Tipos locales del wizard ─────────────────────────────────────────────────

interface Step1Data {
  accommodation_type_id: string;
  check_in: string;
  check_out: string;
  num_persons: number;
  selected_extra_ids: string[];
}

interface WizardState {
  step: 1 | 2 | 3;
  step1: Step1Data;
  availabilityResult: AvailabilityResult | null;
  selectedUnit: UnitAvailability | null;
  pricePreview: PriceCalculationResult | null;
}

const INITIAL_STEP1: Step1Data = {
  accommodation_type_id: "",
  check_in: "",
  check_out: "",
  num_persons: 1,
  selected_extra_ids: [],
};

// ─── Componente stepper visual ────────────────────────────────────────────────

interface StepperProps {
  currentStep: 1 | 2 | 3;
}

function Stepper({ currentStep }: StepperProps) {
  const steps = [
    { number: 1, label: "Disponibilidad" },
    { number: 2, label: "Unidad y precio" },
    { number: 3, label: "Datos del huésped" },
  ];

  return (
    <nav aria-label="Pasos del wizard" className="flex items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                currentStep > step.number
                  ? "bg-klyp-accent text-white"
                  : currentStep === step.number
                  ? "bg-klyp-navy text-white"
                  : "border-2 border-klyp-pale bg-white text-klyp-gray",
              ].join(" ")}
              aria-current={currentStep === step.number ? "step" : undefined}
            >
              {currentStep > step.number ? (
                <Check className="h-4 w-4" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={[
                "hidden text-xs sm:block",
                currentStep === step.number
                  ? "font-semibold text-klyp-navy"
                  : "text-klyp-gray",
              ].join(" ")}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={[
                "mx-2 h-0.5 w-12 sm:w-20 transition-colors",
                currentStep > step.number ? "bg-klyp-accent" : "bg-klyp-pale",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

// ─── Paso 1: Tipo + fechas + personas + extras ────────────────────────────────

interface Step1Props {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
  onNext: () => void;
  isSearching: boolean;
  searchError: string | null;
  types: AccommodationType[];
  extras: Extra[];
}

function Step1Form({
  data,
  onChange,
  onNext,
  isSearching,
  searchError,
  types,
  extras,
}: Step1Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const toggleExtra = (extraId: string) => {
    const current = data.selected_extra_ids;
    if (current.includes(extraId)) {
      onChange({ selected_extra_ids: current.filter((id) => id !== extraId) });
    } else {
      onChange({ selected_extra_ids: [...current, extraId] });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de alojamiento */}
      <div className="space-y-1.5">
        <Label htmlFor="accommodation_type_id">
          Tipo de alojamiento <span className="text-red-500">*</span>
        </Label>
        <select
          id="accommodation_type_id"
          required
          value={data.accommodation_type_id}
          onChange={(e) => onChange({ accommodation_type_id: e.target.value })}
          className="flex h-10 w-full rounded-md border border-klyp-pale bg-white px-3 py-2 text-sm text-klyp-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klyp-accent"
        >
          <option value="">Selecciona un tipo...</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="check_in">
            Entrada <span className="text-red-500">*</span>
          </Label>
          <Input
            id="check_in"
            type="date"
            required
            value={data.check_in}
            onChange={(e) => onChange({ check_in: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="check_out">
            Salida <span className="text-red-500">*</span>
          </Label>
          <Input
            id="check_out"
            type="date"
            required
            min={data.check_in || undefined}
            value={data.check_out}
            onChange={(e) => onChange({ check_out: e.target.value })}
          />
        </div>
      </div>

      {/* Personas */}
      <div className="space-y-1.5">
        <Label htmlFor="num_persons">Número de personas</Label>
        <Input
          id="num_persons"
          type="number"
          min={1}
          max={99}
          value={data.num_persons}
          onChange={(e) =>
            onChange({ num_persons: Math.max(1, parseInt(e.target.value, 10) || 1) })
          }
          className="w-32"
        />
      </div>

      {/* Extras */}
      {extras.length > 0 && (
        <div className="space-y-2">
          <Label>Extras opcionales</Label>
          <div className="flex flex-wrap gap-2">
            {extras.map((extra) => {
              const isSelected = data.selected_extra_ids.includes(extra.id);
              return (
                <button
                  key={extra.id}
                  type="button"
                  onClick={() => toggleExtra(extra.id)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px]",
                    isSelected
                      ? "border-klyp-accent bg-klyp-accent/10 text-klyp-accent"
                      : "border-klyp-pale bg-white text-klyp-gray hover:border-klyp-accent/50",
                  ].join(" ")}
                >
                  {extra.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {searchError && (
        <p className="text-sm text-red-600 rounded-md bg-red-50 px-3 py-2">
          {searchError}
        </p>
      )}

      <Button
        type="submit"
        disabled={
          isSearching ||
          !data.accommodation_type_id ||
          !data.check_in ||
          !data.check_out
        }
        className="w-full bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
      >
        {isSearching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando disponibilidad...
          </>
        ) : (
          <>
            Buscar disponibilidad
            <ChevronRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Paso 2: Selección de unidad ──────────────────────────────────────────────

interface Step2Props {
  availabilityResult: AvailabilityResult;
  selectedUnit: UnitAvailability | null;
  onSelectUnit: (unit: UnitAvailability) => void;
  onBack: () => void;
  onNext: () => void;
  numPersons: number;
}

function Step2Selection({
  availabilityResult,
  selectedUnit,
  onSelectUnit,
  onBack,
  onNext,
  numPersons,
}: Step2Props) {
  return (
    <div className="space-y-6">
      <AvailabilityGrid
        units={availabilityResult.available_units}
        selectedUnitId={selectedUnit?.unit_id ?? null}
        onSelectUnit={onSelectUnit}
        numPersons={numPersons}
      />

      {selectedUnit && availabilityResult.price_preview && (
        <Card className="border-klyp-pale">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-klyp-navy">
              Desglose de precio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceBreakdown result={availabilityResult.price_preview} />
          </CardContent>
        </Card>
      )}

      {selectedUnit && !availabilityResult.price_preview && (
        <p className="text-sm text-klyp-gray rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2">
          Este tipo de alojamiento no tiene modelo de precios configurado.
          El precio total quedara en 0.
        </p>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="min-h-[44px] border-klyp-pale text-klyp-gray"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>
        <Button
          disabled={!selectedUnit}
          onClick={onNext}
          className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
        >
          Continuar
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Paso 3: Datos del huésped + resumen ──────────────────────────────────────

interface Step3Props {
  step1: Step1Data;
  selectedUnit: UnitAvailability;
  pricePreview: PriceCalculationResult | null;
  onBack: () => void;
  onSubmit: (values: GuestFormValues) => void;
  isSubmitting: boolean;
  submitError: string | null;
}

function Step3GuestAndSummary({
  step1,
  selectedUnit,
  pricePreview,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: Step3Props) {
  const formatDate = (iso: string) => {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Formulario — ocupa 3/5 en desktop */}
      <div className="lg:col-span-3 space-y-4">
        <GuestForm
          formId="guest-form-step3"
          onSubmit={onSubmit}
          isLoading={isSubmitting}
        />

        {submitError && (
          <p className="text-sm text-red-600 rounded-md bg-red-50 px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="min-h-[44px] border-klyp-pale text-klyp-gray"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>
          <Button
            type="submit"
            form="guest-form-step3"
            disabled={isSubmitting}
            className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando reserva...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar reserva
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Resumen lateral — ocupa 2/5 en desktop */}
      <div className="lg:col-span-2">
        <Card className="border-klyp-pale bg-klyp-pale/30 sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-klyp-navy">
              Resumen de la reserva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-klyp-gray">Unidad</dt>
                <dd className="font-medium text-klyp-text-dark">
                  {selectedUnit.unit_name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-klyp-gray">Entrada</dt>
                <dd className="font-medium text-klyp-text-dark">
                  {formatDate(step1.check_in)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-klyp-gray">Salida</dt>
                <dd className="font-medium text-klyp-text-dark">
                  {formatDate(step1.check_out)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-klyp-gray">Personas</dt>
                <dd className="font-medium text-klyp-text-dark">
                  {step1.num_persons}
                </dd>
              </div>
            </dl>

            {pricePreview && (
              <div className="border-t border-klyp-pale pt-3">
                <PriceBreakdown result={pricePreview} showBreakdown={false} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Página principal del wizard ──────────────────────────────────────────────

export default function NuevaReservaPage() {
  const router = useRouter();

  const [types, setTypes] = useState<AccommodationType[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);

  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    step1: INITIAL_STEP1,
    availabilityResult: null,
    selectedUnit: null,
    pricePreview: null,
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cargar tipos y extras al montar
  const loadCatalog = useCallback(async () => {
    try {
      const [typesRes, extrasRes] = await Promise.all([
        accommodationsApi.listTypes(),
        accommodationsApi.listExtras(),
      ]);
      setTypes(typesRes.data.filter((t) => t.is_active));
      setExtras(extrasRes.data.filter((e) => e.is_active));
    } catch {
      // No bloqueante — el usuario verá listas vacías
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Paso 1 → buscar disponibilidad
  const handleSearchAvailability = async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await reservationsApi.checkAvailability({
        accommodation_type_id: wizard.step1.accommodation_type_id,
        check_in: wizard.step1.check_in,
        check_out: wizard.step1.check_out,
        num_persons: wizard.step1.num_persons,
        selected_extra_ids: wizard.step1.selected_extra_ids,
      });
      setWizard((prev) => ({
        ...prev,
        step: 2,
        availabilityResult: response.data,
        selectedUnit: null,
        pricePreview: response.data.price_preview,
      }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setSearchError(
        axiosErr.response?.data?.detail ??
          "No se pudo consultar la disponibilidad. Inténtalo de nuevo.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Paso 2 → seleccionar unidad
  const handleSelectUnit = (unit: UnitAvailability) => {
    setWizard((prev) => ({ ...prev, selectedUnit: unit }));
  };

  // Paso 2 → avanzar al 3
  const handleGoToStep3 = () => {
    setWizard((prev) => ({ ...prev, step: 3 }));
  };

  // Paso 3 → crear reserva
  const handleCreateReservation = async (guestValues: GuestFormValues) => {
    if (!wizard.selectedUnit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await reservationsApi.create({
        accommodation_type_id: wizard.step1.accommodation_type_id,
        unit_id: wizard.selectedUnit.unit_id,
        guest_name: guestValues.guest_name,
        guest_email: guestValues.guest_email,
        guest_phone: guestValues.guest_phone || null,
        guest_id_type: guestValues.guest_id_type || null,
        guest_id_number: guestValues.guest_id_number || null,
        guest_address: guestValues.guest_address || null,
        guest_postal_code: guestValues.guest_postal_code || null,
        guest_city: guestValues.guest_city || null,
        guest_region: guestValues.guest_region || null,
        guest_country: guestValues.guest_country || null,
        check_in: wizard.step1.check_in,
        check_out: wizard.step1.check_out,
        num_persons: wizard.step1.num_persons,
        selected_extra_ids: wizard.step1.selected_extra_ids,
        internal_notes: guestValues.internal_notes || null,
      });
      router.push("/reservas");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: { error?: { message?: string } } | string } };
      };
      const detail = axiosErr.response?.data?.detail;
      let msg = "No se pudo crear la reserva. Inténtalo de nuevo.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail?.error?.message) {
        msg = detail.error.message;
      }
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles: Record<1 | 2 | 3, string> = {
    1: "Buscar disponibilidad",
    2: "Selecciona una unidad",
    3: "Datos del huésped",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header con botón volver */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => {
            if (wizard.step === 1) {
              router.push("/reservas");
            } else {
              setWizard((prev) => ({
                ...prev,
                step: (prev.step - 1) as 1 | 2 | 3,
              }));
            }
          }}
          className="text-klyp-gray hover:text-klyp-text-dark min-h-[44px]"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {wizard.step === 1 ? "Volver a Reservas" : "Paso anterior"}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-klyp-navy">Nueva reserva</h1>
        <p className="mt-1 text-sm text-klyp-gray">{stepTitles[wizard.step]}</p>
      </div>

      {/* Stepper */}
      <Stepper currentStep={wizard.step} />

      {/* Contenido del paso activo */}
      <Card className="border-klyp-pale">
        <CardContent className="pt-6">
          {wizard.step === 1 && (
            <Step1Form
              data={wizard.step1}
              onChange={(patch) =>
                setWizard((prev) => ({
                  ...prev,
                  step1: { ...prev.step1, ...patch },
                }))
              }
              onNext={() => void handleSearchAvailability()}
              isSearching={isSearching}
              searchError={searchError}
              types={types}
              extras={extras}
            />
          )}

          {wizard.step === 2 && wizard.availabilityResult && (
            <Step2Selection
              availabilityResult={wizard.availabilityResult}
              selectedUnit={wizard.selectedUnit}
              onSelectUnit={handleSelectUnit}
              onBack={() => setWizard((prev) => ({ ...prev, step: 1 }))}
              onNext={handleGoToStep3}
              numPersons={wizard.step1.num_persons}
            />
          )}

          {wizard.step === 3 && wizard.selectedUnit && (
            <Step3GuestAndSummary
              step1={wizard.step1}
              selectedUnit={wizard.selectedUnit}
              pricePreview={wizard.pricePreview}
              onBack={() => setWizard((prev) => ({ ...prev, step: 2 }))}
              onSubmit={(values) => void handleCreateReservation(values)}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
