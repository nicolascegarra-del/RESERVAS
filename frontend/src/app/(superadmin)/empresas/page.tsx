"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, Users, Building2, Loader2,
  PauseCircle, PlayCircle, ChevronUp, ChevronDown, SlidersHorizontal,
  Upload, AlertTriangle,
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
import { tenantsApi, type TenantSummary, type TenantCreatePayload } from "@/lib/superadminApi";
import { useRouter } from "next/navigation";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

// ─── Formulario compartido ────────────────────────────────────────────────────

type TenantFormData = {
  name: string; slug: string; legal_name: string; cif: string; address: string;
  postal_code: string; municipality: string; province: string;
  contact_email: string; contact_phone: string; bank_account: string;
  max_company_admins: number; max_reception_users: number;
};

const emptyForm = (): TenantFormData => ({
  name: "", slug: "", legal_name: "", cif: "", address: "",
  postal_code: "", municipality: "", province: "",
  contact_email: "", contact_phone: "", bank_account: "",
  max_company_admins: 5, max_reception_users: 20,
});

function TenantFormFields({ form, setForm }: {
  form: TenantFormData;
  setForm: React.Dispatch<React.SetStateAction<TenantFormData>>;
}) {
  const field = (key: keyof TenantFormData) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: key.startsWith("max_") ? Number(e.target.value) : e.target.value })),
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Datos básicos</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Nombre comercial *</Label>
            <Input {...field("name")} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Slug (URL único) *</Label>
            <Input {...field("slug")} placeholder="mi-empresa" />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Datos fiscales</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Razón social</Label>
            <Input {...field("legal_name")} />
          </div>
          <div className="space-y-1.5">
            <Label>CIF / NIF</Label>
            <Input {...field("cif")} />
          </div>
          <div className="space-y-1.5">
            <Label>Cuenta bancaria</Label>
            <Input {...field("bank_account")} placeholder="ES00 0000..." />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Domicilio fiscal</Label>
            <Input {...field("address")} />
          </div>
          <div className="space-y-1.5">
            <Label>Código postal</Label>
            <Input {...field("postal_code")} />
          </div>
          <div className="space-y-1.5">
            <Label>Municipio</Label>
            <Input {...field("municipality")} />
          </div>
          <div className="space-y-1.5">
            <Label>Provincia</Label>
            <Input {...field("province")} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Contacto</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Email de contacto</Label>
            <Input type="email" {...field("contact_email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input {...field("contact_phone")} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Límites de usuarios</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Máx. Admin Empresa</Label>
            <Input type="number" min={1} max={100} {...field("max_company_admins")} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. Gestión</Label>
            <Input type="number" min={1} max={500} {...field("max_reception_users")} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dialogo Crear ────────────────────────────────────────────────────────────

function CreateTenantDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (t: TenantSummary) => void;
}) {
  const [form, setForm] = useState<TenantFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.name || !form.slug) { setError("Nombre y slug son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const payload: TenantCreatePayload = {
        ...form,
        legal_name: form.legal_name || null,
        cif: form.cif || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        municipality: form.municipality || null,
        province: form.province || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        bank_account: form.bank_account || null,
      };
      const res = await tenantsApi.create(payload);
      onCreated(res.data);
      setForm(emptyForm());
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al crear la empresa.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva Empresa</DialogTitle></DialogHeader>
        <div className="py-2"><TenantFormFields form={form} setForm={setForm} /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleCreate()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogo Editar ───────────────────────────────────────────────────────────

function EditTenantDialog({ tenant, open, onOpenChange, onUpdated }: {
  tenant: TenantSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (t: TenantSummary) => void;
}) {
  const [form, setForm] = useState<TenantFormData>({
    name: tenant.name,
    slug: tenant.slug,
    legal_name: tenant.legal_name ?? "",
    cif: tenant.cif ?? "",
    address: tenant.address ?? "",
    postal_code: tenant.postal_code ?? "",
    municipality: tenant.municipality ?? "",
    province: tenant.province ?? "",
    contact_email: tenant.contact_email ?? "",
    contact_phone: tenant.contact_phone ?? "",
    bank_account: tenant.bank_account ?? "",
    max_company_admins: tenant.max_company_admins,
    max_reception_users: tenant.max_reception_users,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    tenant.logo_url ? `${API_URL}${tenant.logo_url}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await tenantsApi.uploadLogo(tenant.id, file);
      onUpdated(res.data);
      setLogoPreview(res.data.logo_url ? `${API_URL}${res.data.logo_url}` : null);
    } catch {
      setError("Error al subir el logo.");
    } finally { setUploadingLogo(false); }
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) { setError("Nombre y slug son obligatorios."); return; }
    setSaving(true); setError(null);
    try {
      const res = await tenantsApi.update(tenant.id, {
        ...form,
        legal_name: form.legal_name || null,
        cif: form.cif || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        municipality: form.municipality || null,
        province: form.province || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        bank_account: form.bank_account || null,
      });
      onUpdated(res.data);
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al guardar los cambios.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
        <div className="py-2 space-y-5">
          <div>
            <p className="text-xs font-semibold text-klyp-gray uppercase tracking-wide mb-3">Logotipo</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  : <Building2 className="h-6 w-6 text-gray-300" />}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => void handleLogoChange(e)}
                />
                <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploadingLogo ? "Subiendo..." : "Subir logo"}
                </Button>
                <p className="text-xs text-klyp-gray mt-1">PNG, JPEG, WebP o SVG</p>
              </div>
            </div>
          </div>
          <TenantFormFields form={form} setForm={setForm} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogo Eliminar ─────────────────────────────────────────────────────────

function DeleteTenantDialog({ tenant, open, onOpenChange, onDeleted }: {
  tenant: TenantSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!password) { setError("Introduce tu contraseña."); return; }
    setSaving(true); setError(null);
    try {
      await tenantsApi.hardDelete(tenant.id, password);
      onDeleted();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { error?: { message?: string } } } } };
      setError(err.response?.data?.detail?.error?.message ?? "Error al eliminar la empresa.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPassword(""); setError(null); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Eliminar empresa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Acción irreversible</p>
              <p className="text-xs text-red-700 mt-1">
                Se eliminarán <strong>todos</strong> los datos de <strong>{tenant.name}</strong>:
                reservas, alojamientos, usuarios y configuración.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tu contraseña de superadmin</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleDelete(); }}
              placeholder="Contraseña"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleDelete()} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tipos de columnas ────────────────────────────────────────────────────────

type ColKey = "logo" | "nombre" | "cif" | "municipio" | "estado" | "stripe" | "smtp" | "creada";
type SortKey = "nombre" | "municipio" | "creada";
type SortDir = "asc" | "desc";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "logo", label: "Logo" },
  { key: "nombre", label: "Nombre" },
  { key: "cif", label: "CIF" },
  { key: "municipio", label: "Municipio" },
  { key: "estado", label: "Estado" },
  { key: "stripe", label: "Stripe" },
  { key: "smtp", label: "SMTP" },
  { key: "creada", label: "Creada" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EmpresasPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<TenantSummary | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<"all" | "active" | "suspended">("all");

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLS.map((c) => c.key)));
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tenantsApi.list();
      setTenants(res.data);
    } catch { /* silencioso */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetchTenants(); }, [fetchTenants]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSuspend = async (t: TenantSummary) => {
    setSuspending(t.id);
    try {
      const res = await tenantsApi.suspend(t.id);
      setTenants((prev) => prev.map((x) => x.id === t.id ? res.data : x));
    } catch { /* silencioso */ }
    finally { setSuspending(null); }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = tenants
    .filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.cif ?? "").toLowerCase().includes(q) && !(t.municipality ?? "").toLowerCase().includes(q)) return false;
      }
      if (filterState === "active" && !t.is_active) return false;
      if (filterState === "suspended" && t.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "nombre") { av = a.name; bv = b.name; }
      else if (sortKey === "municipio") { av = a.municipality ?? ""; bv = b.municipality ?? ""; }
      else if (sortKey === "creada") { av = a.created_at; bv = b.created_at; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const col = (k: ColKey) => visibleCols.has(k);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />)
      : <ChevronUp className="h-3 w-3 ml-1 inline opacity-20" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-klyp-navy">Empresas</h1>
          <p className="text-sm text-klyp-gray mt-0.5">Gestión de todos los clientes del sistema.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-klyp-accent hover:bg-klyp-accent/90 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />Nueva Empresa
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar por nombre, CIF o municipio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-[44px] max-w-xs"
        />
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value as "all" | "active" | "suspended")}
          className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="suspended">Suspendidas</option>
        </select>
        <div className="relative ml-auto" ref={colMenuRef}>
          <Button variant="outline" size="sm" className="h-[44px] gap-2" onClick={() => setShowColMenu((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />Columnas
          </Button>
          {showColMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => setVisibleCols((prev) => {
                      const next = new Set(prev);
                      next.has(c.key) ? next.delete(c.key) : next.add(c.key);
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
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-klyp-gray">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No hay empresas{search ? " que coincidan con la búsqueda" : ""}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {col("logo") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray w-14">Logo</th>}
                {col("nombre") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("nombre")}>
                    Nombre<SortIcon k="nombre" />
                  </th>
                )}
                {col("cif") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">CIF</th>}
                {col("municipio") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("municipio")}>
                    Municipio<SortIcon k="municipio" />
                  </th>
                )}
                {col("estado") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Estado</th>}
                {col("stripe") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">Stripe</th>}
                {col("smtp") && <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray">SMTP</th>}
                {col("creada") && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-klyp-gray cursor-pointer select-none" onClick={() => handleSort("creada")}>
                    Creada<SortIcon k="creada" />
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-klyp-gray">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.is_active ? "opacity-55" : ""}`}>
                  {col("logo") && (
                    <td className="px-4 py-3">
                      <div className="h-9 w-9 rounded-md border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {t.logo_url
                          ? <img src={`${API_URL}${t.logo_url}`} alt={t.name} className="h-full w-full object-contain" />
                          : <Building2 className="h-4 w-4 text-gray-300" />}
                      </div>
                    </td>
                  )}
                  {col("nombre") && (
                    <td className="px-4 py-3">
                      <p className="font-medium text-klyp-navy">{t.name}</p>
                      <p className="text-xs text-klyp-gray">{t.slug}</p>
                    </td>
                  )}
                  {col("cif") && <td className="px-4 py-3 text-klyp-gray">{t.cif ?? "—"}</td>}
                  {col("municipio") && <td className="px-4 py-3 text-klyp-gray">{t.municipality ?? "—"}</td>}
                  {col("estado") && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {t.is_active ? "Activa" : "Suspendida"}
                      </span>
                    </td>
                  )}
                  {col("stripe") && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.stripe_enabled ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.stripe_enabled ? "Activo" : "No"}
                      </span>
                    </td>
                  )}
                  {col("smtp") && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.smtp_enabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.smtp_enabled ? "Activo" : "No"}
                      </span>
                    </td>
                  )}
                  {col("creada") && (
                    <td className="px-4 py-3 text-klyp-gray text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("es-ES")}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver usuarios" onClick={() => router.push(`/usuarios?tenant_id=${t.id}`)}>
                        <Users className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar empresa" onClick={() => setEditTenant(t)}>
                        <Pencil className="h-4 w-4 text-klyp-gray" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0"
                        title={t.is_active ? "Suspender empresa" : "Activar empresa"}
                        disabled={suspending === t.id}
                        onClick={() => void handleSuspend(t)}
                      >
                        {suspending === t.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-klyp-gray" />
                          : t.is_active
                            ? <PauseCircle className="h-4 w-4 text-amber-500" />
                            : <PlayCircle className="h-4 w-4 text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Eliminar empresa" onClick={() => setDeleteTenant(t)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-klyp-gray">
            {filtered.length} de {tenants.length} empresa{tenants.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <CreateTenantDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(t) => setTenants((prev) => [t, ...prev])}
      />
      {editTenant && (
        <EditTenantDialog
          tenant={editTenant}
          open={true}
          onOpenChange={(v) => { if (!v) setEditTenant(null); }}
          onUpdated={(t) => {
            setTenants((prev) => prev.map((x) => x.id === t.id ? t : x));
            setEditTenant(t);
          }}
        />
      )}
      {deleteTenant && (
        <DeleteTenantDialog
          tenant={deleteTenant}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteTenant(null); }}
          onDeleted={() => {
            setTenants((prev) => prev.filter((x) => x.id !== deleteTenant.id));
            setDeleteTenant(null);
          }}
        />
      )}
    </div>
  );
}
