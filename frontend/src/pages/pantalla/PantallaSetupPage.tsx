import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "../../components/BrandLogo";
import {
  type PantallaStoredConfig,
  loadPantallaConfig,
  savePantallaConfig,
} from "../../constants/storage";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { Sala, Sede } from "../../types";

export default function PantallaSetupPage() {
  const { token, rol, username, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [sedeId, setSedeId] = useState<number | "">("");
  const [salaId, setSalaId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;
  if (rol !== "PANTALLA" && rol !== "ADMIN") return <Navigate to="/login" replace />;

  useEffect(() => {
    api.getSedes(token).then(setSedes).catch(() => setError("No se pudieron cargar sedes"));
    const cfg = loadPantallaConfig();
    if (cfg) {
      setSedeId(cfg.sedeId);
      setSalaId(cfg.salaId);
    }
  }, [token]);

  useEffect(() => {
    if (sedeId === "") {
      setSalas([]);
      return;
    }
    api.getSalas(token, sedeId).then(setSalas).catch(() => setError("No se pudieron cargar salas"));
  }, [token, sedeId]);

  const onStart = async (e: FormEvent) => {
    e.preventDefault();
    if (sedeId === "" || salaId === "") {
      setError("Seleccione sede y sala");
      return;
    }
    const sede = sedes.find((s) => s.id === sedeId);
    const sala = salas.find((s) => s.id === salaId);
    if (!sede || !sala) {
      setError("Selección inválida");
      return;
    }
    setSaving(true);
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const payload: PantallaStoredConfig = {
        sedeId: Number(sedeId),
        salaId: Number(salaId),
        sedeNombre: sede.nombre,
        salaNombre: sala.nombre,
        ready: true,
      };
      savePantallaConfig(payload);
      navigate("/pantalla/view", { replace: true });
    } catch {
      setError("No se pudo habilitar el audio. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none";

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-100 text-slate-800 flex flex-col">
      <header className="bg-white/80 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Configuración de pantalla</h1>
            <p className="text-sm text-gray-500">{username}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
          Cerrar sesión
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onStart} className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <p className="text-sm text-gray-500">
            Elija la sede y sala que mostrará esta pantalla. Al iniciar se habilitará el audio.
          </p>
          <label className="block text-sm text-slate-700">
            Sede
            <select className={fieldClass} value={sedeId} onChange={(e) => { setSedeId(e.target.value ? Number(e.target.value) : ""); setSalaId(""); }}>
              <option value="">Seleccione...</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Sala
            <select className={fieldClass} value={salaId} onChange={(e) => setSalaId(e.target.value ? Number(e.target.value) : "")} disabled={sedeId === ""}>
              <option value="">Seleccione...</option>
              {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-rose-600 py-4 text-lg font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
            {saving ? "Iniciando..." : "Iniciar pantalla"}
          </button>
        </form>
      </main>
    </div>
  );
}
