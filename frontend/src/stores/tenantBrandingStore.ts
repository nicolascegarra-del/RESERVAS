import { create } from "zustand";

interface TenantBrandingState {
  primary_color: string | null;
  accent_color: string | null;
  brand_name: string | null;
  logo_url: string | null;
  tenant_name: string | null;
}

interface TenantBrandingActions {
  setBranding: (data: Partial<TenantBrandingState>) => void;
  clearBranding: () => void;
}

const DEFAULT_STATE: TenantBrandingState = {
  primary_color: null,
  accent_color: null,
  brand_name: null,
  logo_url: null,
  tenant_name: null,
};

export const useTenantBrandingStore = create<TenantBrandingState & TenantBrandingActions>((set) => ({
  ...DEFAULT_STATE,
  setBranding: (data) => set((prev) => ({ ...prev, ...data })),
  clearBranding: () => set(DEFAULT_STATE),
}));
