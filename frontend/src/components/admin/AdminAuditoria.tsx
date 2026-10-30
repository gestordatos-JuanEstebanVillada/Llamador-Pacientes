import { useCallback, useEffect, useState } from "react";

import { api } from "../../lib/api";
import type { AuditoriaList, Rol, UsuarioFiltroOption } from "../../types";

const ROL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos los roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "GESTOR", label: "Gestor" },
  { value: "MEDICO", label: "Médico" },
  { value: "PANTALLA", label: "Pantalla" },
];

type AppliedFilters = {
  rol: string;
  usuarioId: number | null;
  fechaInicio: string;
  fechaFin: string;
};

const EMPTY_APPLIED: AppliedFilters = {
  rol: "",
  usuarioId: null,
  fechaInicio: "",
  fechaFin: "",
};

function formatFechaBogota(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function rolLabel(rol: string): string {
  const map: Record<string, string> = {
    ADMIN: "Admin",
    GESTOR: "Gestor",
    MEDICO: "Médico",
    PANTALLA: "Pantalla",
    SISTEMA: "Sistema",
  };
  return map[rol] ?? rol;
}

interface AdminAuditoriaProps {
  token: string;
}

export function AdminAuditoria({ token }: AdminAuditoriaProps) {
  const [rolFilter, setRolFilter] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [usuariosOpcion, setUsuariosOpcion] = useState<UsuarioFiltroOption[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_APPLIED);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditoriaList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rolFilter) {
      setUsuariosOpcion([]);
      setUsuarioFiltro("");
      return;
    }

    let cancelled = false;
    setLoadingUsuarios(true);
    setUsuarioFiltro("");
    void api.admin
      .listUsuariosPorRol(token, rolFilter)
      .then((list) => {
        if (!cancelled) setUsuariosOpcion(list);
      })
      .catch(() => {
        if (!cancelled) setUsuariosOpcion([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsuarios(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, rolFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.listAuditoria(token, {
        page,
        limit: 25,
        rol: (applied.rol as Rol | "") || undefined,
        usuarioId: applied.usuarioId ?? undefined,
        fechaInicio: applied.fechaInicio || undefined,
        fechaFin: applied.fechaFin || undefined,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar auditoría");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilter = () => {
    setPage(1);
    setApplied({
      rol: rolFilter,
      usuarioId: usuarioFiltro ? Number(usuarioFiltro) : null,
      fechaInicio,
      fechaFin,
    });
  };

  const onClear = () => {
    setRolFilter("");
    setUsuarioFiltro("");
    setUsuariosOpcion([]);
    setFechaInicio("");
    setFechaFin("");
    setPage(1);
    setApplied(EMPTY_APPLIED);
  };

  const usuarioSelectDisabled = !rolFilter;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Auditoría</h2>
        <p className="mt-1 text-sm text-slate-500">
          Registro de inicios de sesión, altas en administración y llamadas a pacientes.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Rol
            <select
              value={rolFilter}
              onChange={(e) => setRolFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-800 min-w-[180px]"
            >
              {ROL_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Usuario
            <select
              value={usuarioFiltro}
              disabled={usuarioSelectDisabled}
              onChange={(e) => setUsuarioFiltro(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-800 min-w-[220px] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">
                {usuarioSelectDisabled
                  ? "Seleccione un rol primero"
                  : loadingUsuarios
                    ? "Cargando usuarios…"
                    : "Todos los usuarios del rol"}
              </option>
              {usuariosOpcion.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Fecha inicio
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Fecha fin
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-800"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onFilter}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !data && <p className="text-sm text-slate-500">Cargando…</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  {["Fecha / hora", "Usuario", "Rol", "Módulo", "Acción", "Detalles"].map((h) => (
                    <th key={h} className="text-left px-4 py-3.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {data.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  data.data.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{formatFechaBogota(row.fecha)}</td>
                      <td className="px-4 py-3">{row.nombre_usuario}</td>
                      <td className="px-4 py-3">{rolLabel(row.rol_usuario)}</td>
                      <td className="px-4 py-3">{row.modulo}</td>
                      <td className="px-4 py-3">{row.accion}</td>
                      <td className="px-4 py-3 max-w-md">{row.detalles ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Página {data.current_page} de {data.total_pages} ({data.total_records} registros)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={data.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={data.current_page >= data.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
