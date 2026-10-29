import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearAuth,
  clearMedicoConfig,
  clearPantallaConfig,
  loadAuthRaw,
  saveAuthRaw,
} from "../constants/storage";
import { api } from "../lib/api";
import type { Rol } from "../types";

interface AuthState {
  token: string | null;
  username: string | null;
  rol: Rol | null;
  medicoId: number | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<AuthState>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): AuthState {
  try {
    const raw = loadAuthRaw();
    if (!raw) return { token: null, username: null, rol: null, medicoId: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, username: null, rol: null, medicoId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    if (!res.access_token) {
      throw new Error("El servidor no devolvió access_token");
    }
    const next: AuthState = {
      token: res.access_token,
      username: res.username,
      rol: res.rol as Rol,
      medicoId: res.medico_id ?? null,
    };
    saveAuthRaw(JSON.stringify(next));
    setState(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    const rolActual = state.rol;
    clearAuth();
    if (rolActual === "MEDICO") {
      clearMedicoConfig();
    }
    if (rolActual === "PANTALLA") {
      clearPantallaConfig();
    }
    setState({ token: null, username: null, rol: null, medicoId: null });
  }, [state.rol]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
