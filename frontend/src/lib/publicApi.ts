/**
 * Cliente Axios para endpoints públicos (sin autenticación).
 * Usa createPublicApi(slug) para instanciar la API de un tenant concreto.
 * La instancia `publicApi` usa el slug del env var para compatibilidad con /[slug].
 */

import axios from "axios";
import type { PriceCalculationResult } from "@/types";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";
const TENANT_SLUG =
  process.env["NEXT_PUBLIC_TENANT_SLUG"] ?? "camping-el-pinar";

const publicClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ─── Types públicos ────────────────────────────────────────────────────────────

export interface TenantBranding {
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tagline: string | null;
}

export interface PublicTenantInfo {
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
}

export interface PublicAccommodationType {
  id: string;
  name: string;
  description: string | null;
  active_unit_count: number;
}

export interface PublicAvailabilityRequest {
  accommodation_type_id?: string | null;
  check_in: string; // "YYYY-MM-DD"
  check_out: string;
  num_persons: number;
}

export interface PublicUnitAvailability {
  unit_id: string;
  unit_name: string;
  capacity: number;
  is_available: boolean;
}

export interface PublicTypeAvailability {
  type_id: string;
  type_name: string;
  description: string | null;
  available_units: PublicUnitAvailability[];
  price_preview: PriceCalculationResult | null;
  min_price_per_night: string | null;
  min_capacity: number;
  max_capacity: number;
}

// ─── Factory por tenant ────────────────────────────────────────────────────────

export const createPublicApi = (slug: string) => ({
  getBranding: () =>
    publicClient.get<TenantBranding>(`/api/v1/public/${slug}/branding`),

  getAccommodationTypes: () =>
    publicClient.get<PublicAccommodationType[]>(
      `/api/v1/public/${slug}/accommodation-types`,
    ),

  checkAvailability: (data: PublicAvailabilityRequest) =>
    publicClient.post<PublicTypeAvailability[]>(
      `/api/v1/public/${slug}/availability`,
      data,
    ),
});

// Instancia por defecto (usada en /[slug] cuando viene del env var)
export const publicApi = createPublicApi(TENANT_SLUG);

// ─── API global: lista de tenants ─────────────────────────────────────────────

export const tenantsApi = {
  list: () =>
    publicClient.get<PublicTenantInfo[]>(`/api/v1/public/tenants`),
};

// ─── Carga pública de documentos de viajeros (token) ──────────────────────────

export interface PublicGuestUploadInfo {
  reservation_id: string;
  guest_name: string;
  accommodation_name: string;
  check_in: string;
  check_out: string;
  num_persons: number;
  brand_name: string;
  primary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  registered_guests: number;
  completed_guests: number;
}

export interface PublicGuest {
  id: string;
  reservation_id: string;
  tenant_id: string;
  is_main: boolean;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  doc_type: string | null;
  doc_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  sex: string | null;
  doc_expiry_date: string | null;
  address: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  ocr_status: "pending" | "processing" | "completed" | "failed" | "manual";
  uploaded_by: string | null;
  doc_status: "none" | "partial" | "complete";
  created_at: string;
  updated_at: string;
}

export interface PublicGuestPayload {
  is_main?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  doc_expiry_date?: string | null;
  address?: string | null;
  mark_manual?: boolean;
}

export const guestUploadApi = {
  getInfo: (token: string) =>
    publicClient.get<PublicGuestUploadInfo>(
      `/api/v1/public/guest-upload/${token}`,
    ),

  listGuests: (token: string) =>
    publicClient.get<PublicGuest[]>(
      `/api/v1/public/guest-upload/${token}/guests`,
    ),

  createGuest: (token: string, data: PublicGuestPayload) =>
    publicClient.post<PublicGuest>(
      `/api/v1/public/guest-upload/${token}/guests`,
      data,
    ),

  updateGuest: (token: string, guestId: string, data: PublicGuestPayload) =>
    publicClient.patch<PublicGuest>(
      `/api/v1/public/guest-upload/${token}/guests/${guestId}`,
      data,
    ),

  uploadSide: (
    token: string,
    guestId: string,
    side: "front" | "back",
    file: File,
  ) => {
    const form = new FormData();
    form.append("file", file);
    return publicClient.post<PublicGuest>(
      `/api/v1/public/guest-upload/${token}/guests/${guestId}/${side}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  },
};
