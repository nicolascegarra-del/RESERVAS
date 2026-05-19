/**
 * Tipos compartidos del dominio RESERVAS v4.0.
 * Punto único de verdad para tipos de datos del sistema.
 */

export type UserRole = "super_admin" | "company_admin" | "reception";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Formato de error estándar Klyp */
export interface KlypApiError {
  error: {
    code: string;
    message: string;
    field?: string;
    request_id?: string;
  };
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  company_admin: "Admin Empresa",
  reception: "Recepción",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  company_admin: "bg-blue-100 text-blue-800",
  reception: "bg-green-100 text-green-800",
};

// ─── Alojamientos ─────────────────────────────────────────────────────────────

export type AccommodationCategory = "parcela" | "apartamento" | "albergue";

export type FieldType = "text" | "number" | "boolean" | "select";

export interface AccommodationType {
  id: string;
  tenant_id: string;
  name: string;
  type_category: AccommodationCategory;
  description: string | null;
  is_active: boolean;
  created_at: string;
  /** Solo presente en el endpoint de listado */
  active_unit_count?: number;
}

export interface AccommodationUnit {
  id: string;
  tenant_id: string;
  accommodation_type_id: string;
  name: string;
  description: string | null;
  capacity: number;
  is_active: boolean;
  custom_fields: Record<string, unknown>;
  created_at: string;
}

