import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";

import { loadStoredAuthSession } from "../../constants/storage";
import { api } from "../../lib/api";
import { formatLongDateFromIso } from "../../lib/dateBogota";
import type { CitasHoy } from "../../types";

function estadoLabel(citest: string): string {
  if (citest === "T") return "En turno";
  if (citest === "P") return "Pendiente";
  return citest;
}

function resolveAuthToken(explicit: string | null | undefined): string | null {
  if (explicit) return explicit;
  return loadStoredAuthSession()?.token ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface MedicoAgendaHoyPanelProps {
  token: string | null;
  username: string | null;
  /** Solo rol MEDICO puede consultar la agenda Oracle. */
  fetchEnabled: boolean;
  onSelectPatient?: (nombre: string) => void;
  refreshKey?: number;
}

export function MedicoAgendaHoyPanel({
  token,
  username,
  fetchEnabled,
  onSelectPatient,
  refreshKey = 0,
}: MedicoAgendaHoyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<CitasHoy | null>(null);
  const [loading, setLoading] = useState(fetchEnabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fetchEnabled) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const authToken = resolveAuthToken(token);
    if (!authToken) {
      setLoading(false);
      setError("Sesión no disponible. Use Reintentar en un momento.");
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const run = async (bearer: string) => api.getMedicoCitasHoy(bearer);

    try {
      const res = await run(authToken);
      setData(res);
      setError(null);
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : "No se pudo cargar la agenda";
      await sleep(600);
      const retryToken = resolveAuthToken(token);
      if (retryToken) {
        try {
          const resRetry = await run(retryToken);
          setData(resRetry);
          setError(null);
          return;
        } catch {
          /* segundo intento fallido → mostrar error del primero */
        }
      }
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, username, fetchEnabled]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totalCitas = data?.data.length ?? 0;
  const fechaLabel = data?.fecha ? formatLongDateFromIso(data.fecha) : "";

  const badgeTotal =
    loading && !data ? "…" : fetchEnabled ? String(totalCitas) : "—";

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
            Total hoy: {badgeTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void load();
            }}
            disabled={loading || !fetchEnabled}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title="Actualizar agenda"
            aria-label="Actualizar agenda"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          </button>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-3">
          {!fetchEnabled && (
            <p className="py-4 text-center text-sm text-slate-500">
              La agenda del día está disponible solo para cuentas con rol médico.
            </p>
          )}

          {fetchEnabled && loading && !data && !error && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-rose-600" aria-hidden />
              Cargando citas agendadas hoy…
            </div>
          )}

          {fetchEnabled && error && (
            <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm text-rose-800">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 text-sm font-medium text-rose-700 underline hover:text-rose-800"
              >
                Reintentar
              </button>
            </div>
          )}

          {fetchEnabled && data && !loading && !error && data.data.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              No tienes citas agendadas para hoy
            </p>
          )}

          {fetchEnabled && data && data.data.length > 0 && (
            <>
              {fechaLabel && <p className="text-xs text-gray-500 mb-3">{fechaLabel} · Colombia</p>}
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
              {onSelectPatient && (
                <p className="mt-3 text-xs text-slate-500">Toque un nombre para copiarlo al campo de llamada.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}