"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { extractApiErrorMessage } from "@/lib/utils";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es obligatorio.")
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
    <main className="flex min-h-screen items-center justify-center bg-klyp-navy px-4">
      {/* Fondo decorativo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-5"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-klyp-accent blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-klyp-accent blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Marca */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-white">
            Klyp
          </h1>
          <p className="mt-1 text-klyp-pale/70 text-sm font-medium tracking-widest uppercase">
            Reservas v4.0
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Introduce tus credenciales para acceder al panel.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-xs text-red-600" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-klyp-gray" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-klyp-gray hover:text-klyp-text-dark min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-red-600" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Error de API */}
              {apiError && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                >
                  {apiError}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Iniciando sesión..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-klyp-pale/60 hover:text-klyp-pale transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al inicio
          </Link>
          <p className="text-xs text-klyp-pale/40">
            Klyp RESERVAS &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
