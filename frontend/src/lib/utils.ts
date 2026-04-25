import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma segura, resolviendo conflictos.
 * Wrapper estándar de shadcn/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha ISO 8601 al formato DD/MM/YYYY (estándar Klyp).
 * @param isoDate - Fecha en formato ISO 8601.
 * @returns Fecha formateada para UI.
 */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Extrae el mensaje de error de una respuesta de API Klyp.
 * @param error - Error capturado (puede ser AxiosError, Error, o unknown).
 * @returns Mensaje legible para el usuario.
 */
/**
 * Formatea un número o string decimal como moneda (por defecto EUR, locale es-ES).
 * @param amount - Cantidad (puede ser string decimal de la API o número).
 * @param currency - Código ISO 4217 de moneda (default: 'EUR').
 * @returns String formateado, ej: "1.234,56 €"
 */
export function formatCurrency(
  amount: string | number,
  currency = "EUR",
): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function extractApiErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as { detail?: { error?: { message?: string } } | string };
    if (typeof data.detail === "object" && data.detail?.error?.message) {
      return data.detail.error.message;
    }
    if (typeof data.detail === "string") {
      return data.detail;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
}
