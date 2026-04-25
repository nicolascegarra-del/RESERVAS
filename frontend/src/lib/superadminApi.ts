import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

// Cliente con interceptor de auth (usa accessToken del store Zustand)
const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  stripe_enabled: boolean;
  smtp_enabled: boolean;
  created_at: string;
}

export interface TenantConfig {
  stripe_enabled: boolean;
  stripe_secret_key_set: boolean;
  stripe_webhook_secret_set: boolean;
  stripe_currency: string;
  smtp_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password_set: boolean;
  smtp_from: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "company_admin" | "reception";
  tenant_id: string | null;
  tenant_name: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const tenantsApi = {
  list: () => client.get<TenantSummary[]>("/api/v1/superadmin/tenants"),
  create: (data: { name: string; slug: string }) =>
    client.post<TenantSummary>("/api/v1/superadmin/tenants", data),
  get: (id: string) => client.get<TenantSummary>(`/api/v1/superadmin/tenants/${id}`),
  update: (id: string, data: Partial<{ name: string; slug: string; is_active: boolean }>) =>
    client.patch<TenantSummary>(`/api/v1/superadmin/tenants/${id}`, data),
  deactivate: (id: string) => client.delete(`/api/v1/superadmin/tenants/${id}`),
  getConfig: (id: string) => client.get<TenantConfig>(`/api/v1/superadmin/tenants/${id}/config`),
  updateConfig: (id: string, data: Partial<TenantConfig & {
    stripe_secret_key?: string;
    stripe_webhook_secret?: string;
    smtp_password?: string;
  }>) => client.patch<TenantConfig>(`/api/v1/superadmin/tenants/${id}/config`, data),
};

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const adminUsersApi = {
  list: (tenantId?: string) =>
    client.get<AdminUser[]>("/api/v1/superadmin/users", {
      params: tenantId ? { tenant_id: tenantId } : undefined,
    }),
  create: (data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    tenant_id?: string | null;
  }) => client.post<AdminUser>("/api/v1/superadmin/users", data),
  get: (id: string) => client.get<AdminUser>(`/api/v1/superadmin/users/${id}`),
  update: (id: string, data: Partial<{ full_name: string; role: string; tenant_id: string; is_active: boolean }>) =>
    client.patch<AdminUser>(`/api/v1/superadmin/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    client.post(`/api/v1/superadmin/users/${id}/reset-password`, { new_password: newPassword }),
  deactivate: (id: string) => client.delete(`/api/v1/superadmin/users/${id}`),
};
