"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  Tag,
  Zap,
  DollarSign,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateUnitDialog } from "@/components/accommodations/CreateUnitDialog";
import { EditUnitDialog } from "@/components/accommodations/EditUnitDialog";
import { BulkCreateUnitsDialog } from "@/components/accommodations/BulkCreateUnitsDialog";
import { CreateFieldDialog } from "@/components/accommodations/CreateFieldDialog";
import { AccommodationCalendar } from "@/components/reservations/AccommodationCalendar";
import { CreateExtraDialog } from "@/components/accommodations/CreateExtraDialog";
import { EditTypeDialog } from "@/components/accommodations/EditTypeDialog";
import { PricingTab } from "@/components/pricing/PricingTab";
import { accommodationsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  FIELD_TYPE_LABELS,
  MULTIPLIER_TYPE_LABELS,
} from "@/types";
import type {
  AccommodationType,
  AccommodationTypeWithUnits,
  AccommodationUnit,
  FieldDefinition,
  Extra,
  AccommodationPhoto,
} from "@/types";

export default function AccommodationTypeDetailPage() {
  const params = useParams<{ typeId: string }>();
  const router = useRouter();
  const typeId = params.typeId;

  const [accommodationType, setAccommodationType] =
    useState<AccommodationTypeWithUnits | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [photos, setPhotos] = useState<AccommodationPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [isCreateUnitOpen, setIsCreateUnitOpen] = useState(false);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
  const [isCreateExtraOpen, setIsCreateExtraOpen] = useState(false);
  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<AccommodationUnit | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((state) => state.user);
  const canManage =
    user?.role === "company_admin" || user?.role === "super_admin";

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [typeResponse, fieldsResponse, extrasResponse, photosResponse] =
        await Promise.all([
          accommodationsApi.getType(typeId),
          accommodationsApi.listFields(typeId),
          accommodationsApi.listExtras(),
          accommodationsApi.listPhotos(typeId),
        ]);
      setAccommodationType(typeResponse.data);
      setFields(fieldsResponse.data);
      setExtras(extrasResponse.data);
      setPhotos(photosResponse.data);
    } catch {
      setLoadError("No se pudo cargar la información. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [typeId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTypeUpdated = (updated: AccommodationType) => {
    setAccommodationType((prev) =>
      prev ? { ...prev, ...updated } : prev,
    );
  };

  const handleDeleteType = async () => {
    if (!accommodationType) return;
    if (!confirm(`¿Eliminar el tipo "${accommodationType.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await accommodationsApi.deleteType(accommodationType.id);
      router.push("/alojamientos");
    } catch {
      // silencioso
    }
  };

  const handleUnitCreated = (newUnit: AccommodationUnit) => {
    setAccommodationType((prev) =>
      prev ? { ...prev, units: [...prev.units, newUnit] } : prev,
    );
  };

  const handleUnitUpdated = (updated: AccommodationUnit) => {
    setAccommodationType((prev) =>
      prev
        ? { ...prev, units: prev.units.map((u) => (u.id === updated.id ? updated : u)) }
        : prev,
    );
  };

  const handleBulkUnitsCreated = (newUnits: AccommodationUnit[]) => {
    setAccommodationType((prev) =>
      prev ? { ...prev, units: [...prev.units, ...newUnits] } : prev,
    );
  };

  const handleFieldCreated = (newField: FieldDefinition) => {
    setFields((prev) => [...prev, newField]);
  };

  const handleExtraCreated = (newExtra: Extra) => {
    setExtras((prev) => [...prev, newExtra]);
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("¿Desactivar esta unidad?")) return;
    try {
      await accommodationsApi.deleteUnit(unitId);
      setAccommodationType((prev) =>
        prev
          ? {
              ...prev,
              units: prev.units.filter((u) => u.id !== unitId),
            }
          : prev,
      );
    } catch {
      // Error silenciado intencionalmente — el usuario puede reintentar
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("¿Eliminar este campo personalizado? Esta acción no se puede deshacer.")) return;
    try {
      await accommodationsApi.deleteField(fieldId);
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch {
      // Error silenciado intencionalmente — el usuario puede reintentar
    }
  };

  const handleDeleteExtra = async (extraId: string) => {
    if (!confirm("¿Desactivar este extra?")) return;
    try {
      await accommodationsApi.deleteExtra(extraId);
      setExtras((prev) => prev.filter((e) => e.id !== extraId));
    } catch {
      // Error silenciado intencionalmente — el usuario puede reintentar
    }
  };

  const handleUploadPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const response = await accommodationsApi.uploadPhoto(typeId, file);
      setPhotos((prev) => [...prev, response.data]);
    } catch {
      // Error silenciado — el usuario puede reintentar
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await accommodationsApi.deletePhoto(typeId, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      // Error silenciado — el usuario puede reintentar
    }
  };

  // Estado de carga
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // Error de carga
  if (loadError || !accommodationType) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-600">{loadError ?? "Tipo no encontrado."}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Volver
          </Button>
          <Button onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb y acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="min-h-[44px] self-start"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditTypeOpen(true)}
              className="min-h-[44px]"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar tipo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDeleteType()}
              className="min-h-[44px] text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar tipo
            </Button>
          </div>
        )}
      </div>

      {/* Info del tipo */}
      <div className="rounded-lg border border-klyp-pale bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-klyp-pale">
            <Building2 className="h-6 w-6 text-klyp-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-klyp-navy">
                {accommodationType.name}
              </h1>
              {!accommodationType.is_active && (
                <Badge className="bg-amber-100 text-amber-800">Inactivo</Badge>
              )}
            </div>
            {accommodationType.description && (
              <p className="mt-1 text-sm text-klyp-gray">
                {accommodationType.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-wrap gap-6 border-t border-klyp-pale pt-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-klyp-gray" />
            <span className="text-klyp-gray">
              <span className="font-semibold text-klyp-navy">
                {accommodationType.units.length}
              </span>{" "}
              unidades
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4 text-klyp-gray" />
            <span className="text-klyp-gray">
              <span className="font-semibold text-klyp-navy">{fields.length}</span>{" "}
              campos personalizados
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-klyp-gray" />
            <span className="text-klyp-gray">
              <span className="font-semibold text-klyp-navy">{extras.length}</span>{" "}
              extras disponibles
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-klyp-gray" />
            <span className="text-klyp-gray">
              IVA:{" "}
              <span className="font-semibold text-klyp-navy">
                {accommodationType.iva_rate}%
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="units">
        <TabsList className="flex-wrap h-auto gap-1 sm:w-auto">
          <TabsTrigger value="units">
            Unidades ({accommodationType.units.length})
          </TabsTrigger>
          <TabsTrigger value="fields">
            Campos ({fields.length})
          </TabsTrigger>
          <TabsTrigger value="extras">
            Extras ({extras.length})
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <DollarSign className="mr-1 h-3.5 w-3.5" />
            Precios
          </TabsTrigger>
          <TabsTrigger value="photos">
            <ImageIcon className="mr-1 h-3.5 w-3.5" />
            Fotos ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="ocupacion">
            Ocupación
          </TabsTrigger>
        </TabsList>

        {/* Tab: Unidades */}
        <TabsContent value="units">
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsBulkCreateOpen(true)}
                  className="min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear en lote
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsCreateUnitOpen(true)}
                  className="min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Unidad
                </Button>
              </div>
            )}

            {accommodationType.units.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-12 text-center">
                <Users className="h-8 w-8 text-klyp-pale" />
                <p className="mt-3 text-sm font-medium text-klyp-navy">Sin unidades</p>
                <p className="text-xs text-klyp-gray mt-1">
                  Añade la primera unidad a este tipo.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Capacidad</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      {canManage && <TableHead className="w-24">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accommodationType.units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium text-klyp-navy">
                          {unit.name}
                        </TableCell>
                        <TableCell>{unit.capacity} pers.</TableCell>
                        <TableCell className="text-klyp-gray max-w-xs truncate">
                          {unit.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              unit.is_active
                                ? "text-green-600 text-xs font-medium"
                                : "text-amber-600 text-xs font-medium"
                            }
                          >
                            {unit.is_active ? "Activa" : "Inactiva"}
                          </span>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-klyp-gray hover:text-klyp-accent"
                                onClick={() => setUnitToEdit(unit)}
                                aria-label={`Editar ${unit.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-klyp-gray hover:text-red-600"
                                onClick={() => void handleDeleteUnit(unit.id)}
                                aria-label={`Desactivar ${unit.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Campos personalizados */}
        <TabsContent value="fields">
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsCreateFieldOpen(true)}
                  className="min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Campo
                </Button>
              </div>
            )}

            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-12 text-center">
                <Tag className="h-8 w-8 text-klyp-pale" />
                <p className="mt-3 text-sm font-medium text-klyp-navy">Sin campos personalizados</p>
                <p className="text-xs text-klyp-gray mt-1">
                  Define campos adicionales para las unidades de este tipo.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clave</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Opciones</TableHead>
                      <TableHead>Obligatorio</TableHead>
                      <TableHead>Orden</TableHead>
                      {canManage && <TableHead className="w-24">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <code className="rounded bg-klyp-pale px-1.5 py-0.5 text-xs font-mono text-klyp-navy">
                            {field.field_key}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium text-klyp-navy">
                          {field.field_label}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-klyp-pale text-klyp-text-dark text-xs">
                            {FIELD_TYPE_LABELS[field.field_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-klyp-gray text-sm">
                          {field.options ? field.options.join(", ") : "—"}
                        </TableCell>
                        <TableCell>
                          {field.is_required ? (
                            <span className="text-xs text-klyp-accent font-medium">Sí</span>
                          ) : (
                            <span className="text-xs text-klyp-gray">No</span>
                          )}
                        </TableCell>
                        <TableCell>{field.sort_order}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-klyp-gray hover:text-red-600"
                              onClick={() => void handleDeleteField(field.id)}
                              aria-label={`Eliminar campo ${field.field_label}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Extras */}
        <TabsContent value="extras">
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsCreateExtraOpen(true)}
                  className="min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Extra
                </Button>
              </div>
            )}

            {extras.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-12 text-center">
                <Zap className="h-8 w-8 text-klyp-pale" />
                <p className="mt-3 text-sm font-medium text-klyp-navy">Sin extras</p>
                <p className="text-xs text-klyp-gray mt-1">
                  Añade servicios adicionales disponibles para las reservas.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-klyp-pale bg-white shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Multiplicador</TableHead>
                      <TableHead>IVA</TableHead>
                      <TableHead>Estado</TableHead>
                      {canManage && <TableHead className="w-24">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extras.map((extra) => (
                      <TableRow key={extra.id}>
                        <TableCell>
                          <p className="font-medium text-klyp-navy">{extra.name}</p>
                          {extra.description && (
                            <p className="text-xs text-klyp-gray truncate max-w-[160px]">
                              {extra.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-klyp-navy text-sm font-medium">
                          {Number(extra.price).toFixed(2)} €
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-klyp-gray">
                            {MULTIPLIER_TYPE_LABELS[extra.multiplier_type]}
                            {extra.multiplier_type === "per_custom" &&
                              extra.multiplier_label && (
                                <span className="ml-1 text-klyp-navy">
                                  ({extra.multiplier_label})
                                </span>
                              )}
                          </span>
                        </TableCell>
                        <TableCell className="text-klyp-navy text-sm">
                          {extra.iva_rate}%
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              extra.is_active
                                ? "text-green-600 text-xs font-medium"
                                : "text-amber-600 text-xs font-medium"
                            }
                          >
                            {extra.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-klyp-gray hover:text-red-600"
                                onClick={() => void handleDeleteExtra(extra.id)}
                                aria-label={`Desactivar ${extra.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Precios */}
        <TabsContent value="pricing">
          <PricingTab
            typeId={typeId}
            extras={extras}
            canManage={canManage}
          />
        </TabsContent>

        {/* Tab: Fotos */}
        <TabsContent value="photos">
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => void handleUploadPhoto(e)}
                />
                <Button
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="min-h-[44px]"
                >
                  {isUploadingPhoto ? (
                    <>
                      <Upload className="mr-2 h-4 w-4 animate-pulse" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Foto
                    </>
                  )}
                </Button>
              </div>
            )}

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-klyp-pale bg-white py-12 text-center">
                <ImageIcon className="h-8 w-8 text-klyp-pale" />
                <p className="mt-3 text-sm font-medium text-klyp-navy">Sin fotos</p>
                <p className="text-xs text-klyp-gray mt-1">
                  Sube imágenes del alojamiento (JPEG, PNG, WebP — máx. 10 MB).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-lg border border-klyp-pale bg-white shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.file_url}
                      alt={photo.caption ?? "Foto del alojamiento"}
                      className="h-40 w-full object-cover"
                    />
                    {photo.caption && (
                      <p className="px-2 py-1.5 text-xs text-klyp-gray truncate">
                        {photo.caption}
                      </p>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void handleDeletePhoto(photo.id)}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-klyp-gray opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-red-600"
                        aria-label="Eliminar foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Ocupación */}
        <TabsContent value="ocupacion">
          <AccommodationCalendar accommodationTypeId={typeId} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {accommodationType && (
        <EditTypeDialog
          open={isEditTypeOpen}
          onOpenChange={setIsEditTypeOpen}
          accommodationType={accommodationType}
          onSuccess={handleTypeUpdated}
        />
      )}
      {unitToEdit && (
        <EditUnitDialog
          open={!!unitToEdit}
          onOpenChange={(open) => { if (!open) setUnitToEdit(null); }}
          unit={unitToEdit}
          onSuccess={handleUnitUpdated}
        />
      )}
      <CreateUnitDialog
        open={isCreateUnitOpen}
        onOpenChange={setIsCreateUnitOpen}
        typeId={typeId}
        onSuccess={handleUnitCreated}
      />
      <BulkCreateUnitsDialog
        open={isBulkCreateOpen}
        onOpenChange={setIsBulkCreateOpen}
        typeId={typeId}
        onSuccess={handleBulkUnitsCreated}
      />
      <CreateFieldDialog
        open={isCreateFieldOpen}
        onOpenChange={setIsCreateFieldOpen}
        typeId={typeId}
        onSuccess={handleFieldCreated}
      />
      <CreateExtraDialog
        open={isCreateExtraOpen}
        onOpenChange={setIsCreateExtraOpen}
        onSuccess={handleExtraCreated}
      />
    </div>
  );
}
