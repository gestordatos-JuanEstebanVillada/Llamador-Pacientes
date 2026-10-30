import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { Building, MapPin, Pencil, Plus, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

import { AdminAuditoria } from "../components/admin/AdminAuditoria";
import { AdminDashboard } from "../components/admin/AdminDashboard";
import { AdminSidebar, type AdminTab } from "../components/admin/AdminSidebar";
import { Modal } from "../components/admin/Modal";
import { ToggleSwitch } from "../components/admin/ToggleSwitch";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type {
  Consultorio,
  Medico,
  Pantalla,
  Sala,
  Sede,
  Usuario,
} from "../types";

export default function AdminPage() {
  const { token, rol, logout, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [pantallas, setPantallas] = useState<Pantalla[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [se, sa, co, pa, me, us] = await Promise.all([
        api.admin.listSedes(token),
        api.admin.listSalas(token),
        api.admin.listConsultorios(token),
        api.admin.listPantallas(token),
        api.admin.listMedicos(token),
        api.admin.listUsuarios(token),
      ]);
      setSedes(se as Sede[]);
      setSalas(sa as Sala[]);
      setConsultorios(co as Consultorio[]);
      setPantallas(pa as Pantalla[]);
      setMedicos(me as Medico[]);
      setUsuarios(us as Usuario[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    reload();
  }, [reload, token]);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }
  if (rol !== "ADMIN" && rol !== "GESTOR") {
    return <Navigate to="/medico/setup" replace />;
  }

  const isAdmin = rol === "ADMIN";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-800">
      <AdminSidebar activeTab={tab} onTabChange={setTab} onLogout={logout} />

      <main className="flex-1 h-full min-w-0 overflow-y-auto p-6 bg-slate-50">
        {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

        {tab === "dashboard" && token && (
          <AdminDashboard token={token} medicos={medicos} sedes={sedes} salas={salas} />
        )}

        {tab === "sedes" && (
          <CrudSedes token={token} sedes={sedes} onSaved={reload} canEditDelete={isAdmin} />
        )}
        {tab === "salas" && (
          <CrudSalas token={token} sedes={sedes} salas={salas} onSaved={reload} canEditDelete={isAdmin} />
        )}
        {tab === "consultorios" && (
          <CrudConsultorios
            token={token}
            sedes={sedes}
            salas={salas}
            consultorios={consultorios}
            onSaved={reload}
            canEditDelete={isAdmin}
          />
        )}
        {tab === "pantallas" && (
          <CrudPantallas token={token} pantallas={pantallas} onSaved={reload} canEditDelete={isAdmin} />
        )}
        {tab === "medicos" && (
          <CrudMedicos token={token} medicos={medicos} onSaved={reload} canEditDelete={isAdmin} />
        )}
        {tab === "usuarios" && (
          <CrudUsuarios
            token={token}
            medicos={medicos}
            usuarios={usuarios}
            onSaved={reload}
            canEditDelete={isAdmin}
            canCreateUser={isAdmin}
          />
        )}
        {tab === "auditoria" && token && <AdminAuditoria token={token} />}
      </main>
    </div>
  );
}

function CrudSection({
  title,
  description,
  onNew,
  newLabel,
  showNew = true,
  children,
}: {
  title: string;
  description?: string;
  onNew: () => void;
  newLabel: string;
  showNew?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {showNew && (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {newLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const DELETE_CONFIRM = "¿Estás seguro de que deseas eliminar este registro?";

function toastDeleteError(err: unknown) {
  const message =
    err instanceof Error && err.message
      ? err.message
      : "Error al intentar eliminar el registro";
  toast.error(message);
}

function EditRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
      Editar
    </button>
  );
}

function DeleteRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
      aria-label="Eliminar"
    >
      <Trash className="h-3.5 w-3.5" aria-hidden />
      Eliminar
    </button>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <EditRowButton onClick={onEdit} />
      <DeleteRowButton onClick={onDelete} />
    </div>
  );
}

function actionsHeader(canEditDelete: boolean) {
  return canEditDelete ? (["Acciones"] as const) : ([] as const);
}

function actionsCell(
  canEditDelete: boolean,
  key: string,
  onEdit: () => void,
  onDelete: () => void,
): ReactNode[] {
  return canEditDelete
    ? [<RowActions key={key} onEdit={onEdit} onDelete={() => void onDelete()} />]
    : [];
}

function groupSalasBySede(salas: Sala[], sedes: Sede[]) {
  return [...sedes]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((sede) => ({
      sede,
      salas: salas
        .filter((s) => s.sede_id === sede.id)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }))
    .filter((g) => g.salas.length > 0);
}

function groupConsultoriosBySedeAndSala(consultorios: Consultorio[]) {
  const bySede = consultorios.reduce<Record<string, Consultorio[]>>((acc, c) => {
    const key = String(c.sede_id ?? c.sede_nombre ?? "sin-sede");
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

  return Object.values(bySede)
    .map((items) => {
      const sedeName = items[0]?.sede_nombre ?? "Sin sede";
      const bySala = items.reduce<Record<number, Consultorio[]>>((acc, c) => {
        (acc[c.sala_id] ??= []).push(c);
        return acc;
      }, {});
      const salas = Object.entries(bySala)
        .map(([salaId, list]) => ({
          salaId: Number(salaId),
          salaName: list[0]?.sala_nombre ?? `Sala ${salaId}`,
          consultorios: [...list].sort((a, b) => a.numero.localeCompare(b.numero, "es")),
        }))
        .sort((a, b) => a.salaName.localeCompare(b.salaName, "es"));
      return { sedeName, salas };
    })
    .sort((a, b) => a.sedeName.localeCompare(b.sedeName, "es"));
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-sm text-slate-700 space-y-1">{children}</label>;
}

function inputClass() {
  return "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none";
}

function CrudSedes({
  token,
  sedes,
  onSaved,
  canEditDelete,
}: {
  token: string;
  sedes: Sede[];
  onSaved: () => void | Promise<void>;
  canEditDelete: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [edit, setEdit] = useState<Sede | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setNombre("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createSede(token, { nombre, activo: true });
      setNombre("");
      setCreateOpen(false);
      toast.success("Sede creada correctamente");
      onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (s: Sede) => {
    setEdit(s);
    setEditNombre(s.nombre);
    setEditActivo(s.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.admin.updateSede(token, edit.id, { nombre: editNombre, activo: editActivo });
      setEdit(null);
      toast.success("Sede actualizada correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deleteSede(token, id);
      toast.success("Sede eliminada");
      await onSaved();
    } catch (err) {
      toastDeleteError(err);
    }
  };

  return (
    <CrudSection title="Sedes" description="Administre las sedes de la institución." onNew={openCreate} newLabel="Nueva sede">
      <EntityTable
        headers={["ID", "Nombre", "Activo", ...actionsHeader(canEditDelete)]}
        rows={sedes.map((s) => [
          s.id,
          s.nombre,
          s.activo ? "Sí" : "No",
          ...actionsCell(canEditDelete, `actions-${s.id}`, () => openEdit(s), () => onDelete(s.id)),
        ])}
      />
      <Modal
        open={createOpen}
        title="Nueva sede"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Nombre
          <input
            className={inputClass()}
            placeholder="Nombre de la sede"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </FieldLabel>
      </Modal>
      <Modal
        open={!!edit}
        title="Editar sede"
        onClose={() => setEdit(null)}
        onSubmit={onUpdate}
        saving={saving}
      >
        <FieldLabel>
          Nombre
          <input
            className={inputClass()}
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            required
          />
        </FieldLabel>
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

function CrudSalas({
  token,
  sedes,
  salas,
  onSaved,
  canEditDelete,
}: {
  token: string;
  sedes: Sede[];
  salas: Sala[];
  onSaved: () => void;
  canEditDelete: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [sedeId, setSedeId] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [edit, setEdit] = useState<Sala | null>(null);
  const [editSedeId, setEditSedeId] = useState<number | "">("");
  const [editNombre, setEditNombre] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setSedeId("");
    setNombre("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (sedeId === "") return;
    try {
      await api.admin.createSala(token, { sede_id: sedeId, nombre, activo: true });
      setNombre("");
      setCreateOpen(false);
      toast.success("Sala creada correctamente");
      onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (s: Sala) => {
    setEdit(s);
    setEditSedeId(s.sede_id);
    setEditNombre(s.nombre);
    setEditActivo(s.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || editSedeId === "") return;
    setSaving(true);
    try {
      await api.admin.updateSala(token, edit.id, {
        sede_id: Number(editSedeId),
        nombre: editNombre,
        activo: editActivo,
      });
      setEdit(null);
      toast.success("Sala actualizada correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deleteSala(token, id);
      toast.success("Sala eliminada");
      await onSaved();
    } catch (err) {
      toastDeleteError(err);
    }
  };

  const salasGrouped = groupSalasBySede(salas, sedes);

  return (
    <CrudSection title="Salas" description="Salas de atención asociadas a cada sede." onNew={openCreate} newLabel="Nueva sala">
      {salasGrouped.length === 0 ? (
        <p className="text-sm text-slate-500">No hay salas registradas.</p>
      ) : (
        <div className="space-y-8">
          {salasGrouped.map(({ sede, salas: groupSalas }) => (
            <section key={sede.id}>
              <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-slate-800">
                <Building className="mr-2 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
                {sede.nombre}
              </h3>
              <EntityTable
                headers={["ID", "Nombre", "Activo", ...actionsHeader(canEditDelete)]}
                rows={groupSalas.map((s) => [
                  s.id,
                  s.nombre,
                  s.activo ? "Sí" : "No",
                  ...actionsCell(canEditDelete, `actions-${s.id}`, () => openEdit(s), () => onDelete(s.id)),
                ])}
              />
            </section>
          ))}
        </div>
      )}
      <Modal
        open={createOpen}
        title="Nueva sala"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Sede
          <select
            className={inputClass()}
            value={sedeId}
            onChange={(e) => setSedeId(Number(e.target.value))}
            required
          >
            <option value="">Sede...</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Nombre
          <input
            className={inputClass()}
            placeholder="Nombre de la sala"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </FieldLabel>
      </Modal>
      <Modal open={!!edit} title="Editar sala" onClose={() => setEdit(null)} onSubmit={onUpdate} saving={saving}>
        <FieldLabel>
          Sede
          <select
            className={inputClass()}
            value={editSedeId}
            onChange={(e) => setEditSedeId(Number(e.target.value))}
            required
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Nombre
          <input className={inputClass()} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required />
        </FieldLabel>
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

function CrudConsultorios({
  token,
  sedes,
  salas,
  consultorios,
  onSaved,
  canEditDelete,
}: {
  token: string;
  sedes: Sede[];
  salas: Sala[];
  consultorios: Consultorio[];
  onSaved: () => void;
  canEditDelete: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [sedeId, setSedeId] = useState<number | "">("");
  const [salaId, setSalaId] = useState<number | "">("");
  const [numero, setNumero] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [edit, setEdit] = useState<Consultorio | null>(null);
  const [editSedeId, setEditSedeId] = useState<number | "">("");
  const [editSalaId, setEditSalaId] = useState<number | "">("");
  const [editNumero, setEditNumero] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const salasForSede = (id: number | "") =>
    id === "" ? [] : salas.filter((s) => s.sede_id === id);

  const openCreate = () => {
    setSedeId("");
    setSalaId("");
    setNumero("");
    setDescripcion("");
    setCreateOpen(true);
  };

  const onCreateSedeChange = (next: number | "") => {
    setSedeId(next);
    setSalaId("");
  };

  const onEditSedeChange = (next: number | "") => {
    setEditSedeId(next);
    const allowed = salasForSede(next);
    if (editSalaId !== "" && !allowed.some((s) => s.id === editSalaId)) {
      setEditSalaId("");
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (salaId === "") return;
    try {
      await api.admin.createConsultorio(token, {
        sala_id: salaId,
        numero,
        descripcion: descripcion || null,
        activo: true,
      });
      setNumero("");
      setDescripcion("");
      setCreateOpen(false);
      toast.success("Consultorio creado correctamente");
      onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (c: Consultorio) => {
    setEdit(c);
    const sala = salas.find((s) => s.id === c.sala_id);
    setEditSedeId(c.sede_id ?? sala?.sede_id ?? "");
    setEditSalaId(c.sala_id);
    setEditNumero(c.numero);
    setEditDescripcion(c.descripcion ?? "");
    setEditActivo(c.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || editSalaId === "") return;
    setSaving(true);
    try {
      await api.admin.updateConsultorio(token, edit.id, {
        sala_id: Number(editSalaId),
        numero: editNumero,
        descripcion: editDescripcion || null,
        activo: editActivo,
      });
      setEdit(null);
      toast.success("Consultorio actualizado correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deleteConsultorio(token, id);
      toast.success("Consultorio eliminado");
      await onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const consultoriosGrouped = groupConsultoriosBySedeAndSala(consultorios);

  return (
    <CrudSection
      title="Consultorios"
      description="Consultorios visibles en pantalla por sala."
      onNew={openCreate}
      newLabel="Nuevo consultorio"
    >
      {consultoriosGrouped.length === 0 ? (
        <p className="text-sm text-slate-500">No hay consultorios registrados.</p>
      ) : (
        <div className="space-y-10">
          {consultoriosGrouped.map((sedeGroup) => (
            <section key={sedeGroup.sedeName}>
              <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-bold text-slate-700">
                <Building className="mr-2 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                {sedeGroup.sedeName}
              </h3>
              <div className="space-y-6 pl-2 md:pl-4">
                {sedeGroup.salas.map((salaGroup) => (
                  <div key={salaGroup.salaId}>
                    <h4 className="mb-2 flex items-center text-base font-bold text-slate-700">
                      <MapPin className="mr-2 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                      {salaGroup.salaName}
                    </h4>
                    <EntityTable
                      headers={["ID", "Número", "Descripción", "Activo", ...actionsHeader(canEditDelete)]}
                      rows={salaGroup.consultorios.map((c) => [
                        c.id,
                        c.numero,
                        c.descripcion ?? "-",
                        c.activo ? "Sí" : "No",
                        ...actionsCell(canEditDelete, `actions-${c.id}`, () => openEdit(c), () => onDelete(c.id)),
                      ])}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Modal
        open={createOpen}
        title="Nuevo consultorio"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Sede
          <select
            className={inputClass()}
            value={sedeId}
            onChange={(e) => onCreateSedeChange(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Sede...</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Sala / Piso
          <select
            className={inputClass()}
            value={salaId}
            onChange={(e) => setSalaId(e.target.value ? Number(e.target.value) : "")}
            required
            disabled={sedeId === ""}
          >
            <option value="">Sala...</option>
            {salasForSede(sedeId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Número visible
          <input className={inputClass()} value={numero} onChange={(e) => setNumero(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Descripción
          <input
            className={inputClass()}
            placeholder="Opcional"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </FieldLabel>
      </Modal>
      <Modal open={!!edit} title="Editar consultorio" onClose={() => setEdit(null)} onSubmit={onUpdate} saving={saving}>
        <FieldLabel>
          Sede
          <select
            className={inputClass()}
            value={editSedeId}
            onChange={(e) => onEditSedeChange(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Sede...</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Sala / Piso
          <select
            className={inputClass()}
            value={editSalaId}
            onChange={(e) => setEditSalaId(e.target.value ? Number(e.target.value) : "")}
            required
            disabled={editSedeId === ""}
          >
            <option value="">Sala...</option>
            {salasForSede(editSedeId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel>
          Número visible
          <input className={inputClass()} value={editNumero} onChange={(e) => setEditNumero(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Descripción
          <input className={inputClass()} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
        </FieldLabel>
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

function CrudPantallas({
  token,
  pantallas,
  onSaved,
  canEditDelete,
}: {
  token: string;
  pantallas: Pantalla[];
  onSaved: () => void;
  canEditDelete: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [edit, setEdit] = useState<Pantalla | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setNombre("");
    setCodigo("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createPantalla(token, { nombre, codigo, activo: true });
      setNombre("");
      setCodigo("");
      setCreateOpen(false);
      toast.success("Pantalla creada correctamente");
      onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (p: Pantalla) => {
    setEdit(p);
    setEditNombre(p.nombre);
    setEditCodigo(p.codigo);
    setEditActivo(p.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.admin.updatePantalla(token, edit.id, {
        nombre: editNombre,
        codigo: editCodigo,
        activo: editActivo,
      });
      setEdit(null);
      toast.success("Pantalla actualizada correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deletePantalla(token, id);
      toast.success("Pantalla eliminada");
      await onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  return (
    <CrudSection
      title="Pantallas"
      description="Dispositivos independientes; sede y sala se eligen en /pantalla/setup."
      onNew={openCreate}
      newLabel="Nueva pantalla"
    >
      <EntityTable
        headers={["ID", "Nombre", "Código / URL", "Activo", ...actionsHeader(canEditDelete)]}
        rows={pantallas.map((p) => [
          p.id,
          p.nombre,
          p.codigo,
          p.activo ? "Sí" : "No",
          ...actionsCell(canEditDelete, `actions-${p.id}`, () => openEdit(p), () => onDelete(p.id)),
        ])}
      />
      <Modal
        open={createOpen}
        title="Nueva pantalla"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Nombre
          <input className={inputClass()} placeholder="Nombre pantalla" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Identificador (URL)
          <input className={inputClass()} placeholder="Código URL" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        </FieldLabel>
      </Modal>
      <Modal open={!!edit} title="Editar pantalla" onClose={() => setEdit(null)} onSubmit={onUpdate} saving={saving}>
        <FieldLabel>
          Nombre
          <input className={inputClass()} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Identificador (URL)
          <input className={inputClass()} value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} required />
        </FieldLabel>
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

function CrudMedicos({
  token,
  medicos,
  onSaved,
  canEditDelete,
}: {
  token: string;
  medicos: Medico[];
  onSaved: () => void;
  canEditDelete: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [edit, setEdit] = useState<Medico | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setNombre("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createMedico(token, { nombre, activo: true });
      setNombre("");
      setCreateOpen(false);
      toast.success("Médico creado correctamente");
      onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (m: Medico) => {
    setEdit(m);
    setEditNombre(m.nombre);
    setEditActivo(m.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.admin.updateMedico(token, edit.id, { nombre: editNombre, activo: editActivo });
      setEdit(null);
      toast.success("Médico actualizado correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deleteMedico(token, id);
      toast.success("Médico eliminado");
      await onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  return (
    <CrudSection title="Médicos" description="Profesionales que pueden llamar pacientes." onNew={openCreate} newLabel="Nuevo médico">
      <EntityTable
        headers={["ID", "Nombre", "Activo", ...actionsHeader(canEditDelete)]}
        rows={medicos.map((m) => [
          m.id,
          m.nombre,
          m.activo ? "Sí" : "No",
          ...actionsCell(canEditDelete, `actions-${m.id}`, () => openEdit(m), () => onDelete(m.id)),
        ])}
      />
      <Modal
        open={createOpen}
        title="Nuevo médico"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Nombre
          <input
            className={inputClass()}
            placeholder="Nombre del médico"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </FieldLabel>
      </Modal>
      <Modal open={!!edit} title="Editar médico" onClose={() => setEdit(null)} onSubmit={onUpdate} saving={saving}>
        <FieldLabel>
          Nombre
          <input className={inputClass()} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required />
        </FieldLabel>
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

type UsuarioRol = "ADMIN" | "GESTOR" | "MEDICO" | "PANTALLA";

function CrudUsuarios({
  token,
  medicos,
  usuarios,
  onSaved,
  canEditDelete,
  canCreateUser,
}: {
  token: string;
  medicos: Medico[];
  usuarios: Usuario[];
  onSaved: () => void;
  canEditDelete: boolean;
  canCreateUser: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UsuarioRol>("MEDICO");
  const [medicoId, setMedicoId] = useState<number | "">("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [edit, setEdit] = useState<Usuario | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRol, setEditRol] = useState<UsuarioRol>("MEDICO");
  const [editMedicoId, setEditMedicoId] = useState<number | "">("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setUsername("");
    setPassword("");
    setRol("MEDICO");
    setMedicoId("");
    setCreateError(null);
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (rol === "MEDICO" && medicoId === "") {
      setCreateError("Seleccione el médico asociado");
      return;
    }
    try {
      await api.admin.createUsuario(token, {
        username,
        password,
        rol,
        medico_id: rol === "MEDICO" ? Number(medicoId) : null,
        activo: true,
      });
      setUsername("");
      setPassword("");
      setMedicoId("");
      setCreateOpen(false);
      toast.success("Usuario creado correctamente");
      onSaved();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al crear usuario");
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  const openEdit = (u: Usuario) => {
    setEdit(u);
    setEditUsername(u.username);
    setEditPassword("");
    setEditRol(u.rol);
    setEditMedicoId(u.medico_id ?? "");
    setEditActivo(u.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    if (editRol === "MEDICO" && editMedicoId === "") {
      setFormError("Seleccione el médico asociado");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        username: editUsername,
        rol: editRol,
        activo: editActivo,
        medico_id: editRol === "MEDICO" ? Number(editMedicoId) : null,
      };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }
      await api.admin.updateUsuario(token, edit.id, payload);
      setEdit(null);
      toast.success("Usuario actualizado correctamente");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
      toast.error("Ocurrió un error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.admin.deleteUsuario(token, id);
      toast.success("Usuario eliminado");
      await onSaved();
    } catch {
      toast.error("Ocurrió un error al procesar la solicitud");
    }
  };

  return (
    <CrudSection
      title="Usuarios"
      description="Cuentas de acceso al sistema."
      onNew={openCreate}
      newLabel="Nuevo usuario"
      showNew={canCreateUser}
    >
      <EntityTable
        headers={["ID", "Usuario", "Rol", "Médico", "Activo", ...actionsHeader(canEditDelete)]}
        rows={usuarios.map((u) => [
          u.id,
          u.username,
          u.rol,
          medicos.find((m) => m.id === u.medico_id)?.nombre ?? "-",
          u.activo ? "Sí" : "No",
          ...actionsCell(canEditDelete, `actions-${u.id}`, () => openEdit(u), () => onDelete(u.id)),
        ])}
      />
      <Modal
        open={createOpen}
        title="Nuevo usuario"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Usuario
          <input className={inputClass()} placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Contraseña
          <input
            type="password"
            className={inputClass()}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </FieldLabel>
        <FieldLabel>
          Rol
          <select
            className={inputClass()}
            value={rol}
            onChange={(e) => setRol(e.target.value as UsuarioRol)}
          >
            <option value="MEDICO">MEDICO</option>
            <option value="PANTALLA">PANTALLA</option>
            <option value="GESTOR">GESTOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </FieldLabel>
        {rol === "MEDICO" && (
          <FieldLabel>
            Médico asociado
            <select className={inputClass()} value={medicoId} onChange={(e) => setMedicoId(Number(e.target.value))} required>
              <option value="">Médico...</option>
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </FieldLabel>
        )}
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </Modal>
      <Modal open={!!edit} title="Editar usuario" onClose={() => setEdit(null)} onSubmit={onUpdate} saving={saving}>
        <FieldLabel>
          Usuario
          <input className={inputClass()} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
        </FieldLabel>
        <FieldLabel>
          Nueva contraseña (opcional)
          <input type="password" className={inputClass()} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} minLength={6} placeholder="Dejar vacío para no cambiar" />
        </FieldLabel>
        <FieldLabel>
          Rol
          <select
            className={inputClass()}
            value={editRol}
            onChange={(e) => setEditRol(e.target.value as UsuarioRol)}
          >
            <option value="MEDICO">MEDICO</option>
            <option value="PANTALLA">PANTALLA</option>
            <option value="GESTOR">Gestor</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </FieldLabel>
        {editRol === "MEDICO" && (
          <FieldLabel>
            Médico asociado
            <select className={inputClass()} value={editMedicoId} onChange={(e) => setEditMedicoId(Number(e.target.value))} required>
              <option value="">Médico...</option>
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </FieldLabel>
        )}
        <ToggleSwitch checked={editActivo} onChange={setEditActivo} label="Estado" />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </CrudSection>
  );
}

function EntityTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number | ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/80 text-slate-600">
          <tr>
            {headers.map((h) => (
              <th key={h || "actions"} className="text-left px-4 py-3.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-slate-50/50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
