"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Loader2, Key, UserX, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminUsersApi, tenantsApi, type AdminUser, type TenantSummary } from "@/lib/superadminApi";

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Admin Empresa",
  reception: "Gestión",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  company_admin: "bg-blue-100 text-blue-700",
  reception: "bg-green-100 text-green-700",
};

function CreateUserDialog({
  open, onOpenChange, tenants, preselectedTenantId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants: TenantSummary[];
  preselectedTenantId: string;
  onCreated: (u: AdminUser) => void;
}) {
  const [form, setForm] = useState({
    email: "", full_name: "", password: "", role: "reception", tenant_id: preselectedTenantId,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, tenant_id: preselectedTenantId }));
  }, [preselectedTenantId]);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.password) { setError("Todos los campos son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await adminUsersApi.create({
        ...form,
        tenant_id: form.role === "super_admin" ? null : (form.tenant_id || null),
      });
      onCreated(res.data);
      setForm({ email: "", full_name: "", password: "", role: "reception", tenant_id: preselectedTenantId });
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear el usuario.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="flex h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {form.role !== "super_admin" && (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <select
                value={form.tenant_id}
                onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                className="flex h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Selecciona empresa —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (password.length < 8) { setError("Mínimo 8 caracteres."); return; }
    setSaving(true); setError(null);
    try {
      await adminUsersApi.resetPassword(userId, password);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onOpenChange(false); setPassword(""); }, 1500);
    } catch { setError("Error al cambiar la contraseña."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Contraseña actualizada.</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleReset()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosPageContent() {
  const searchParams = useSearchParams();
  const initialTenant = searchParams.get("tenant_id") ?? "";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTenant, setFilterTenant] = useState(initialTenant);
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        adminUsersApi.list(filterTenant || undefined),
        tenantsApi.list(),
      ]);
      setUsers(uRes.data);
      setTenants(tRes.data);
    } catch { /* silencioso */ }
    finally { setIsLoading(false); }
  }, [filterTenant]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggleActive = async (user: AdminUser) => {
    try {
      await adminUsersApi.update(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch { /* silencioso */ }
  };

  const selectedTenantName = filterTenant
    ? (tenants.find((t) => t.id === filterTenant)?.name ?? "")
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Usuarios</h1>
          <p className="text-sm text-klyp-gray mt-0.5">
            {selectedTenantName
              ? <>Usuarios de <span className="font-medium text-klyp-navy">{selectedTenantName}</span></>
              : "Gestión de todos los usuarios del sistema."}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />Nuevo usuario
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">Todas las empresas</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-klyp-gray">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay usuarios{selectedTenantName ? ` en ${selectedTenantName}` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`bg-white rounded-lg border p-4 flex items-center justify-between gap-4 shadow-sm ${!u.is_active ? "opacity-50" : "border-klyp-pale"}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-klyp-navy truncate">{u.full_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                <p className="text-xs text-klyp-gray truncate">{u.email} {u.tenant_name ? `· ${u.tenant_name}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setResetUserId(u.id)} title="Cambiar contraseña">
                  <Key className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void toggleActive(u)} title={u.is_active ? "Desactivar" : "Activar"}>
                  {u.is_active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        tenants={tenants}
        preselectedTenantId={filterTenant}
        onCreated={(u) => setUsers((prev) => [u, ...prev])}
      />
      {resetUserId && (
        <ResetPasswordDialog
          userId={resetUserId}
          open={true}
          onOpenChange={(v) => { if (!v) setResetUserId(null); }}
        />
      )}
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <Suspense fallback={<div className="space-y-3 p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-16 w-full rounded-lg bg-gray-100 animate-pulse" />)}</div>}>
      <UsuariosPageContent />
    </Suspense>
  );
}
