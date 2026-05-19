"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Pencil, PauseCircle, PlayCircle, Trash2,
  UserPlus, Users, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminUsersApi, type AdminUser, type TenantSummary } from "@/lib/superadminApi";

// ─── Barra de uso ─────────────────────────────────────────────────────────────

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-klyp-accent";
  const textColor = pct >= 100 ? "text-red-600 font-semibold" : "text-klyp-navy font-medium";
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-klyp-gray">{label}</span>
        <span className={textColor}>{used} / {max}</span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Formulario crear usuario ─────────────────────────────────────────────────

function CreateUserDialog({ tenantId, open, onOpenChange, onCreated }: {
  tenantId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (u: AdminUser) => void;
}) {
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "reception" as "company_admin" | "reception" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.password) { setError("Todos los campos son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await adminUsersApi.create({ ...form, tenant_id: tenantId });
      onCreated(res.data);
      setForm({ email: "", full_name: "", password: "", role: "reception" });
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear el usuario.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input {...f("full_name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" {...f("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña *</Label>
            <Input type="password" {...f("password")} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "company_admin" | "reception" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulario editar usuario ────────────────────────────────────────────────

function EditUserDialog({ user, open, onOpenChange, onUpdated }: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (u: AdminUser) => void;
}) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role as "company_admin" | "reception" });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.full_name) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const res = await adminUsersApi.update(user.id, { full_name: form.full_name, role: form.role });
      if (newPassword.trim()) {
        await adminUsersApi.resetPassword(user.id, newPassword.trim());
      }
      onUpdated(res.data);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al guardar.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-gray-50 text-klyp-gray" />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "company_admin" | "reception" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Nueva contraseña <span className="text-klyp-gray font-normal">(opcional)</span></Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Dejar en blanco para no cambiar" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog principal de usuarios por empresa ─────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  company_admin: "Admin Empresa",
  reception: "Gestión",
  super_admin: "Superadmin",
};

export function TenantUsersDialog({ tenant, open, onOpenChange }: {
  tenant: TenantSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminUsersApi.list(tenant.id);
      setUsers(res.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    if (open) void fetchUsers();
  }, [open, fetchUsers]);

  const adminCount = users.filter((u) => u.role === "company_admin" && u.is_active).length;
  const receptionCount = users.filter((u) => u.role === "reception" && u.is_active).length;

  const handleToggleSuspend = async (u: AdminUser) => {
    setActionPending(u.id);
    try {
      const res = await adminUsersApi.update(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => x.id === u.id ? res.data : x));
    } catch {
      // silencioso
    } finally {
      setActionPending(null);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    setActionPending(u.id);
    try {
      await adminUsersApi.deactivate(u.id);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: false } : x));
    } catch {
      // silencioso
    } finally {
      setActionPending(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-klyp-accent" />
              Usuarios — {tenant.name}
            </DialogTitle>
          </DialogHeader>

          {/* Barras de uso */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <UsageBar label="Admin Empresa" used={adminCount} max={tenant.max_company_admins} />
            <UsageBar label="Gestión / Recepción" used={receptionCount} max={tenant.max_reception_users} />
          </div>

          {/* Tabla de usuarios */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-klyp-gray">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Esta empresa no tiene usuarios aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-klyp-navy">{u.full_name}</td>
                      <td className="px-4 py-3 text-klyp-gray text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === "company_admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {u.is_active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar" onClick={() => setEditUser(u)}>
                            <Pencil className="h-4 w-4 text-klyp-gray" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0"
                            title={u.is_active ? "Suspender" : "Activar"}
                            disabled={actionPending === u.id}
                            onClick={() => void handleToggleSuspend(u)}
                          >
                            {actionPending === u.id
                              ? <Loader2 className="h-4 w-4 animate-spin text-klyp-gray" />
                              : u.is_active
                                ? <PauseCircle className="h-4 w-4 text-amber-500" />
                                : <PlayCircle className="h-4 w-4 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0" title="Eliminar"
                            disabled={actionPending === u.id}
                            onClick={() => setDeleteConfirm(u)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-klyp-gray">
                {users.length} usuario{users.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-klyp-accent hover:bg-klyp-accent/90 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />Nuevo Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <CreateUserDialog
        tenantId={tenant.id}
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(u) => { setUsers((prev) => [u, ...prev]); }}
      />

      {editUser && (
        <EditUserDialog
          user={editUser}
          open={true}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          onUpdated={(u) => { setUsers((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditUser(null); }}
        />
      )}

      {/* Confirmación de eliminar */}
      {deleteConfirm && (
        <Dialog open={true} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle>¿Eliminar usuario?</DialogTitle></DialogHeader>
            <p className="text-sm text-klyp-gray py-2">
              Se desactivará la cuenta de <strong>{deleteConfirm.full_name}</strong>. Podrá reactivarse más adelante.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={actionPending === deleteConfirm.id}
                onClick={() => void handleDelete(deleteConfirm)}
              >
                {actionPending === deleteConfirm.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
