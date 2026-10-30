import type { TokenResponse } from "../types";

const API_BASE = "";

function authHeaders(token?: string | null, json = true): HeadersInit {
  const headers: HeadersInit = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Error de servidor";
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(formatErrorDetail(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Ejecuta fetch y luego parsea la respuesta (siempre await antes de handle). */
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, init);
  return handle<T>(res);
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      headers: authHeaders(null, true),
      body: JSON.stringify({ username, password }),
    }),

  me: (token: string) =>
    apiFetch("/api/auth/me", { headers: authHeaders(token) }),

  getSedes: (token: string) =>
    apiFetch("/api/locations/sedes", { headers: authHeaders(token) }),

  getSalas: (token: string, sedeId: number) =>
    apiFetch(`/api/locations/sedes/${sedeId}/salas`, { headers: authHeaders(token) }),

  getConsultorios: (token: string, salaId: number) =>
    apiFetch(`/api/locations/salas/${salaId}/consultorios`, {
      headers: authHeaders(token),
    }),

  createCall: (token: string, consultorioId: number, pacienteNombre: string) =>
    apiFetch("/api/calls", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ consultorio_id: consultorioId, paciente_nombre: pacienteNombre }),
    }),

  getMedicoCallsToday: (
    token: string,
    params?: { page?: number; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set("page", String(params.page));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return apiFetch<import("../types").MedicoCallsToday>(
      `/api/medicos/mis-llamadas-hoy${q ? `?${q}` : ""}`,
      { headers: authHeaders(token) },
    );
  },

  getCurrentCallForSala: async (salaId: number, token: string) => {
    const res = await fetch(`${API_BASE}/api/salas/${salaId}/current-call`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      throw new Error("No se pudo obtener la llamada vigente");
    }
    const data = await res.json();
    return data as import("../types").CurrentCall | null;
  },

  getPendingCallsForSala: (salaId: number, token: string) =>
    apiFetch<import("../types").CurrentCall[]>(`/api/pantallas/${salaId}/pendientes`, {
      headers: authHeaders(token),
    }),

  clearPantallaQueue: (salaId: number, token: string) =>
    apiFetch<{ message: string }>(`/api/pantallas/${salaId}/limpiar-cola`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  getDashboardSummary: (token: string) =>
    apiFetch<import("../types").DashboardSummary>(`/api/dashboard/summary`, {
      headers: authHeaders(token),
    }),

  getDashboardFlujoPorHora: (
    token: string,
    params: { fecha?: string; sedeId?: number; salaId?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params.fecha) qs.set("fecha", params.fecha);
    if (params.sedeId != null) qs.set("sede_id", String(params.sedeId));
    if (params.salaId != null) qs.set("sala_id", String(params.salaId));
    const q = qs.toString();
    return apiFetch<import("../types").FlujoPorHoraDashboard>(
      `/api/dashboard/flujo-por-hora${q ? `?${q}` : ""}`,
      { headers: authHeaders(token) },
    );
  },

  getDashboardTopMedicos: (
    token: string,
    params: { fecha?: string; sedeId?: number; salaId?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params.fecha) qs.set("fecha", params.fecha);
    if (params.sedeId != null) qs.set("sede_id", String(params.sedeId));
    if (params.salaId != null) qs.set("sala_id", String(params.salaId));
    const q = qs.toString();
    return apiFetch<import("../types").TopMedicosDashboard>(
      `/api/dashboard/top-medicos${q ? `?${q}` : ""}`,
      { headers: authHeaders(token) },
    );
  },

  getProduccionDashboard: (
    token: string,
    params: { startDate: string; endDate: string },
  ) => {
    const qs = new URLSearchParams({
      start_date: params.startDate,
      end_date: params.endDate,
    });
    return apiFetch<import("../types").ProduccionDashboard>(
      `/api/dashboard/produccion?${qs.toString()}`,
      { headers: authHeaders(token) },
    );
  },

  getDoctorDashboard: (
    token: string,
    medicoId: number,
    params?: { fecha?: string; page?: number; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.fecha) qs.set("fecha", params.fecha);
    if (params?.page != null) qs.set("page", String(params.page));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return apiFetch<import("../types").DoctorDashboardDetail>(
      `/api/dashboard/doctor/${medicoId}${q ? `?${q}` : ""}`,
      { headers: authHeaders(token) },
    );
  },

  admin: {
    metrics: (token: string) =>
      apiFetch("/api/admin/dashboard/metrics", { headers: authHeaders(token) }),

    listSedes: (token: string) =>
      apiFetch("/api/admin/sedes", { headers: authHeaders(token) }),

    createSede: (token: string, data: unknown) =>
      apiFetch("/api/admin/sedes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updateSede: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/sedes/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteSede: (token: string, id: number) =>
      apiFetch(`/api/admin/sedes/${id}`, { method: "DELETE", headers: authHeaders(token) }),

    listSalas: (token: string, sedeId?: number) =>
      apiFetch(
        `/api/admin/salas${sedeId != null ? `?sede_id=${sedeId}` : ""}`,
        { headers: authHeaders(token) },
      ),

    createSala: (token: string, data: unknown) =>
      apiFetch("/api/admin/salas", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updateSala: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/salas/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteSala: (token: string, id: number) =>
      apiFetch(`/api/admin/salas/${id}`, { method: "DELETE", headers: authHeaders(token) }),

    listConsultorios: (token: string, salaId?: number) =>
      apiFetch(
        `/api/admin/consultorios${salaId != null ? `?sala_id=${salaId}` : ""}`,
        { headers: authHeaders(token) },
      ),

    createConsultorio: (token: string, data: unknown) =>
      apiFetch("/api/admin/consultorios", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updateConsultorio: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/consultorios/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteConsultorio: (token: string, id: number) =>
      apiFetch(`/api/admin/consultorios/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      }),

    listPantallas: (token: string) =>
      apiFetch("/api/admin/pantallas", { headers: authHeaders(token) }),

    createPantalla: (token: string, data: unknown) =>
      apiFetch("/api/admin/pantallas", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updatePantalla: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/pantallas/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deletePantalla: (token: string, id: number) =>
      apiFetch(`/api/admin/pantallas/${id}`, { method: "DELETE", headers: authHeaders(token) }),

    listMedicos: (token: string) =>
      apiFetch("/api/admin/medicos", { headers: authHeaders(token) }),

    createMedico: (token: string, data: unknown) =>
      apiFetch("/api/admin/medicos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updateMedico: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/medicos/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteMedico: (token: string, id: number) =>
      apiFetch(`/api/admin/medicos/${id}`, { method: "DELETE", headers: authHeaders(token) }),

    listUsuarios: (token: string) =>
      apiFetch("/api/admin/usuarios", { headers: authHeaders(token) }),

    createUsuario: (token: string, data: unknown) =>
      apiFetch("/api/admin/usuarios", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    updateUsuario: (token: string, id: number, data: unknown) =>
      apiFetch(`/api/admin/usuarios/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteUsuario: (token: string, id: number) =>
      apiFetch(`/api/admin/usuarios/${id}`, { method: "DELETE", headers: authHeaders(token) }),

    listUsuariosPorRol: (token: string, rol: string) =>
      apiFetch<import("../types").UsuarioFiltroOption[]>(
        `/api/admin/usuarios-por-rol?rol=${encodeURIComponent(rol)}`,
        { headers: authHeaders(token) },
      ),

    listAuditoria: (
      token: string,
      params?: {
        rol?: string;
        usuarioId?: number;
        fechaInicio?: string;
        fechaFin?: string;
        page?: number;
        limit?: number;
      },
    ) => {
      const qs = new URLSearchParams();
      if (params?.rol) qs.set("rol", params.rol);
      if (params?.usuarioId != null) qs.set("usuario_id", String(params.usuarioId));
      if (params?.fechaInicio) qs.set("fecha_inicio", params.fechaInicio);
      if (params?.fechaFin) qs.set("fecha_fin", params.fechaFin);
      if (params?.page != null) qs.set("page", String(params.page));
      if (params?.limit != null) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return apiFetch<import("../types").AuditoriaList>(
        `/api/admin/auditoria${q ? `?${q}` : ""}`,
        { headers: authHeaders(token) },
      );
    },
  },

  logout: (token: string) =>
    apiFetch<{ message: string }>("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(token),
    }),
};
