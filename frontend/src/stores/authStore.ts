/**
 * Store de autenticación con Zustand.
 * El access token se guarda SOLO en memoria (nunca en localStorage).
 * El refresh token vive en una HttpOnly cookie gestionada por el servidor.
 *
 * Para super_admin: selectedTenantId permite operar sobre un tenant concreto.
 */

import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Tenant seleccionado por el super_admin para operar. null = no seleccionado */
  selectedTenantId: string | null;
  selectedTenantName: string | null;
}

interface AuthActions {
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  setSelectedTenantId: (tenantId: string | null) => void;
  setSelectedTenant: (tenantId: string | null, tenantName: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  // Estado inicial
  user: null,
  accessToken: null,
  isAuthenticated: false,
  selectedTenantId: null,
  selectedTenantName: null,

  // Establecer usuario y token tras login exitoso
  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  // Actualizar solo el access token (tras refresh)
  setAccessToken: (accessToken) => set({ accessToken }),

  // Limpiar todo el estado (logout)
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      selectedTenantId: null,
      selectedTenantName: null,
    }),

  // Seleccionar tenant para super_admin (legacy — sin nombre)
  setSelectedTenantId: (tenantId) => set({ selectedTenantId: tenantId, selectedTenantName: null }),

  // Seleccionar tenant con nombre para mostrar en el banner de impersonación
  setSelectedTenant: (tenantId, tenantName) => set({ selectedTenantId: tenantId, selectedTenantName: tenantName }),
}));
