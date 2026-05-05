"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Settings, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingSearchForm } from "@/components/booking/BookingSearchForm";
import { AccommodationResultCard } from "@/components/booking/AccommodationResultCard";
import {
  tenantsApi,
  createPublicApi,
  type PublicTenantInfo,
  type PublicAccommodationType,
  type PublicAvailabilityRequest,
  type PublicTypeAvailability,
} from "@/lib/publicApi";

const DEFAULT_PRIMARY = "#051937";
const DEFAULT_ACCENT = "#2E6DB4";
const APP_NAME = process.env["NEXT_PUBLIC_APP_NAME"] ?? "Klyp RESERVAS";

interface TenantResults {
  tenant: PublicTenantInfo;
  results: PublicTypeAvailability[];
}

export default function LandingPage() {
  const [tenants, setTenants] = useState<PublicTenantInfo[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState("");
  const [tenantTypes, setTenantTypes] = useState<PublicAccommodationType[]>([]);

  // Resultados: single (empresa seleccionada) o all (todas)
  const [singleResults, setSingleResults] = useState<PublicTypeAvailability[] | null>(null);
  const [allResults, setAllResults] = useState<TenantResults[] | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nights, setNights] = useState(0);
  const [searchCheckIn, setSearchCheckIn] = useState("");
  const [searchCheckOut, setSearchCheckOut] = useState("");
  const [searchNumPersons, setSearchNumPersons] = useState(1);

  // Cargar lista de tenants al montar
  useEffect(() => {
    tenantsApi.list()
      .then((res) => setTenants(res.data))
      .catch(() => setTenants([]));
  }, []);

  // Cuando cambia la empresa seleccionada, cargar sus tipos
  const handleTenantChange = useCallback(
    async (slug: string) => {
      setSelectedTenantSlug(slug);
      setSingleResults(null);
      setAllResults(null);
      setTenantTypes([]);
      if (!slug) return;
      try {
        const res = await createPublicApi(slug).getAccommodationTypes();
        setTenantTypes(res.data);
      } catch {
        setTenantTypes([]);
      }
    },
    [],
  );

  const handleSearch = async (data: PublicAvailabilityRequest) => {
    setIsSearching(true);
    setSearchError(null);
    setSingleResults(null);
    setAllResults(null);

    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);
    setNights(
      Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );
    setSearchCheckIn(data.check_in);
    setSearchCheckOut(data.check_out);
    setSearchNumPersons(data.num_persons);

    try {
      if (selectedTenantSlug) {
        // Búsqueda en una sola empresa
        const res = await createPublicApi(selectedTenantSlug).checkAvailability(data);
        setSingleResults(res.data);
      } else {
        // Búsqueda en todas las empresas en paralelo
        const requests = tenants.map((tenant) =>
          createPublicApi(tenant.slug)
            .checkAvailability(data)
            .then((res) => ({ tenant, results: res.data }))
            .catch(() => ({ tenant, results: [] as PublicTypeAvailability[] })),
        );
        const grouped = await Promise.all(requests);
        setAllResults(grouped.filter((g) => g.results.length > 0));
      }
    } catch {
      setSearchError(
        "No se pudo realizar la búsqueda. Por favor, inténtalo de nuevo.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const selectedTenant = tenants.find((t) => t.slug === selectedTenantSlug);
  const accentColor = selectedTenant?.accent_color ?? DEFAULT_ACCENT;

  const hasResults =
    (singleResults !== null && singleResults.length > 0) ||
    (allResults !== null && allResults.length > 0);

  const noResults =
    !isSearching &&
    !searchError &&
    ((singleResults !== null && singleResults.length === 0) ||
      (allResults !== null && allResults.length === 0));

  return (
    <div className="flex min-h-screen flex-col bg-klyp-pale">
      {/* Header Klyp (branding genérico en la raíz) */}
      <header style={{ backgroundColor: DEFAULT_PRIMARY }} className="shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-white/80" />
            <span className="text-xl font-bold text-white">{APP_NAME}</span>
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

      {/* Hero */}
      <section style={{ backgroundColor: DEFAULT_PRIMARY }} className="pb-16 pt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Encuentra tu alojamiento ideal
          </h1>
          <p className="mt-3 text-white/70 text-base sm:text-lg max-w-2xl mx-auto">
            Consulta disponibilidad y precios al instante. Sin registro necesario.
          </p>

          <div className="mt-8">
            <BookingSearchForm
              types={tenantTypes}
              onSearch={handleSearch}
              isLoading={isSearching}
              accentColor={accentColor}
              tenants={tenants}
              selectedTenantSlug={selectedTenantSlug}
              onTenantChange={handleTenantChange}
            />
          </div>
        </div>
      </section>

      {/* Resultados */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {isSearching && (
          <div className="flex flex-col items-center gap-3 py-16 text-klyp-gray">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
              style={{
                borderColor: `${DEFAULT_ACCENT} transparent ${DEFAULT_ACCENT} ${DEFAULT_ACCENT}`,
              }}
            />
            <p>Buscando disponibilidad...</p>
          </div>
        )}

        {searchError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
            {searchError}
          </div>
        )}

        {noResults && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-lg font-semibold text-klyp-navy">Sin disponibilidad</p>
            <p className="text-klyp-gray text-sm max-w-md">
              No hay alojamientos disponibles para las fechas y número de personas
              indicados. Prueba con otras fechas o modifica el número de personas.
            </p>
          </div>
        )}

        {/* Resultados de una sola empresa */}
        {singleResults !== null && !isSearching && singleResults.length > 0 && (
          <>
            <p className="mb-4 text-sm text-klyp-gray">
              {singleResults.length} tipo{singleResults.length !== 1 ? "s" : ""} de
              alojamiento disponible{singleResults.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {singleResults.map((result) => (
                <AccommodationResultCard
                  key={result.type_id}
                  result={result}
                  nights={nights}
                  checkIn={searchCheckIn}
                  checkOut={searchCheckOut}
                  numPersons={searchNumPersons}
                  accentColor={selectedTenant?.accent_color ?? DEFAULT_ACCENT}
                  tenantSlug={selectedTenantSlug}
                />
              ))}
            </div>
          </>
        )}

        {/* Resultados de todas las empresas agrupados */}
        {allResults !== null && !isSearching && allResults.length > 0 && (
          <div className="space-y-10">
            {allResults.map(({ tenant, results }) => (
              <div key={tenant.slug}>
                {/* Cabecera de empresa */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: tenant.primary_color ?? DEFAULT_PRIMARY }}
                  />
                  <h2 className="text-lg font-semibold text-klyp-navy">{tenant.name}</h2>
                  <div className="flex-1 h-px bg-klyp-pale" />
                  <span className="text-xs text-klyp-gray shrink-0">
                    {results.length} disponible{results.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((result) => (
                    <AccommodationResultCard
                      key={`${tenant.slug}-${result.type_id}`}
                      result={result}
                      nights={nights}
                      checkIn={searchCheckIn}
                      checkOut={searchCheckOut}
                      numPersons={searchNumPersons}
                      accentColor={tenant.accent_color ?? DEFAULT_ACCENT}
                      tenantSlug={tenant.slug}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasResults && !isSearching && !searchError && singleResults === null && allResults === null && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-klyp-gray text-sm">
              Selecciona tus fechas y pulsa &ldquo;Buscar disponibilidad&rdquo; para ver los
              alojamientos.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-klyp-pale bg-white py-4 text-center text-xs text-klyp-gray">
        {APP_NAME} &copy; {new Date().getFullYear()} · Powered by Klyp
      </footer>
    </div>
  );
}
