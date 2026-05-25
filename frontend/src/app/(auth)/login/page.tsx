"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { extractApiErrorMessage } from "@/lib/utils";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El usuario es obligatorio.")
    .email("Introduce un email válido."),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria.")
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError(null);
    try {
      await login(data.email, data.password);
    } catch (error) {
      setApiError(extractApiErrorMessage(error));
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 60% 10%, #1a3a6b 0%, #051937 70%)" }}
    >
      {/* Fondo decorativo con puntos */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 4 + 2 + "px",
              height: Math.random() * 4 + 2 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-9">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="h-14 w-14 rounded-2xl bg-klyp-navy flex items-center justify-center mb-4 shadow-lg">
              <svg viewBox="0 0 40 40" fill="none" className="h-8 w-8" aria-hidden="true">
                <path d="M20 4L36 13V27L20 36L4 27V13L20 4Z" stroke="white" strokeWidth="2" fill="none" />
                <path d="M20 4L36 13M20 4L4 13M36 13V27M4 13V27M36 27L20 36M4 27L20 36" stroke="white" strokeWidth="1.5" opacity="0.5" />
                <circle cx="20" cy="20" r="5" fill="white" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-klyp-navy leading-tight">Panel de administración</h1>
            <p className="text-sm text-klyp-gray mt-1 text-center">Introduce tus credenciales para acceder</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Usuario */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-klyp-navy font-medium">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Tu usuario"
                  className="pl-9 h-11 rounded-lg border-gray-200 focus:border-klyp-navy focus:ring-klyp-navy"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-klyp-navy font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11 rounded-lg border-gray-200 focus:border-klyp-navy focus:ring-klyp-navy"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-klyp-gray hover:text-klyp-navy min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Error de API */}
            {apiError && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold bg-klyp-navy hover:bg-klyp-navy-light text-white mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Accediendo..." : "Entrar al panel"}
            </Button>
          </form>
        </div>

        {/* Link volver */}
        <div className="mt-5 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a la web
          </Link>
        </div>
      </div>
    </main>
  );
}
