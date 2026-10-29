import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus, Pencil } from "lucide-react";
import { Navigate } from "react-router-dom";

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
  if (rol !== "ADMIN") {
    return <Navigate to="/medico/setup" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-800">
      <AdminSidebar activeTab={tab} onTabChange={setTab} onLogout={logout} />

      <main className="flex-1 h-full min-w-0 overflow-y-auto p-6 bg-slate-50">
        {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

        {tab === "dashboard" && token && (
          <AdminDashboard token={token} medicos={medicos} sedes={sedes} salas={salas} />
        )}

        {tab === "sedes" && <CrudSedes token={token} sedes={sedes} onSaved={reload} />}
        {tab === "salas" && (
          <CrudSalas token={token} sedes={sedes} salas={salas} onSaved={reload} />
        )}
        {tab === "consultorios" && (
          <CrudConsultorios token={token} salas={salas} consultorios={consultorios} onSaved={reload} />
        )}
        {tab === "pantallas" && (
          <CrudPantallas token={token} salas={salas} pantallas={pantallas} onSaved={reload} />
        )}
        {tab === "medicos" && <CrudMedicos token={token} medicos={medicos} onSaved={reload} />}
        {tab === "usuarios" && (
          <CrudUsuarios token={token} medicos={medicos} usuarios={usuarios} onSaved={reload} />
        )}
      </main>
    </div>
  );
}

