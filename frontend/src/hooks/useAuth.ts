/**
 * Hook de autenticación.
 * Provee acceso al estado de auth y acciones de login/logout.
 */

"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/utils";
import type { User } from "@/types";

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const login = async (email: string, password: string): Promise<void> => {
    const response = await authApi.login(email, password);
    const { access_token } = response.data;

    // Decodificar el payload del JWT para obtener los datos del usuario
    // El payload es la segunda parte del JWT (base64)
    const payloadBase64 = access_token.split(".")[1];
    if (!payloadBase64) {
      throw new Error("Token inválido recibido del servidor.");
    }

    const payload = JSON.parse(atob(payloadBase64)) as {
      sub: string;
      role: string;
      tenant_id: string | null;
      exp: number;
    };

    // Construimos un objeto User mínimo desde el token
    // En sprints futuros se puede enriquecer con un endpoint /me
    const user: User = {
      id: payload.sub,
      email,
      full_name: "",
      role: payload.role as User["role"],
      tenant_id: payload.tenant_id,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setAuth(user, access_token);
    // Super admin tiene su propio panel separado
    if (payload.role === "super_admin") {
      router.push("/empresas");
    } else {
      router.push("/dashboard");
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Aunque falle el logout del servidor, limpiamos el estado local
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  return { user, isAuthenticated, login, logout };
}

export { extractApiErrorMessage };
