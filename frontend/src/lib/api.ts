/**
 * Instancia de Axios configurada con interceptores de autenticación.
 * - Agrega Authorization: Bearer <accessToken> en cada request.
 * - En 401, intenta refresh automático. Si falla, hace logout y redirige.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Envía cookies HttpOnly (refresh token)
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de request: inyecta el access token y el tenant_id para super_admin
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, user, selectedTenantId } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Si es super_admin y hay un tenant seleccionado, lo inyectamos como query param
    if (user?.role === "super_admin" && selectedTenantId) {
      config.params = { ...config.params, tenant_id: selectedTenantId };
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Control de reintentos para evitar bucles infinitos en el refresh
let isRefreshing = false;
let failedRequestsQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

// Interceptor de response: maneja 401 con refresh automático
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Solo intentamos refresh en 401, y no en el propio endpoint de refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      if (isRefreshing) {
        // Encolar el request mientras se refresca
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await apiClient.post<{ access_token: string }>(
          "/api/v1/auth/refresh",
        );
        const newAccessToken = refreshResponse.data.access_token;

        useAuthStore.getState().setAccessToken(newAccessToken);

        // Resolver todos los requests en cola
        failedRequestsQueue.forEach((req) => req.resolve(newAccessToken));
        failedRequestsQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh falló — limpiar estado y redirigir al login
        failedRequestsQueue.forEach((req) => req.reject(error));
        failedRequestsQueue = [];
        useAuthStore.getState().clearAuth();

        // Redirigir solo en el cliente
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Funciones de API tipadas para uso en componentes y hooks


export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ access_token: string; token_type: string }>(
      "/api/v1/auth/login",
      { email, password },
    ),

  refresh: () =>
    apiClient.post<{ access_token: string }>("/api/v1/auth/refresh"),

  logout: () => apiClient.post("/api/v1/auth/logout"),
};

// ─── Alojamientos ─────────────────────────────────────────────────────────────

import type {
  MailNotificationConfig,
  PaymentMethod,
  ReservationPayment,
  Invoice,
  RedsysFormData,
  AccommodationType,
  AccommodationTypeWithUnits,
  AccommodationUnit,
  FieldDefinition,
  Extra,
  PricingModel,
  PricingModelWithExtras,
  Season,
  ExtraPrice,
  PriceCalculationResult,
  Reservation,
  ReservationHistoryEntry,
  AvailabilityResult,
  CancellationPolicy,
  RefundPreview,
  RefundOrder,
  PaginatedRefundOrders,
  PaginatedMailLogs,
} from "@/types";

interface AccommodationTypeCreate {
  name: string;
  type_category: string;
  description?: string | null;
  iva_rate?: number;
}

interface AccommodationTypeUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  iva_rate?: number;
}

interface AccommodationUnitCreate {
  accommodation_type_id: string;
  name: string;
  description?: string | null;
  capacity: number;
  metadata?: Record<string, unknown>;
}

interface AccommodationUnitUpdate {
  name?: string;
  description?: string | null;
  capacity?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

interface FieldDefinitionCreate {
  accommodation_type_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options?: string[] | null;
  is_required?: boolean;
  sort_order?: number;
}

interface FieldDefinitionUpdate {
  field_label?: string;
  field_type?: string;
  options?: string[] | null;
  is_required?: boolean;
  sort_order?: number;
}

interface ExtraCreate {
  name: string;
  description?: string | null;
  iva_rate?: number;
}

interface ExtraUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  iva_rate?: number;
}

export const accommodationsApi = {
  // AccommodationType
  listTypes: (params?: { include_inactive?: boolean }) =>
    apiClient.get<AccommodationType[]>("/api/v1/accommodations/types", {
      params,
    }),

  getType: (typeId: string) =>
    apiClient.get<AccommodationTypeWithUnits>(
      `/api/v1/accommodations/types/${typeId}`,
    ),

  createType: (data: AccommodationTypeCreate) =>
    apiClient.post<AccommodationType>("/api/v1/accommodations/types", data),

  updateType: (typeId: string, data: AccommodationTypeUpdate) =>
    apiClient.put<AccommodationType>(
      `/api/v1/accommodations/types/${typeId}`,
      data,
    ),

  deleteType: (typeId: string) =>
    apiClient.delete(`/api/v1/accommodations/types/${typeId}`),

  // AccommodationUnit
  listUnits: (params?: { type_id?: string; include_inactive?: boolean }) =>
    apiClient.get<AccommodationUnit[]>("/api/v1/accommodations/units", {
      params,
    }),

  getUnit: (unitId: string) =>
    apiClient.get<AccommodationUnit>(
      `/api/v1/accommodations/units/${unitId}`,
    ),

  createUnit: (data: AccommodationUnitCreate) =>
    apiClient.post<AccommodationUnit>("/api/v1/accommodations/units", data),

  updateUnit: (unitId: string, data: AccommodationUnitUpdate) =>
    apiClient.put<AccommodationUnit>(
      `/api/v1/accommodations/units/${unitId}`,
      data,
    ),

  deleteUnit: (unitId: string) =>
    apiClient.delete(`/api/v1/accommodations/units/${unitId}`),

  // FieldDefinition
  listFields: (typeId: string) =>
    apiClient.get<FieldDefinition[]>("/api/v1/accommodations/fields", {
      params: { type_id: typeId },
    }),

  createField: (data: FieldDefinitionCreate) =>
    apiClient.post<FieldDefinition>("/api/v1/accommodations/fields", data),

  updateField: (fieldId: string, data: FieldDefinitionUpdate) =>
    apiClient.put<FieldDefinition>(
      `/api/v1/accommodations/fields/${fieldId}`,
      data,
    ),

  deleteField: (fieldId: string) =>
    apiClient.delete(`/api/v1/accommodations/fields/${fieldId}`),

  // Extra
  listExtras: (params?: { include_inactive?: boolean }) =>
    apiClient.get<Extra[]>("/api/v1/accommodations/extras", { params }),

  createExtra: (data: ExtraCreate) =>
    apiClient.post<Extra>("/api/v1/accommodations/extras", data),

  updateExtra: (extraId: string, data: ExtraUpdate) =>
    apiClient.put<Extra>(`/api/v1/accommodations/extras/${extraId}`, data),

  deleteExtra: (extraId: string) =>
    apiClient.delete(`/api/v1/accommodations/extras/${extraId}`),
};

// ─── Precios (Sprint 3) ────────────────────────────────────────────────────────

interface PricingModelUpsert {
  unit_price_per_night?: string | null;
  plot_price_per_night?: string | null;
  person_price_per_night?: string | null;
  currency?: string;
}

interface SeasonCreate {
  name: string;
  start_date: string;
  end_date: string;
  priority?: number;
  unit_price_per_night?: string | null;
  plot_price_per_night?: string | null;
  person_price_per_night?: string | null;
  is_active?: boolean;
}

interface SeasonUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  priority?: number;
  unit_price_per_night?: string | null;
  plot_price_per_night?: string | null;
  person_price_per_night?: string | null;
  is_active?: boolean;
}

interface ExtraPriceUpsert {
  price_per_night: string;
}

interface PriceCalculationRequest {
  accommodation_type_id: string;
  unit_id?: string | null;
  check_in: string;
  check_out: string;
  num_persons?: number;
  extra_ids?: string[];
}

export const pricingApi = {
  getModel: (typeId: string) =>
    apiClient.get<PricingModelWithExtras | null>(
      `/api/v1/pricing/types/${typeId}/model`,
    ),

  upsertModel: (typeId: string, data: PricingModelUpsert) =>
    apiClient.put<PricingModel>(
      `/api/v1/pricing/types/${typeId}/model`,
      data,
    ),

  getSeasons: (typeId: string) =>
    apiClient.get<Season[]>(`/api/v1/pricing/types/${typeId}/seasons`),

  createSeason: (typeId: string, data: SeasonCreate) =>
    apiClient.post<Season>(
      `/api/v1/pricing/types/${typeId}/seasons`,
      data,
    ),

  updateSeason: (typeId: string, seasonId: string, data: SeasonUpdate) =>
    apiClient.put<Season>(
      `/api/v1/pricing/types/${typeId}/seasons/${seasonId}`,
      data,
    ),

  deleteSeason: (typeId: string, seasonId: string) =>
    apiClient.delete(
      `/api/v1/pricing/types/${typeId}/seasons/${seasonId}`,
    ),

  getExtraPrices: (typeId: string) =>
    apiClient.get<ExtraPrice[]>(`/api/v1/pricing/types/${typeId}/extras`),

  upsertExtraPrice: (typeId: string, extraId: string, data: ExtraPriceUpsert) =>
    apiClient.put<ExtraPrice>(
      `/api/v1/pricing/types/${typeId}/extras/${extraId}`,
      data,
    ),

  deleteExtraPrice: (typeId: string, extraPriceId: string) =>
    apiClient.delete(
      `/api/v1/pricing/types/${typeId}/extras/${extraPriceId}`,
    ),

  calculate: (data: PriceCalculationRequest) =>
    apiClient.post<PriceCalculationResult>("/api/v1/pricing/calculate", data),
};

// ─── Reservas (Sprint 4) ──────────────────────────────────────────────────────

interface ReservationListParams {
  status?: string;
  unit_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

interface ReservationCreate {
  accommodation_type_id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  guest_id_type?: string | null;
  guest_id_number?: string | null;
  guest_address?: string | null;
  guest_postal_code?: string | null;
  guest_city?: string | null;
  guest_region?: string | null;
  guest_country?: string | null;
  check_in: string;
  check_out: string;
  num_persons?: number;
  selected_extra_ids?: string[];
  internal_notes?: string | null;
}

interface ReservationUpdate {
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string | null;
  guest_id_type?: string | null;
  guest_id_number?: string | null;
  guest_address?: string | null;
  guest_postal_code?: string | null;
  guest_city?: string | null;
  guest_region?: string | null;
  guest_country?: string | null;
  internal_notes?: string | null;
}

interface ReservationStatusUpdate {
  status: string;
  internal_notes?: string | null;
}

interface AvailabilityRequest {
  accommodation_type_id: string;
  check_in: string;
  check_out: string;
  num_persons?: number;
  selected_extra_ids?: string[];
}

export interface CalendarDayReservation {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  num_persons: number;
  status: string;
  unit_id: string | null;
  total_price: number | null;
  nights: number;
}

export interface CalendarDay {
  date: string;
  weekday: number;
  occupied_units: number;
  total_units: number;
  occupancy_pct: number;
  check_ins: number;
  check_outs: number;
  reservations: CalendarDayReservation[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  total_units: number;
  avg_occupancy_pct: number;
  total_check_ins: number;
  total_reservations: number;
  total_revenue: number;
  days: CalendarDay[];
}

export const reservationsApi = {
  checkAvailability: (data: AvailabilityRequest) =>
    apiClient.post<AvailabilityResult>("/api/v1/reservations/availability", data),

  list: (params?: ReservationListParams) =>
    apiClient.get<{
      items: Reservation[];
      total: number;
      page: number;
      pages: number;
    }>("/api/v1/reservations", { params }),

  get: (id: string) =>
    apiClient.get<Reservation>(`/api/v1/reservations/${id}`),

  create: (data: ReservationCreate) =>
    apiClient.post<Reservation>("/api/v1/reservations", data),

  update: (id: string, data: ReservationUpdate) =>
    apiClient.patch<Reservation>(`/api/v1/reservations/${id}`, data),

  updateStatus: (id: string, data: ReservationStatusUpdate) =>
    apiClient.patch<Reservation>(`/api/v1/reservations/${id}/status`, data),

  getRefundPreview: (id: string) =>
    apiClient.get<RefundPreview>(`/api/v1/reservations/${id}/refund-preview`),

  cancel: (id: string, data: { cancellation_reason?: string | null }) =>
    apiClient.post<{ reservation: Reservation; refund_order: RefundOrder }>(
      `/api/v1/reservations/${id}/cancel`,
      data,
    ),

  getCalendar: (
    year: number,
    month: number,
    opts?: { accommodationTypeId?: string; status?: string }
  ) =>
    apiClient.get<CalendarMonth>("/api/v1/reservations/calendar", {
      params: {
        year,
        month,
        ...(opts?.accommodationTypeId ? { accommodation_type_id: opts.accommodationTypeId } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
    }),

  getStats: () =>
    apiClient.get<{
      total_units: number;
      active_reservations: number;
      guests_in_house: number;
      occupancy_pct_today: number;
      occupied_units_today: number;
    }>("/api/v1/reservations/stats"),

  getHistory: (id: string) =>
    apiClient.get<ReservationHistoryEntry[]>(`/api/v1/reservations/${id}/history`),

  // Matrículas
  listVehicles: (id: string) =>
    apiClient.get<import("@/types").ReservationVehicle[]>(`/api/v1/reservations/${id}/vehicles`),
  addVehicle: (id: string, plate: string) =>
    apiClient.post<import("@/types").ReservationVehicle>(`/api/v1/reservations/${id}/vehicles`, { plate }),
  deleteVehicle: (id: string, vehicleId: string) =>
    apiClient.delete(`/api/v1/reservations/${id}/vehicles/${vehicleId}`),

  // Códigos de torno
  listAccessCodes: (id: string) =>
    apiClient.get<import("@/types").ReservationAccessCode[]>(`/api/v1/reservations/${id}/access-codes`),
  generateAccessCodes: (id: string) =>
    apiClient.post<import("@/types").ReservationAccessCode[]>(`/api/v1/reservations/${id}/access-codes/generate`),
  regenerateAccessCode: (id: string, codeId: string) =>
    apiClient.post<import("@/types").ReservationAccessCode>(`/api/v1/reservations/${id}/access-codes/${codeId}/regenerate`),
};

// ─── Documentos de viajeros ──────────────────────────────────────────────────

import type { ReservationGuest, SendDocsLinkResponse } from "@/types";

interface GuestCreate {
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
}

interface GuestUpdate {
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

export interface DocsAlertItem {
  reservation_id: string;
  guest_name: string;
  check_in: string;
  num_persons: number;
  registered_guests: number;
  completed_guests: number;
  status: "none" | "partial" | "complete";
}

export const guestsApi = {
  docsAlerts: (daysAhead = 1) =>
    apiClient.get<DocsAlertItem[]>("/api/v1/reservations/docs-alerts", {
      params: { days_ahead: daysAhead },
    }),

  docsStatusBulk: (reservationIds: string[]) =>
    apiClient.post<Record<string, "none" | "partial" | "complete">>(
      "/api/v1/reservations/docs-status",
      { reservation_ids: reservationIds },
    ),

  list: (reservationId: string) =>
    apiClient.get<ReservationGuest[]>(
      `/api/v1/reservations/${reservationId}/guests`,
    ),

  create: (reservationId: string, data: GuestCreate) =>
    apiClient.post<ReservationGuest>(
      `/api/v1/reservations/${reservationId}/guests`,
      data,
    ),

  update: (reservationId: string, guestId: string, data: GuestUpdate) =>
    apiClient.patch<ReservationGuest>(
      `/api/v1/reservations/${reservationId}/guests/${guestId}`,
      data,
    ),

  remove: (reservationId: string, guestId: string) =>
    apiClient.delete(
      `/api/v1/reservations/${reservationId}/guests/${guestId}`,
    ),

  scan: (
    reservationId: string,
    guestId: string,
    side: "front" | "back",
    file: File,
  ) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<ReservationGuest>(
      `/api/v1/reservations/${reservationId}/guests/${guestId}/scan`,
      form,
      {
        params: { side },
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  sendDocsLink: (reservationId: string) =>
    apiClient.post<SendDocsLinkResponse>(
      `/api/v1/reservations/${reservationId}/send-docs-link`,
    ),

  /** URL absoluta para descargar el XML SES (incluye token vía header). */
  sesExportUrl: (reservationId: string) =>
    `/api/v1/reservations/${reservationId}/guests/ses-export`,

  sesExport: (reservationId: string) =>
    apiClient.get(
      `/api/v1/reservations/${reservationId}/guests/ses-export`,
      { responseType: "blob" },
    ),
};

