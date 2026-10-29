export const AUTH_STORAGE_KEY = "llamador_auth";
export const MEDICO_CONFIG_KEY = "llamador_medico_location";
export const PANTALLA_CONFIG_KEY = "llamador_pantalla_location";

/** Sesión y config por pestaña (no compartido entre tabs del mismo navegador). */
const store = sessionStorage;

export interface MedicoStoredConfig {
  sedeId: number;
  salaId: number;
  consultorioId: number;
  sedeNombre: string;
  salaNombre: string;
  consultorioNumero: string;
  ready: boolean;
}

export interface PantallaStoredConfig {
  sedeId: number;
  salaId: number;
  sedeNombre: string;
  salaNombre: string;
  ready: boolean;
}

export function saveMedicoConfig(config: MedicoStoredConfig): void {
  store.setItem(MEDICO_CONFIG_KEY, JSON.stringify(config));
}

export function savePantallaConfig(config: PantallaStoredConfig): void {
  store.setItem(PANTALLA_CONFIG_KEY, JSON.stringify(config));
}

export function clearMedicoConfig(): void {
  store.removeItem(MEDICO_CONFIG_KEY);
}

export function clearPantallaConfig(): void {
  store.removeItem(PANTALLA_CONFIG_KEY);
}

export function loadMedicoConfig(): MedicoStoredConfig | null {
  try {
    const raw = store.getItem(MEDICO_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MedicoStoredConfig;
    return parsed.ready && parsed.consultorioId ? parsed : null;
  } catch {
    return null;
  }
}

export function loadPantallaConfig(): PantallaStoredConfig | null {
  try {
    const raw = store.getItem(PANTALLA_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PantallaStoredConfig;
    return parsed.ready && parsed.salaId ? parsed : null;
  } catch {
    return null;
  }
}

export function loadAuthRaw(): string | null {
  return store.getItem(AUTH_STORAGE_KEY);
}

export function saveAuthRaw(json: string): void {
  store.setItem(AUTH_STORAGE_KEY, json);
}

export function clearAuth(): void {
  store.removeItem(AUTH_STORAGE_KEY);
}