function CrudSection({ title, description, onNew, newLabel, children }: {
  title: string;
  description?: string;
  onNew: () => void;
  newLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {newLabel}
        </button>
      </div>
      {children}
    </div>
  );
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
}: {
  token: string;
  sedes: Sede[];
  onSaved: () => void;
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
    await api.admin.createSede(token, { nombre, activo: true });
    setNombre("");
    setCreateOpen(false);
    onSaved();
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
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection title="Sedes" description="Administre las sedes de la institución." onNew={openCreate} newLabel="Nueva sede">
      <EntityTable
        headers={["ID", "Nombre", "Activo", ""]}
        rows={sedes.map((s) => [
          s.id,
          s.nombre,
          s.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${s.id}`} onClick={() => openEdit(s)} />,
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
}: {
  token: string;
  sedes: Sede[];
  salas: Sala[];
  onSaved: () => void;
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
    await api.admin.createSala(token, { sede_id: sedeId, nombre, activo: true });
    setNombre("");
    setCreateOpen(false);
    onSaved();
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
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection title="Salas" description="Salas de atención asociadas a cada sede." onNew={openCreate} newLabel="Nueva sala">
      <EntityTable
        headers={["ID", "Sede", "Nombre", "Activo", ""]}
        rows={salas.map((s) => [
          s.id,
          sedes.find((x) => x.id === s.sede_id)?.nombre ?? s.sede_id,
          s.nombre,
          s.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${s.id}`} onClick={() => openEdit(s)} />,
        ])}
      />
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
  salas,
  consultorios,
  onSaved,
}: {
  token: string;
  salas: Sala[];
  consultorios: Consultorio[];
  onSaved: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [salaId, setSalaId] = useState<number | "">("");
  const [numero, setNumero] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [edit, setEdit] = useState<Consultorio | null>(null);
  const [editSalaId, setEditSalaId] = useState<number | "">("");
  const [editNumero, setEditNumero] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setSalaId("");
    setNumero("");
    setDescripcion("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (salaId === "") return;
    await api.admin.createConsultorio(token, {
      sala_id: salaId,
      numero,
      descripcion: descripcion || null,
      activo: true,
    });
    setNumero("");
    setDescripcion("");
    setCreateOpen(false);
    onSaved();
  };

  const openEdit = (c: Consultorio) => {
    setEdit(c);
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
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection
      title="Consultorios"
      description="Consultorios visibles en pantalla por sala."
      onNew={openCreate}
      newLabel="Nuevo consultorio"
    >
      <EntityTable
        headers={["ID", "Sala", "Número", "Descripción", "Activo", ""]}
        rows={consultorios.map((c) => [
          c.id,
          salas.find((x) => x.id === c.sala_id)?.nombre ?? c.sala_id,
          c.numero,
          c.descripcion ?? "-",
          c.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${c.id}`} onClick={() => openEdit(c)} />,
        ])}
      />
      <Modal
        open={createOpen}
        title="Nuevo consultorio"
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
        submitLabel="Crear"
      >
        <FieldLabel>
          Sala
          <select className={inputClass()} value={salaId} onChange={(e) => setSalaId(Number(e.target.value))} required>
            <option value="">Sala...</option>
            {salas.map((s) => (
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
          Sala
          <select className={inputClass()} value={editSalaId} onChange={(e) => setEditSalaId(Number(e.target.value))} required>
            {salas.map((s) => (
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
  salas,
  pantallas,
  onSaved,
}: {
  token: string;
  salas: Sala[];
  pantallas: Pantalla[];
  onSaved: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [salaId, setSalaId] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [edit, setEdit] = useState<Pantalla | null>(null);
  const [editSalaId, setEditSalaId] = useState<number | "">("");
  const [editNombre, setEditNombre] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setSalaId("");
    setNombre("");
    setCodigo("");
    setCreateOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (salaId === "") return;
    await api.admin.createPantalla(token, { sala_id: salaId, nombre, codigo, activo: true });
    setNombre("");
    setCodigo("");
    setCreateOpen(false);
    onSaved();
  };

  const openEdit = (p: Pantalla) => {
    setEdit(p);
    setEditSalaId(p.sala_id);
    setEditNombre(p.nombre);
    setEditCodigo(p.codigo);
    setEditActivo(p.activo);
    setFormError(null);
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || editSalaId === "") return;
    setSaving(true);
    try {
      await api.admin.updatePantalla(token, edit.id, {
        sala_id: Number(editSalaId),
        nombre: editNombre,
        codigo: editCodigo,
        activo: editActivo,
      });
      setEdit(null);
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection title="Pantallas" description="Dispositivos de llamado por sala." onNew={openCreate} newLabel="Nueva pantalla">
      <EntityTable
        headers={["ID", "Sala", "Nombre", "Código", "Activo", ""]}
        rows={pantallas.map((p) => [
          p.id,
          salas.find((x) => x.id === p.sala_id)?.nombre ?? p.sala_id,
          p.nombre,
          p.codigo,
          p.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${p.id}`} onClick={() => openEdit(p)} />,
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
          Sala
          <select className={inputClass()} value={salaId} onChange={(e) => setSalaId(Number(e.target.value))} required>
            <option value="">Sala...</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </FieldLabel>
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
          Sala
          <select className={inputClass()} value={editSalaId} onChange={(e) => setEditSalaId(Number(e.target.value))} required>
            {salas.map((s) => (
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
}: {
  token: string;
  medicos: Medico[];
  onSaved: () => void;
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
    await api.admin.createMedico(token, { nombre, activo: true });
    setNombre("");
    setCreateOpen(false);
    onSaved();
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
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection title="Médicos" description="Profesionales que pueden llamar pacientes." onNew={openCreate} newLabel="Nuevo médico">
      <EntityTable
        headers={["ID", "Nombre", "Activo", ""]}
        rows={medicos.map((m) => [
          m.id,
          m.nombre,
          m.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${m.id}`} onClick={() => openEdit(m)} />,
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

function CrudUsuarios({
  token,
  medicos,
  usuarios,
  onSaved,
}: {
  token: string;
  medicos: Medico[];
  usuarios: Usuario[];
  onSaved: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"ADMIN" | "MEDICO" | "PANTALLA">("MEDICO");
  const [medicoId, setMedicoId] = useState<number | "">("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [edit, setEdit] = useState<Usuario | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRol, setEditRol] = useState<"ADMIN" | "MEDICO" | "PANTALLA">("MEDICO");
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
      onSaved();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al crear usuario");
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
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudSection title="Usuarios" description="Cuentas de acceso al sistema." onNew={openCreate} newLabel="Nuevo usuario">
      <EntityTable
        headers={["ID", "Usuario", "Rol", "Médico", "Activo", ""]}
        rows={usuarios.map((u) => [
          u.id,
          u.username,
          u.rol,
          medicos.find((m) => m.id === u.medico_id)?.nombre ?? "-",
          u.activo ? "Sí" : "No",
          <EditRowButton key={`edit-${u.id}`} onClick={() => openEdit(u)} />,
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
            onChange={(e) => setRol(e.target.value as "ADMIN" | "MEDICO" | "PANTALLA")}
          >
            <option value="MEDICO">MEDICO</option>
            <option value="PANTALLA">PANTALLA</option>
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
            onChange={(e) => setEditRol(e.target.value as "ADMIN" | "MEDICO" | "PANTALLA")}
          >
            <option value="MEDICO">MEDICO</option>
            <option value="PANTALLA">PANTALLA</option>
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