// ─── Cancelaciones (Sprint 5) ─────────────────────────────────────────────────

interface CancellationPolicyCreate {
  accommodation_type_id?: string | null;
  name: string;
  full_refund_days: number;
  partial_refund_days: number;
  partial_refund_percentage: number;
}

interface CancellationPolicyUpdate {
  name?: string;
  full_refund_days?: number;
  partial_refund_days?: number;
  partial_refund_percentage?: number;
  is_active?: boolean;
}

interface RefundOrderProcess {
  status: "processed" | "rejected";
  notes?: string | null;
  stripe_refund_id?: string | null;
}

export const cancellationsApi = {
  listPolicies: () =>
    apiClient.get<CancellationPolicy[]>("/api/v1/cancellation-policies"),

  createPolicy: (data: CancellationPolicyCreate) =>
    apiClient.post<CancellationPolicy>("/api/v1/cancellation-policies", data),

  updatePolicy: (id: string, data: CancellationPolicyUpdate) =>
    apiClient.put<CancellationPolicy>(
      `/api/v1/cancellation-policies/${id}`,
      data,
    ),

  deletePolicy: (id: string) =>
    apiClient.delete(`/api/v1/cancellation-policies/${id}`),

  listRefundOrders: (params?: { status?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedRefundOrders>("/api/v1/refund-orders", { params }),

  processRefundOrder: (id: string, data: RefundOrderProcess) =>
    apiClient.patch<RefundOrder>(`/api/v1/refund-orders/${id}/process`, data),
};

// ─── Configuración / Branding ─────────────────────────────────────────────────

export interface TenantBranding {
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tagline: string | null;
}

export const settingsApi = {
  getBranding: () =>
    apiClient.get<TenantBranding>("/api/v1/settings/branding"),

  updateBranding: (data: Partial<TenantBranding>) =>
    apiClient.patch<TenantBranding>("/api/v1/settings/branding", data),

  getMailNotifications: () =>
    apiClient.get<MailNotificationConfig[]>("/api/v1/settings/mail-notifications"),

  updateMailNotification: (
    notificationType: string,
    data: { enabled: boolean; subject: string; body_text: string; days_before?: number | null }
  ) =>
    apiClient.put<MailNotificationConfig>(
      `/api/v1/settings/mail-notifications/${notificationType}`,
      data
    ),
};

// ─── Admin (super_admin only) ─────────────────────────────────────────────────

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

export const adminApi = {
  listTenants: () =>
    apiClient.get<TenantSummary[]>("/api/v1/admin/tenants"),
};

// ─── Solicitudes de cambio ────────────────────────────────────────────────────

export type ChangeRequestType = "status_change" | "price_change";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  reservation_id: string;
  requested_by_name: string;
  type: ChangeRequestType;
  requested_status: string | null;
  requested_price: number | null;
  comment: string;
  status: ChangeRequestStatus;
  reviewed_by_name: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ─── Access Logs ─────────────────────────────────────────────────────────────

export interface AccessLog {
  id: string;
  user_id: string | null;
  user_email: string;
  user_role: string | null;
  tenant_id: string | null;
  ip_address: string | null;
  event_type: string;
  detail: string | null;
  accessed_at: string;
}

export interface PaginatedAccessLogs {
  items: AccessLog[];
  total: number;
  page: number;
  pages: number;
}

interface AccessLogParams {
  event_type?: string;
  user_email?: string;
  tenant_id?: string;
  page?: number;
  page_size?: number;
}

export const accessLogsApi = {
  listAll: (params?: AccessLogParams) =>
    apiClient.get<PaginatedAccessLogs>("/api/v1/superadmin/access-logs", { params }),
  deleteAll: () =>
    apiClient.delete<{ deleted: number }>("/api/v1/superadmin/access-logs"),
};

// ─── Mail Logs ────────────────────────────────────────────────────────────────

interface MailLogParams {
  status?: string;
  email_type?: string;
  page?: number;
  page_size?: number;
}

export const mailLogsApi = {
  listAll: (params?: MailLogParams & { tenant_id?: string }) =>
    apiClient.get<PaginatedMailLogs>("/api/v1/superadmin/mail-logs", { params }),

  listTenant: (params?: MailLogParams) =>
    apiClient.get<PaginatedMailLogs>("/api/v1/mail-logs", { params }),

  deleteAll: () =>
    apiClient.delete<{ deleted: number }>("/api/v1/superadmin/mail-logs"),

  deleteTenant: () =>
    apiClient.delete<{ deleted: number }>("/api/v1/mail-logs"),
};

// ─── Solicitudes de cambio ────────────────────────────────────────────────────

// ─── Tipos company users ──────────────────────────────────────────────────────

export interface CompanyUser {
  id: string;
  email: string;
  full_name: string;
  role: "company_admin" | "reception";
  is_active: boolean;
  created_at: string;
}

export interface TenantLimits {
  max_company_admins: number;
  max_reception_users: number;
  active_company_admins: number;
  active_reception_users: number;
}

export const companyUsersApi = {
  getLimits: () => apiClient.get<TenantLimits>("/api/v1/company/limits"),
  list: () => apiClient.get<CompanyUser[]>("/api/v1/company/users"),
  create: (data: { email: string; full_name: string; password: string; role: string }) =>
    apiClient.post<CompanyUser>("/api/v1/company/users", data),
  update: (id: string, data: { full_name?: string; role?: string; is_active?: boolean }) =>
    apiClient.patch<CompanyUser>(`/api/v1/company/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    apiClient.post(`/api/v1/company/users/${id}/reset-password`, { new_password: newPassword }),
};

// ─── Facturación ─────────────────────────────────────────────────────────────

export const billingApi = {
  listPaymentMethods: () =>
    apiClient.get<PaymentMethod[]>("/api/v1/billing/payment-methods"),

  createPaymentMethod: (data: {
    name: string;
    method_type: string;
    config?: Record<string, string> | null;
    is_default?: boolean;
    sort_order?: number;
  }) => apiClient.post<PaymentMethod>("/api/v1/billing/payment-methods", data),

  updatePaymentMethod: (
    id: string,
    data: Partial<{
      name: string;
      is_active: boolean;
      is_default: boolean;
      config: Record<string, string> | null;
      sort_order: number;
    }>,
  ) =>
    apiClient.put<PaymentMethod>(
      `/api/v1/billing/payment-methods/${id}`,
      data,
    ),

  deletePaymentMethod: (id: string) =>
    apiClient.delete(`/api/v1/billing/payment-methods/${id}`),

  getReservationPayment: (reservationId: string) =>
    apiClient.get<ReservationPayment | null>(
      `/api/v1/billing/reservations/${reservationId}/payment`,
    ),

  createReservationPayment: (
    reservationId: string,
    data: { payment_method_id: string; amount: number; notes?: string },
  ) =>
    apiClient.post<ReservationPayment>(
      `/api/v1/billing/reservations/${reservationId}/payment`,
      data,
    ),

  getReservationInvoice: (reservationId: string) =>
    apiClient.get<Invoice | null>(
      `/api/v1/billing/reservations/${reservationId}/invoice`,
    ),

  generateInvoice: (
    reservationId: string,
    data: {
      recipient_name: string;
      recipient_nif?: string;
      recipient_address?: string;
      recipient_email?: string;
    },
  ) =>
    apiClient.post<Invoice>(
      `/api/v1/billing/reservations/${reservationId}/invoice`,
      data,
    ),

  listInvoices: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
  }) =>
    apiClient.get<{
      items: Invoice[];
      total: number;
      page: number;
      pages: number;
    }>("/api/v1/billing/invoices", { params }),

  initiateRedsysPayment: (reservationId: string) =>
    apiClient.post<RedsysFormData>(`/api/v1/redsys/initiate/${reservationId}`),
};

export const changeRequestsApi = {
  create: (data: {
    reservation_id: string;
    type: ChangeRequestType;
    requested_status?: string | null;
    requested_price?: number | null;
    comment: string;
  }) => apiClient.post<ChangeRequest>("/api/v1/change-requests", data),

  list: (pending_only = true) =>
    apiClient.get<ChangeRequest[]>("/api/v1/change-requests", { params: { pending_only } }),

  countPending: () =>
    apiClient.get<{ pending: number }>("/api/v1/change-requests/count"),

  approve: (id: string, review_comment?: string) =>
    apiClient.patch<ChangeRequest>(`/api/v1/change-requests/${id}/approve`, { review_comment }),

  reject: (id: string, review_comment?: string) =>
    apiClient.patch<ChangeRequest>(`/api/v1/change-requests/${id}/reject`, { review_comment }),
};
