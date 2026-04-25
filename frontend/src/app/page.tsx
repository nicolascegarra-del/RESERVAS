"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingSearchForm } from "@/components/booking/BookingSearchForm";
import { AccommodationResultCard } from "@/components/booking/AccommodationResultCard";
import {
  publicApi,
  type PublicAccommodationType,
  type PublicAvailabilityRequest,
  type PublicTypeAvailability,
  type TenantBranding,
} from "@/lib/publicApi";

const DEFAULT_PRIMARY = "#051937";
const DEFAULT_ACCENT = "#2E6DB4";
const APP_NAME = process.env["NEXT_PUBLIC_APP_NAME"] ?? "Klyp RESERVAS";

export default function LandingPage() {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [types, setTypes] = useState<PublicAccommodationType[]>([]);
  const [results, setResults] = useState<PublicTypeAvailability[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nights, setNights] = useState(0);
  const [searchCheckIn, setSearchCheckIn] = useState("");
  const [searchCheckOut, setSearchCheckOut] = useState("");
  const [searchNumPersons, setSearchNumPersons] = useState(1);
  const [typesError, setTypesError] = useState(false);

  // Cargar branding y tipos en paralelo al montar
  useEffect(() => {
    Promise.allSettled([
      publicApi.getBranding(),
      publicApi.getAccommodationTypes(),
    ]).then(([brandingResult, typesResult]) => {
      if (brandingResult.status === "fulfilled") {
        setBranding(brandingResult.value.data);
      }
      if (typesResult.status === "fulfilled") {
        setTypes(typesResult.value.data);
      } else {
        setTypesError(true);
      }
    });
  }, []);

  const primaryColor = branding?.primary_color ?? DEFAULT_PRIMARY;
  const accentColor = branding?.accent_color ?? DEFAULT_ACCENT;
  const displayName = branding?.brand_name ?? APP_NAME;
  const tagline =
    branding?.tagline ?? "Consulta disponibilidad y precios al instante. Sin registro necesario.";

  const handleSearch = async (data: PublicAvailabilityRequest) => {
    setIsSearching(true);
    setSearchError(null);
    setResults(null);

    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);
    setNights(Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    setSearchCheckIn(data.check_in);
    setSearchCheckOut(data.check_out);
    setSearchNumPersons(data.num_persons);

    try {
      const res = await publicApi.checkAvailability(data);
      setResults(res.data);
    } catch {
      setSearchError("No se pudo realizar la búsqueda. Por favor, inténtalo de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-klyp-pale">
      {/* Header con branding dinámico */}
      <header style={{ backgroundColor: primaryColor }} className="shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logo_url}
                alt={displayName}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <>
                <MapPin className="h-5 w-5 text-white/80" />
                <span className="text-xl font-bold text-white">{displayName}</span>
              </>
            )}
            {branding?.logo_url && (
              <span className="text-xl font-bold text-white">{displayName}</span>
            )}
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-[44px] text-white/80 hover:text-white hover:bg-white/10"
          >
            <Link href="/login">
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Área de gestión</span>
              <span className="sm:hidden">Gestión</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero con branding dinámico */}
      <section style={{ backgroundColor: primaryColor }} className="pb-16 pt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Encuentra tu alojamiento ideal
          </h1>
          <p className="mt-3 text-white/70 text-base sm:text-lg max-w-2xl mx-auto">
            {tagline}
          </p>

          <div className="mt-8">
            {typesError ? (
              <p className="text-white/60 text-sm">
                No se pudieron cargar los tipos de alojamiento.
              </p>
            ) : (
              <BookingSearchForm
                types={types}
                onSearch={handleSearch}
                isLoading={isSearching}
                accentColor={accentColor}
              />
            )}
          </div>
        </div>
      </section>

      {/* Resultados */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {isSearching && (
          <div className="flex flex-col items-center gap-3 py-16 text-klyp-gray">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
            />
            <p>Buscando disponibilidad...</p>
          </div>
        )}

        {searchError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
            {searchError}
          </div>
        )}

        {results !== null && !isSearching && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-lg font-semibold text-klyp-navy">Sin disponibilidad</p>
            <p className="text-klyp-gray text-sm max-w-md">
              No hay alojamientos disponibles para las fechas y número de personas indicados.
              Prueba con otras fechas o modifica el número de personas.
            </p>
          </div>
        )}

        {results !== null && !isSearching && results.length > 0 && (
          <>
            <p className="mb-4 text-sm text-klyp-gray">
              {results.length} tipo{results.length !== 1 ? "s" : ""} de alojamiento disponible{results.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <AccommodationResultCard
                  key={result.type_id}
                  result={result}
                  nights={nights}
                  checkIn={searchCheckIn}
                  checkOut={searchCheckOut}
                  numPersons={searchNumPersons}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </>
        )}

        {results === null && !isSearching && !searchError && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-klyp-gray text-sm">
              Selecciona tus fechas y pulsa &ldquo;Buscar disponibilidad&rdquo; para ver los alojamientos.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-klyp-pale bg-white py-4 text-center text-xs text-klyp-gray">
        {displayName} &copy; {new Date().getFullYear()} · Powered by Klyp
      </footer>
    </div>
  );
}
