import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "../../components/BrandLogo";
import { MedicoTodayCallsPanel } from "../../components/medico/MedicoTodayCallsPanel";
import { loadMedicoConfig } from "../../constants/storage";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function MedicoCallPage() {
  const { token, rol, username, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const cfg = loadMedicoConfig();
  const [paciente, setPaciente] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [callsRefreshKey, setCallsRefreshKey] = useState(0);

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;
  if (rol !== "MEDICO" && rol !== "ADMIN") return <Navigate to="/login" replace />;
  if (!cfg) return <Navigate to="/medico/setup" replace />;

  const onCall = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const nombre = paciente.trim();
    if (!nombre) {
      setError("Escriba el nombre del paciente");
      return;
    }
    setLoading(true);
    try {
      const res = await api.createCall(token, cfg.consultorioId, nombre);
      setMessage(`Llamada enviada: ${res.paciente_nombre} → consultorio ${res.consultorio_numero}`);
      setPaciente("");
      setCallsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al llamar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Panel Médico</h1>
            <p className="text-sm text-gray-500">{username}</p>
          </div>
        </div>
        <div className="flex gap-3 text-sm items-center">
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
      <button
        type="button"
        onClick={() => navigate("/medico/setup")}
        className="absolute top-20 right-4 text-xs text-gray-500 hover:text-rose-600 underline"
      >
        Cambiar consultorio
      </button>
      <main className="max-w-2xl mx-auto p-6 pt-10">
        <p className="text-center text-sm text-gray-500 mb-6">
          {cfg.sedeNombre} · {cfg.salaNombre} · Consultorio {cfg.consultorioNumero}
        </p>
        <form onSubmit={onCall} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <label className="block text-sm text-slate-700">
            Nombre del paciente
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-2xl text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none"
              value={paciente}
              onChange={(e) => setPaciente(e.target.value)}
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-rose-600">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-rose-600 py-5 text-xl font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "LLAMAR PACIENTE"}
          </button>
        </form>

        <MedicoTodayCallsPanel token={token} refreshKey={callsRefreshKey} />
      </main>
    </div>
  );
}
