// Reutiliza apiClient que ya incluye withCredentials, refresh automático y manejo de 401.
import { apiClient as client } from "@/lib/api";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  stripe_enabled: boolean;
  smtp_enabled: boolean;
  created_at: string;
  logo_url: string | null;
  legal_name: string | null;
  cif: string | null;
  address: string | null;
  postal_code: string | null;
  municipality: string | null;
  province: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  bank_account: string | null;
  max_company_admins: number;
  max_reception_users: number;
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

export interface RolePermission {
  role: string;
  permission_key: string;
  label: string;
  is_enabled: boolean;
}

export type TenantCreatePayload = {
  name: string;
  slug: string;
  legal_name?: string | null;
  cif?: string | null;
  address?: string | null;
  postal_code?: string | null;
  municipality?: string | null;
  province?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  bank_account?: string | null;
  max_company_admins?: number;
  max_reception_users?: number;
};

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const tenantsApi = {
  list: () => client.get<TenantSummary[]>("/api/v1/superadmin/tenants"),
  create: (data: TenantCreatePayload) =>
    client.post<TenantSummary>("/api/v1/superadmin/tenants", data),
  get: (id: string) => client.get<TenantSummary>(`/api/v1/superadmin/tenants/${id}`),
  update: (id: string, data: Partial<TenantCreatePayload & { is_active: boolean }>) =>
    client.patch<TenantSummary>(`/api/v1/superadmin/tenants/${id}`, data),
  suspend: (id: string) =>
    client.patch<TenantSummary>(`/api/v1/superadmin/tenants/${id}/suspend`),
  hardDelete: (id: string, password: string) =>
    client.post(`/api/v1/superadmin/tenants/${id}/hard-delete`, { password }),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return client.post<TenantSummary>(`/api/v1/superadmin/tenants/${id}/logo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
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

// ─── Usuarios Super Admin ─────────────────────────────────────────────────────

export const superAdminUsersApi = {
  list: () => client.get<AdminUser[]>("/api/v1/superadmin/superadmin-users"),
  create: (data: { email: string; full_name: string; password: string }) =>
    client.post<AdminUser>("/api/v1/superadmin/superadmin-users", data),
  update: (id: string, data: { full_name?: string; is_active?: boolean }) =>
    client.patch<AdminUser>(`/api/v1/superadmin/superadmin-users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    client.post(`/api/v1/superadmin/superadmin-users/${id}/reset-password`, { new_password: newPassword }),
  delete: (id: string) => client.delete(`/api/v1/superadmin/superadmin-users/${id}`),
};

// ─── SMTP global del sistema ─────────────────────────────────────────────────

export interface SystemSMTP {
  smtp_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password_set: boolean;
  smtp_from: string | null;
}

export const systemApi = {
  getSMTP: () => client.get<SystemSMTP>("/api/v1/superadmin/system-smtp"),
  updateSMTP: (data: Partial<SystemSMTP & { smtp_password?: string }>) =>
    client.patch<SystemSMTP>("/api/v1/superadmin/system-smtp", data),
};

// ─── Permisos por rol ─────────────────────────────────────────────────────────

export const rolePermissionsApi = {
  list: () => client.get<RolePermission[]>("/api/v1/superadmin/role-permissions"),
  update: (data: { role: string; permission_key: string; is_enabled: boolean }) =>
    client.patch<RolePermission>("/api/v1/superadmin/role-permissions", data),
};
