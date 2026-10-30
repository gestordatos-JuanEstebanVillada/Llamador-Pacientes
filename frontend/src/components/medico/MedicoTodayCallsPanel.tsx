import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";

import { api } from "../../lib/api";
import { formatLongDateFromIso, formatTimeBogota } from "../../lib/dateBogota";
import type { MedicoCallsToday } from "../../types";

const PAGE_SIZE = 5;

export function MedicoTodayCallsPanel({
  token,
  refreshKey = 0,
}: {
  token: string;
  /** Incrementar tras una nueva llamada para recargar la lista. */
  refreshKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MedicoCallsToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMedicoCallsToday(token, { page, limit: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    setPage(1);
  }, [refreshKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totalRecords = data?.total_records ?? 0;
  const fechaLabel = data ? formatLongDateFromIso(data.fecha) : "";

  return (
    <section className="mt-8 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800">Pacientes atendidos hoy</h2>
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            Total hoy: {loading && !data ? "…" : totalRecords}
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-2">
          {fechaLabel && (
            <p className="text-xs text-gray-500 mb-3">{fechaLabel} · hora Colombia</p>
          )}
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Actualizar
            </button>
          </div>

          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          {loading && !data && (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          )}

          {data && data.data.length === 0 && !loading && (
            <p className="text-sm text-gray-500 py-6 text-center">Aún no ha llamado pacientes hoy.</p>
          )}

          {data && data.data.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium">Hora</th>
                      <th className="text-left px-3 py-2.5 font-medium">Paciente</th>
                      <th className="text-left px-3 py-2.5 font-medium">Consultorio</th>
                      <th className="text-left px-3 py-2.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    {data.data.map((row, idx) => (
                      <tr key={`${row.fecha_llamada}-${idx}`} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                          {formatTimeBogota(row.fecha_llamada)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">{row.paciente_nombre}</td>
                        <td className="px-3 py-2.5">{row.consultorio_numero}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={
                              row.estado === "ACTIVA"
                                ? "inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                                : "inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                            }
                          >
                            {row.estado === "ACTIVA" ? "Activa" : "Finalizada"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.total_pages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">
                    Página {data.current_page} de {data.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loading || data.current_page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={loading || data.current_page >= data.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
