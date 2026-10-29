import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "../../components/BrandLogo";
import {
  type MedicoStoredConfig,
  loadMedicoConfig,
  saveMedicoConfig,
} from "../../constants/storage";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { Consultorio, Sala, Sede } from "../../types";

export default function MedicoSetupPage() {
  const { token, rol, username, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [sedeId, setSedeId] = useState<number | "">("");
  const [salaId, setSalaId] = useState<number | "">("");
  const [consultorioId, setConsultorioId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;
  if (rol !== "MEDICO" && rol !== "ADMIN") return <Navigate to="/login" replace />;

  useEffect(() => {
    api.getSedes(token).then(setSedes).catch(() => setError("No se pudieron cargar sedes"));
    const cfg = loadMedicoConfig();
    if (cfg) {
      setSedeId(cfg.sedeId);
      setSalaId(cfg.salaId);
      setConsultorioId(cfg.consultorioId);
    }
  }, [token]);

  useEffect(() => {
    if (sedeId === "") {
      setSalas([]);
      return;
    }
    api.getSalas(token, sedeId).then(setSalas).catch(() => setError("No se pudieron cargar salas"));
  }, [token, sedeId]);

  useEffect(() => {
    if (salaId === "") {
      setConsultorios([]);
      return;
    }
    api.getConsultorios(token, salaId).then(setConsultorios).catch(() => setError("Error consultorios"));
  }, [token, salaId]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (sedeId === "" || salaId === "" || consultorioId === "") {
      setError("Complete sede, sala y consultorio");
      return;
    }
    const sede = sedes.find((s) => s.id === sedeId);
    const sala = salas.find((s) => s.id === salaId);
    const consultorio = consultorios.find((c) => c.id === consultorioId);
    if (!sede || !sala || !consultorio) {
      setError("Selección inválida");
      return;
    }
    setSaving(true);
    const payload: MedicoStoredConfig = {
      sedeId: Number(sedeId),
      salaId: Number(salaId),
      consultorioId: Number(consultorioId),
      sedeNombre: sede.nombre,
      salaNombre: sala.nombre,
      consultorioNumero: consultorio.numero,
      ready: true,
    };
    saveMedicoConfig(payload);
    setSaving(false);
    navigate("/medico/call", { replace: true });
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Configuración médico</h1>
            <p className="text-sm text-gray-500">{username}</p>
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          {rol === "ADMIN" && (
            <Link to="/admin" className="text-rose-600 hover:text-rose-700 hover:underline">
              Admin
            </Link>
          )}
          <button type="button" onClick={logout} className="text-gray-500 hover:text-gray-800">
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="max-w-xl mx-auto p-6">
        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
          <p className="text-sm text-gray-500">Seleccione su ubicación antes de llamar pacientes.</p>
          <label className="block text-sm text-slate-700">
            Sede
            <select className={fieldClass} value={sedeId} onChange={(e) => { setSedeId(e.target.value ? Number(e.target.value) : ""); setSalaId(""); setConsultorioId(""); }}>
              <option value="">Seleccione...</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Sala
            <select className={fieldClass} value={salaId} onChange={(e) => { setSalaId(e.target.value ? Number(e.target.value) : ""); setConsultorioId(""); }} disabled={sedeId === ""}>
              <option value="">Seleccione...</option>
              {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Consultorio
            <select className={fieldClass} value={consultorioId} onChange={(e) => setConsultorioId(e.target.value ? Number(e.target.value) : "")} disabled={salaId === ""}>
              <option value="">Seleccione...</option>
              {consultorios.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-rose-600 py-4 text-lg font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </form>
      </main>
    </div>
  );
}
