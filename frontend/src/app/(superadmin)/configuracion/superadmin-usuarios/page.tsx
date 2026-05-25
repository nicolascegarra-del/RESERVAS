"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, Plus, Loader2, Key, Trash2, UserCheck, UserX, RefreshCw, MoreHorizontal, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { superAdminUsersApi, type AdminUser } from "@/lib/superadminApi";
import { useAuthStore } from "@/stores/authStore";

// ─── Crear usuario ─────────────────────────────────────────────────────────────

function CreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (u: AdminUser) => void;
}) {
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.password) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await superAdminUsersApi.create(form);
      onCreated(res.data);
      setForm({ email: "", full_name: "", password: "" });
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nuevo Super Admin</DialogTitle></DialogHeader>
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
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Super Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editar usuario ────────────────────────────────────────────────────────────

function EditDialog({ user, open, onOpenChange, onUpdated }: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (u: AdminUser) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFullName(user.full_name); }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) { setError("El nombre no puede estar vacío."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await superAdminUsersApi.update(user.id, { full_name: fullName });
      onUpdated(res.data);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Editar Super Admin</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
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

// ─── Reset contraseña ──────────────────────────────────────────────────────────

function ResetPasswordDialog({ userId, open, onOpenChange }: {
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (password.length < 8) { setError("Mínimo 8 caracteres."); return; }
    setSaving(true);
    setError(null);
    try {
      await superAdminUsersApi.resetPassword(userId, password);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onOpenChange(false); setPassword(""); }, 1500);
    } catch {
      setError("Error al cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
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

// ─── Confirmar eliminación ─────────────────────────────────────────────────────

function DeleteDialog({ user, open, onOpenChange, onDeleted }: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      await superAdminUsersApi.delete(user.id);
      onDeleted(user.id);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Eliminar Super Admin</DialogTitle></DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que quieres eliminar a <span className="font-semibold">{user.full_name}</span>?
            Esta acción no se puede deshacer.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function SuperAdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminUsersApi.list();
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleActive = async (u: AdminUser) => {
    try {
      const res = await superAdminUsersApi.update(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => x.id === u.id ? res.data : x));
    } catch { /* silencioso */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-klyp-accent" />
            Usuarios Super Admin
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestión de cuentas con acceso total al panel de administración.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Super Admin
          </Button>
        </div>
      </div>

      {/* Aviso de seguridad */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Zona de alta seguridad.</strong> Los usuarios Super Admin tienen acceso completo a todas las empresas y configuraciones del sistema. Gestiona estas cuentas con precaución.
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Creado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">Cargando…</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No hay usuarios Super Admin.
                  </td>
                </tr>
              )}
              {!loading && users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? "opacity-55" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{u.full_name}</span>
                        {isSelf && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Tú</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setEditUser(u)} className="cursor-pointer">
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar nombre
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetUserId(u.id)} className="cursor-pointer">
                              <Key className="h-4 w-4 mr-2" />
                              Cambiar contraseña
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void toggleActive(u)} className="cursor-pointer">
                              {u.is_active
                                ? <><UserX className="h-4 w-4 mr-2 text-orange-500" />Desactivar</>
                                : <><UserCheck className="h-4 w-4 mr-2 text-green-600" />Activar</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteUser(u)}
                              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(u) => setUsers((p) => [...p, u])} />

      {editUser && (
        <EditDialog
          user={editUser}
          open={true}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          onUpdated={(u) => { setUsers((p) => p.map((x) => x.id === u.id ? u : x)); setEditUser(null); }}
        />
      )}

      {resetUserId && (
        <ResetPasswordDialog
          userId={resetUserId}
          open={true}
          onOpenChange={(v) => { if (!v) setResetUserId(null); }}
        />
      )}

      {deleteUser && (
        <DeleteDialog
          user={deleteUser}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteUser(null); }}
          onDeleted={(id) => setUsers((p) => p.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}
