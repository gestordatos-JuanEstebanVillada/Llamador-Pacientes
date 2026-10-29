import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "../components/BrandLogo";
import { loadMedicoConfig, loadPantallaConfig } from "../constants/storage";
import { useAuth } from "../context/AuthContext";
import { defaultRouteForSession, routeAfterLogin } from "../lib/authRoutes";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30";

export default function LoginPage() {
  const { login, isAuthenticated, rol } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && rol) {
    return (
      <Navigate
        to={defaultRouteForSession(rol, !!loadMedicoConfig(), !!loadPantallaConfig())}
        replace
      />
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(username.trim(), password);
      navigate(routeAfterLogin(session.rol), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-rose-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-100">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16 w-auto" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Usuario</label>
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Contraseña</label>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-rose-600 py-2.5 font-medium text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
