import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { api } from "../../lib/api";
import {
  formatLongDateFromIso,
  startOfMonthIsoBogota,
  threeMonthsAgoIsoBogota,
  todayIsoBogota,
} from "../../lib/dateBogota";
import type { ProduccionDashboard } from "../../types";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none";

type Preset = "hoy" | "mes" | "tres_meses";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200/80 ${className}`} />;
}

export function ProduccionMedicosPanel({ token }: { token: string }) {
  const [startDate, setStartDate] = useState(todayIsoBogota());
  const [endDate, setEndDate] = useState(todayIsoBogota());
  const [preset, setPreset] = useState<Preset>("hoy");
  const [data, setData] = useState<ProduccionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (p: Preset) => {
    const today = todayIsoBogota();
    setPreset(p);
    if (p === "hoy") {
      setStartDate(today);
      setEndDate(today);
    } else if (p === "mes") {
      setStartDate(startOfMonthIsoBogota());
      setEndDate(today);
    } else {
      setStartDate(threeMonthsAgoIsoBogota());
      setEndDate(today);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProduccionDashboard(token, { startDate, endDate });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando producción");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const presetBtn = (id: Preset, label: string) => (
    <button
      type="button"
      onClick={() => applyPreset(id)}
      className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
        preset === id
          ? "border-rose-600 bg-rose-50 text-rose-700 font-medium"
          : "border-gray-200 bg-white text-gray-600 hover:border-rose-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Producción de Médicos</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Totales y promedio diario por rango (hora Colombia)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">{presetBtn("hoy", "Hoy")}{presetBtn("mes", "Este mes")}{presetBtn("tres_meses", "Últimos 3 meses")}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <label className="text-xs text-gray-600">
          Fecha inicio
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => {
              setPreset("hoy");
              setStartDate(e.target.value);
            }}
          />
        </label>
        <label className="text-xs text-gray-600">
          Fecha fin
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => {
              setPreset("hoy");
              setEndDate(e.target.value);
            }}
          />
        </label>
      </div>

      {data && !loading && (
        <p className="text-xs text-gray-500 mb-4">
          Período: {formatLongDateFromIso(data.start_date)} — {formatLongDateFromIso(data.end_date)} ·{" "}
          {data.dias_en_rango} día(s) en el rango
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-4">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 text-rose-600 underline">
            Reintentar
          </button>
        </p>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-11" />
          ))}
        </div>
      )}

      {!loading && data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-3 font-medium">Médico</th>
                <th className="text-right px-3 py-3 font-medium">Total llamadas</th>
                <th className="text-right px-3 py-3 font-medium">Promedio diario</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {data.medicos.map((row) => (
                <tr key={row.medico_id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{row.medico_nombre}</span>
                    {!row.activo && (
                      <span className="ml-2 text-xs text-gray-400">(inactivo)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">
                    {row.total_llamadas}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                    {row.promedio_diario.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