export interface FieldDefinition {
  id: string;
  tenant_id: string;
  accommodation_type_id: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface Extra {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

/** AccommodationType con sus unidades — devuelto por GET /types/{id} */
export interface AccommodationTypeWithUnits extends AccommodationType {
  units: AccommodationUnit[];
}

export const CATEGORY_LABELS: Record<AccommodationCategory, string> = {
  parcela: "Parcela",
  apartamento: "Apartamento",
  albergue: "Albergue",
};

export const CATEGORY_COLORS: Record<AccommodationCategory, string> = {
  parcela: "bg-green-100 text-green-800",
  apartamento: "bg-blue-100 text-blue-800",
  albergue: "bg-amber-100 text-amber-800",
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  boolean: "Sí/No",
  select: "Selección",
};

// ─── Cancelaciones (Sprint 5) ─────────────────────────────────────────────────

export type RefundOrderStatus = "pending" | "processed" | "rejected";

export interface CancellationPolicy {
  id: string;
  tenant_id: string;
  accommodation_type_id: string | null;
  name: string;
  full_refund_days: number;
  partial_refund_days: number;
  partial_refund_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefundPreview {
  reservation_id: string;
  total_paid: string;
  refund_amount: string;
  refund_percentage: number;
  days_before_checkin: number;
  policy_name: string | null;
  tramo: "full" | "partial" | "none";
}

export interface RefundOrder {
  id: string;
  tenant_id: string;
  reservation_id: string;
  cancellation_policy_id: string | null;
  total_paid: string;
  refund_amount: string;
  refund_percentage: number;
  days_before_checkin: number;
  cancellation_reason: string | null;
  status: RefundOrderStatus;
  processed_at: string | null;
  stripe_refund_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedRefundOrders {
  items: RefundOrder[];
  total: number;
  page: number;
  pages: number;
}

export const REFUND_ORDER_STATUS_LABELS: Record<RefundOrderStatus, string> = {
  pending: "Pendiente",
  processed: "Procesada",
  rejected: "Rechazada",
};

export const REFUND_ORDER_STATUS_COLORS: Record<RefundOrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export const REFUND_TRAMO_LABELS: Record<string, string> = {
  full: "Reembolso completo",
  partial: "Reembolso parcial",
  none: "Sin reembolso",
};

// ─── Precios y Temporadas (Sprint 3) ──────────────────────────────────────────

export interface PricingModel {
  id: string;
  tenant_id: string;
  accommodation_type_id: string;
  /** Decimal serializado como string desde la API */
  unit_price_per_night: string | null;
  plot_price_per_night: string | null;
  person_price_per_night: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  tenant_id: string;
  accommodation_type_id: string;
  name: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
  priority: number;
  unit_price_per_night: string | null;
  plot_price_per_night: string | null;
  person_price_per_night: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ExtraPrice {
  id: string;
  tenant_id: string;
  pricing_model_id: string;
  extra_id: string;
  price_per_night: string;
  created_at: string;
}

export interface PricingModelWithExtras extends PricingModel {
  extra_prices: ExtraPrice[];
  seasons: Season[];
}

export interface PriceBreakdownItem {
  dates: string;
  nights: number;
  price_per_night: string;
  season: string | null;
}

export interface PriceCalculationResult {
  nights: number;
  base_price: string;
  extras_price: string;
  total_price: string;
  currency: string;
  breakdown: PriceBreakdownItem[];
  applied_season: string | null;
}

// ─── Reservas (Sprint 4) ──────────────────────────────────────────────────────

export type ReservationStatus =
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export interface Reservation {
  id: string;
  tenant_id: string;
  accommodation_type_id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_id_type: string | null;
  guest_id_number: string | null;
  guest_address: string | null;
  guest_postal_code: string | null;
  guest_city: string | null;
  guest_region: string | null;
  guest_country: string | null;
  check_in: string; // "YYYY-MM-DD"
  check_out: string;
  num_persons: number;
  nights: number;
  base_price: string;
  extras_price: string;
  total_price: string;
  currency: string;
  selected_extra_ids: string[];
  status: ReservationStatus;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitAvailability {
  unit_id: string;
  unit_name: string;
  capacity: number;
  is_available: boolean;
}

export interface AvailabilityResult {
  available_units: UnitAvailability[];
  price_preview: PriceCalculationResult | null;
}

export interface ReservationHistoryEntry {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  description: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  checked_in: "En alojamiento",
  checked_out: "Check-out realizado",
  cancelled: "Cancelada",
  no_show: "No Show",
};

// ─── Documentos de viajeros ──────────────────────────────────────────────────

export type DocStatus = "none" | "partial" | "complete";

export type GuestDocType = "dni" | "passport" | "nie";

export type GuestOcrStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "manual";

export interface ReservationGuest {
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
  date_of_birth: string | null; // "YYYY-MM-DD"
  sex: string | null;
  doc_expiry_date: string | null;
  address: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  ocr_status: GuestOcrStatus;
  uploaded_by: string | null;
  doc_status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface SendDocsLinkResponse {
  token: string;
  upload_url: string;
  email_status: "sent" | "failed" | "no_smtp" | "disabled";
}

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  none: "Sin documentos",
  partial: "Parcial",
  complete: "Completo",
};

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  none: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  complete: "bg-green-100 text-green-800",
};

export const GUEST_DOC_TYPE_LABELS: Record<string, string> = {
  dni: "DNI",
  nie: "NIE",
  passport: "Pasaporte",
};

// ─── Mail Notificaciones ─────────────────────────────────────────────────────

export interface MailNotificationConfig {
  notification_type: string;
  label: string;
  description: string;
  recipient: string;
  is_time_based: boolean;
  enabled: boolean;
  subject: string;
  body_text: string;
  days_before: number | null;
}

// ─── Mail Logs ────────────────────────────────────────────────────────────────

export type MailLogStatus = "sent" | "failed" | "no_smtp";
export type MailLogSmtpSource = "tenant" | "system" | "none";
export type MailLogEmailType = "confirmation" | "reminder";

export interface MailLog {
  id: string;
  tenant_id: string;
  reservation_id: string | null;
  to_email: string;
  subject: string;
  email_type: MailLogEmailType;
  status: MailLogStatus;
  smtp_source: MailLogSmtpSource;
  error_message: string | null;
  sent_at: string;
}

export interface PaginatedMailLogs {
  items: MailLog[];
  total: number;
  page: number;
  pages: number;
}

export const MAIL_LOG_STATUS_LABELS: Record<MailLogStatus, string> = {
  sent: "Enviado",
  failed: "Error",
  no_smtp: "Sin SMTP",
};

export const MAIL_LOG_STATUS_COLORS: Record<MailLogStatus, string> = {
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  no_smtp: "bg-gray-100 text-gray-600",
};

export const MAIL_LOG_EMAIL_TYPE_LABELS: Record<MailLogEmailType, string> = {
  confirmation: "Confirmación",
  reminder: "Recordatorio",
};

export const MAIL_LOG_SMTP_SOURCE_LABELS: Record<MailLogSmtpSource, string> = {
  tenant: "SMTP Empresa",
  system: "SMTP Sistema",
  none: "—",
};

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-green-100 text-green-800",
  checked_out: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
};

// ─── Control de acceso ────────────────────────────────────────────────────────

export interface ReservationVehicle {
  id: string;
  reservation_id: string;
  plate: string;
  created_at: string;
}

export interface ReservationAccessCode {
  id: string;
  reservation_id: string;
  code: string;
  person_index: number;
  created_at: string;
  updated_at: string;
}
