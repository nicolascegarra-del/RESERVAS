/**
 * Cliente Axios para endpoints públicos (sin autenticación).
 * Usa NEXT_PUBLIC_TENANT_SLUG para identificar el tenant en la URL.
 * NO incluye interceptores de auth — accesible sin login.
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

export interface PublicAccommodationType {
  id: string;
  name: string;
  type_category: string;
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
  type_category: string;
  description: string | null;
  available_units: PublicUnitAvailability[];
  price_preview: PriceCalculationResult | null;
  min_price_per_night: string | null;
  min_capacity: number;
  max_capacity: number;
}

// ─── API pública ───────────────────────────────────────────────────────────────

export const publicApi = {
  getBranding: () =>
    publicClient.get<TenantBranding>(
      `/api/v1/public/${TENANT_SLUG}/branding`,
    ),

  getAccommodationTypes: () =>
    publicClient.get<PublicAccommodationType[]>(
      `/api/v1/public/${TENANT_SLUG}/accommodation-types`,
    ),

  checkAvailability: (data: PublicAvailabilityRequest) =>
    publicClient.post<PublicTypeAvailability[]>(
      `/api/v1/public/${TENANT_SLUG}/availability`,
      data,
    ),
};
