"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Loader2, Key, UserX, UserCheck, Users,
  ChevronUp, ChevronDown, SlidersHorizontal,
} from "lucide-react";
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

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Admin Empresa",
  reception: "Gestión",
};

const ROLE_COLORS: Record<string, string> = {
  company_admin: "bg-blue-100 text-blue-700",
  reception: "bg-green-100 text-green-700",
};

// ─── Crear usuario ────────────────────────────────────────────────────────────

function CreateUserDialog({ open, onOpenChange, tenants, preselectedTenantId, onCreated }: {
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

  useEffect(() => { setForm((prev) => ({ ...prev, tenant_id: preselectedTenantId })); }, [preselectedTenantId]);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.password) { setError("Todos los campos son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await adminUsersApi.create({
        ...form,
        tenant_id: form.tenant_id || null,
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
        <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
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
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="flex h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="reception">Gestión</option>
              <option value="company_admin">Admin Empresa</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
              className="flex h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— Selecciona empresa —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

// ─── Reset contraseña ─────────────────────────────────────────────────────────

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
        <DialogHeader><DialogTitle>Cambiar Contraseña</DialogTitle></DialogHeader>
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar Contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tipos de columnas ────────────────────────────────────────────────────────

type ColKey = "nombre" | "email" | "rol" | "empresa" | "estado" | "creado";
type SortKey = "nombre" | "email" | "rol" | "empresa" | "creado";
type SortDir = "asc" | "desc";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: "rol", label: "Rol" },
  { key: "empresa", label: "Empresa" },
  { key: "estado", label: "Estado" },
  { key: "creado", label: "Creado" },
];

// ─── Contenido de la página ───────────────────────────────────────────────────

function UsuariosPageContent() {
  const searchParams = useSearchParams();
  const initialTenant = searchParams.get("tenant_id") ?? "";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTenant, setFilterTenant] = useState(initialTenant);
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterState, setFilterState] = useState<"all" | "active" | "inactive">("all");

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLS.map((c) => c.key)));
  const [showColMenu, setShowColMenu] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const selectedTenantName = filterTenant ? (tenants.find((t) => t.id === filterTenant)?.name ?? "") : "";

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = users
    .filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterState === "active" && !u.is_active) return false;
      if (filterState === "inactive" && u.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "nombre") { av = a.full_name; bv = b.full_name; }
      else if (sortKey === "email") { av = a.email; bv = b.email; }
      else if (sortKey === "rol") { av = a.role; bv = b.role; }
      else if (sortKey === "empresa") { av = a.tenant_name ?? ""; bv = b.tenant_name ?? ""; }
      else if (sortKey === "creado") { av = a.created_at; bv = b.created_at; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const col = (k: ColKey) => visibleCols.has(k);
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />)
      : <ChevronUp className="h-3 w-3 ml-1 inline opacity-20" />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-klyp-navy">Usuarios</h1>
          <p className="text-sm text-klyp-gray mt-0.5">
            {selectedTenantName
              ? <>Usuarios de <span className="font-medium text-klyp-navy">{selectedTenantName}</span></>
              : "Gestión de todos los usuarios del sistema."}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px] shrink-0">
          <Plus className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nuevo Usuario</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-[44px] w-full sm:max-w-xs"
        />
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:min-w-[180px] sm:w-auto"
        >
          <option value="">Todas las empresas</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Todos los roles</option>
          <option value="company_admin">Admin Empresa</option>
          <option value="reception">Gestión</option>
        </select>
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value as "all" | "active" | "inactive")}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>

        <div className="relative ml-auto">
          <Button variant="outline" size="sm" className="h-[44px] gap-2" onClick={() => setShowColMenu((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Columnas
          </Button>
          {showColMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => setVisibleCols((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.key)) { next.delete(c.key); } else { next.add(c.key); }
                      return next;
                    })}
                    className="rounded"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-klyp-gray">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay usuarios{search ? " que coincidan con la búsqueda" : ""}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {col("nombre") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("nombre")}>
                    Nombre<SortIcon k="nombre" />
                  </th>
                )}
                {col("email") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("email")}>
                    Email<SortIcon k="email" />
                  </th>
                )}
                {col("rol") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("rol")}>
                    Rol<SortIcon k="rol" />
                  </th>
                )}
                {col("empresa") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("empresa")}>
                    Empresa<SortIcon k="empresa" />
                  </th>
                )}
                {col("estado") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>}
                {col("creado") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("creado")}>
                    Creado<SortIcon k="creado" />
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? "opacity-55" : ""}`}>
                  {col("nombre") && (
                    <td className="px-4 py-3 font-medium text-klyp-navy">{u.full_name}</td>
                  )}
                  {col("email") && (
                    <td className="px-4 py-3 text-klyp-gray text-xs">{u.email}</td>
                  )}
                  {col("rol") && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                  )}
                  {col("empresa") && (
                    <td className="px-4 py-3 text-klyp-gray text-xs">{u.tenant_name ?? "—"}</td>
                  )}
                  {col("estado") && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  )}
                  {col("creado") && (
                    <td className="px-4 py-3 text-klyp-gray text-xs whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("es-ES")}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setResetUserId(u.id)} title="Cambiar contraseña">
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void toggleActive(u)} title={u.is_active ? "Desactivar" : "Activar"}>
                        {u.is_active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-klyp-gray">
            {filtered.length} de {users.length} usuario{users.length !== 1 ? "s" : ""}
          </div>
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
    <Suspense fallback={<div className="space-y-3 p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-14 w-full rounded-lg bg-gray-100 animate-pulse" />)}</div>}>
      <UsuariosPageContent />
    </Suspense>
  );
}
