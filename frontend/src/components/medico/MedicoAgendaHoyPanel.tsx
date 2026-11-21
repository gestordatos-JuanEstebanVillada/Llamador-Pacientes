import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";

import { api } from "../../lib/api";
import { formatLongDateFromIso } from "../../lib/dateBogota";
import type { CitasHoy } from "../../types";

function estadoLabel(citest: string): string {
  if (citest === "T") return "En turno";
  if (citest === "P") return "Pendiente";
  return citest;
}

interface MedicoAgendaHoyPanelProps {
  token: string;
  onSelectPatient?: (nombre: string) => void;
  refreshKey?: number;
}

export function MedicoAgendaHoyPanel({
  token,
  onSelectPatient,
  refreshKey = 0,
}: MedicoAgendaHoyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<CitasHoy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMedicoCitasHoy(token);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la agenda");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totalCitas = data?.data.length ?? 0;
  const fechaLabel = data?.fecha ? formatLongDateFromIso(data.fecha) : "";

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800">Citas agendadas hoy</h2>
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            Total hoy: {loading && !data ? "…" : totalCitas}
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-2">
          {fechaLabel && <p className="text-xs text-gray-500 mb-3">{fechaLabel} · Colombia</p>}
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

          {data && data.data.length === 0 && !loading && !error && (
            <p className="text-sm text-gray-500 py-6 text-center">No hay citas para hoy con estado T o P.</p>
          )}

          {data && data.data.length > 0 && (
            <div className="max-h-[520px] overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 z-[1]">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium">Hora</th>
                    <th className="text-left px-3 py-2.5 font-medium">Paciente</th>
                    <th className="text-left px-3 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {data.data.map((row, idx) => (
                    <tr key={`${row.citcar ?? idx}-${row.hora}-${idx}`} className="border-t border-gray-100">
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{row.hora}</td>
                      <td className="px-3 py-2.5">
                        {onSelectPatient && row.nombre ? (
                          <button
                            type="button"
                            onClick={() => onSelectPatient(row.nombre)}
                            className="text-left font-medium text-rose-700 hover:text-rose-800 hover:underline"
                            title="Usar este nombre para llamar"
                          >
                            {row.nombre}
                          </button>
                        ) : (
                          <span className="font-medium">{row.nombre || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {estadoLabel(row.citest)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {onSelectPatient && data && data.data.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">Toque un nombre para copiarlo al campo de llamada.</p>
          )}
        </div>
      )}
    </section>
  );
}