import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, CalendarDays, Monitor, PhoneCall, Stethoscope } from "lucide-react";

import { ProduccionMedicosPanel } from "./ProduccionMedicosPanel";
import { api } from "../../lib/api";
import {
  formatHourLabelBogota,
  formatLongDateFromIso,
  formatTimeBogota,
  todayIsoBogota,
} from "../../lib/dateBogota";
import type {
  DashboardSummary,
  DoctorDashboardDetail,
  HourlyCallPoint,
  Medico,
  Sala,
  Sede,
  TopDoctorPoint,
} from "../../types";

type ChartFilters = {
  fecha: string;
  sedeId: number | "";
  salaId: number | "";
};

function defaultChartFilters(): ChartFilters {
  return { fecha: todayIsoBogota(), sedeId: "", salaId: "" };
}

function chartFiltersToParams(filters: ChartFilters) {
  return {
    fecha: filters.fecha,
    sedeId: filters.sedeId === "" ? undefined : filters.sedeId,
    salaId: filters.salaId === "" ? undefined : filters.salaId,
  };
}

const ROSE = "#e11d48";
const DOCTOR_PAGE_SIZE = 15;

const selectClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200/80 ${className}`} />;
}

function ChartFiltersBar({
  filters,
  onChange,
  sedes,
  salas,
}: {
  filters: ChartFilters;
  onChange: (next: ChartFilters) => void;
  sedes: Sede[];
  salas: Sala[];
}) {
  const salasForSede =
    filters.sedeId === "" ? [] : salas.filter((s) => s.sede_id === filters.sedeId && s.activo);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-slate-50/50 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-800">
          Fecha
          <input
            type="date"
            className={selectClass}
            value={filters.fecha}
            onChange={(e) => onChange({ ...filters, fecha: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-slate-800">
          Sede
          <select
            className={selectClass}
            value={filters.sedeId}
            onChange={(e) => {
              const sedeId = e.target.value ? Number(e.target.value) : "";
              onChange({ ...filters, sedeId, salaId: "" });
            }}
          >
            <option value="">Todas</option>
            {sedes.filter((s) => s.activo).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-800">
          Sala / Piso
          <select
            className={`${selectClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
            value={filters.salaId}
            disabled={filters.sedeId === ""}
            onChange={(e) =>
              onChange({
                ...filters,
                salaId: e.target.value ? Number(e.target.value) : "",
              })
            }
          >
            <option value="">
              {filters.sedeId === "" ? "Seleccione una sede" : "Todas en esta sede"}
            </option>
            {salasForSede.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-800">{value}</p>
        </div>
        <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600">{icon}</div>
      </div>
    </div>
  );
}

export function AdminDashboard({
  token,
  medicos,
  sedes,
  salas,
}: {
  token: string;
  medicos: Medico[];
  sedes: Sede[];
  salas: Sala[];
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [filtersFlujo, setFiltersFlujo] = useState<ChartFilters>(defaultChartFilters);
  const [filtersTop, setFiltersTop] = useState<ChartFilters>(defaultChartFilters);
  const [flujoSeries, setFlujoSeries] = useState<HourlyCallPoint[]>([]);
  const [topMedicos, setTopMedicos] = useState<TopDoctorPoint[]>([]);
  const [flujoLoading, setFlujoLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [flujoError, setFlujoError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  const [selectedMedicoId, setSelectedMedicoId] = useState<number | "">("");
  const [activityDate, setActivityDate] = useState(todayIsoBogota);
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorDetail, setDoctorDetail] = useState<DoctorDashboardDetail | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);

  const loadKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      const data = await api.getDashboardSummary(token);
      setSummary(data);
    } catch (e) {
      setKpiError(e instanceof Error ? e.message : "Error cargando KPIs");
    } finally {
      setKpiLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    let cancelled = false;
    setFlujoLoading(true);
    setFlujoError(null);
    void api
      .getDashboardFlujoPorHora(token, chartFiltersToParams(filtersFlujo))
      .then((data) => {
        if (!cancelled) setFlujoSeries(data.llamadas_por_hora);
      })
      .catch((e) => {
        if (!cancelled) {
          setFlujoError(e instanceof Error ? e.message : "Error cargando flujo");
          setFlujoSeries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFlujoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, filtersFlujo]);

  useEffect(() => {
    let cancelled = false;
    setTopLoading(true);
    setTopError(null);
    void api
      .getDashboardTopMedicos(token, chartFiltersToParams(filtersTop))
      .then((data) => {
        if (!cancelled) setTopMedicos(data.top_medicos);
      })
      .catch((e) => {
        if (!cancelled) {
          setTopError(e instanceof Error ? e.message : "Error cargando Top 5");
          setTopMedicos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTopLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, filtersTop]);

  useEffect(() => {
    setDoctorPage(1);
  }, [selectedMedicoId, activityDate]);

  useEffect(() => {
    if (selectedMedicoId === "") {
      setDoctorDetail(null);
      return;
    }
    let cancelled = false;
    setDoctorLoading(true);
    void api
      .getDoctorDashboard(token, selectedMedicoId, {
        fecha: activityDate,
        page: doctorPage,
        limit: DOCTOR_PAGE_SIZE,
      })
      .then((data) => {
        if (!cancelled) setDoctorDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDoctorDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDoctorLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMedicoId, activityDate, doctorPage, token]);

  const flujoDateLabel = formatLongDateFromIso(filtersFlujo.fecha);
  const topDateLabel = formatLongDateFromIso(filtersTop.fecha);
  const kpiDateLabel = formatLongDateFromIso(todayIsoBogota());

  const lineData = useMemo(() => {
    return flujoSeries
      .filter((p) => p.hour >= 6 && p.hour <= 20)
      .map((p) => ({
        ...p,
        label: formatHourLabelBogota(p.hour),
      }));
  }, [flujoSeries]);

  const barData = topMedicos;

  if (kpiLoading && !summary) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  if (kpiError || !summary) {
    return (
      <div className="rounded-xl border border-red-100 bg-white p-6 text-red-600 shadow-sm">
        {kpiError ?? "No hay datos del dashboard"}
        <button
          type="button"
          onClick={() => void loadKpis()}
          className="ml-4 text-sm text-rose-600 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Panel de control</h2>
        <p className="text-sm text-gray-500 mt-1">
          KPIs al {kpiDateLabel} · hora Colombia
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Llamadas hoy"
          value={summary.llamadas_hoy}
          icon={<PhoneCall className="h-5 w-5" aria-hidden />}
        />
        <KpiCard
          title="Llamadas semana"
          value={summary.llamadas_semana}
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
        <KpiCard
          title="Pantallas activas"
          value={summary.pantallas_activas}
          icon={<Monitor className="h-5 w-5" aria-hidden />}
        />
        <KpiCard
          title="Médicos activos hoy"
          value={summary.medicos_activos_hoy}
          icon={<Stethoscope className="h-5 w-5" aria-hidden />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm relative">
          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Flujo de llamadas por hora
          </h3>
          <p className="text-xs text-gray-500 mb-2">{flujoDateLabel} · America/Bogota</p>
          <ChartFiltersBar
            filters={filtersFlujo}
            onChange={setFiltersFlujo}
            sedes={sedes}
            salas={salas}
          />
          {flujoError && (
            <p className="mb-2 text-xs text-red-600">{flujoError}</p>
          )}
          {flujoLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 text-sm text-gray-500">
              Actualizando…
            </div>
          )}
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid #f1f5f9",
                    fontSize: "0.875rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Llamadas"
                  stroke={ROSE}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: ROSE, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm relative">
          <h3 className="text-base font-semibold text-slate-800">Top 5 médicos con más llamados</h3>
          <p className="text-xs text-gray-500 mt-1 mb-2">{topDateLabel}</p>
          <ChartFiltersBar
            filters={filtersTop}
            onChange={setFiltersTop}
            sedes={sedes}
            salas={salas}
          />
          {topError && <p className="mb-2 text-xs text-red-600">{topError}</p>}
          <div className="h-72 w-full relative">
            {topLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-gray-500">
                Actualizando…
              </div>
            )}
            {barData.length === 0 ? (
              <p className="text-sm text-gray-500 py-16 text-center">Sin llamadas para este filtro</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="medico_nombre"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid #f1f5f9",
                      fontSize: "0.875rem",
                    }}
                  />
                  <Bar dataKey="total" name="Llamadas" fill={ROSE} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <ProduccionMedicosPanel token={token} />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-800">Actividad por médico</h3>
            <p className="text-xs text-gray-500 mt-1">Más recientes primero</p>
            <p className="text-sm text-gray-500 mt-1">Detalle paginado por día (Colombia)</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[640px]">
            <label className="text-xs text-gray-600">
              Médico
              <select
                className={selectClass}
                value={selectedMedicoId}
                onChange={(e) =>
                  setSelectedMedicoId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Filtrar actividad por Médico…</option>
                {medicos
                  .filter((m) => m.activo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Fecha
              <input
                type="date"
                className={selectClass}
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
              />
            </label>
          </div>
        </div>

        {selectedMedicoId === "" && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Building2 className="h-10 w-10 mb-3 opacity-60" aria-hidden />
            <p className="text-sm">Seleccione un médico y una fecha</p>
          </div>
        )}

        {selectedMedicoId !== "" && doctorLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-12" />
            ))}
          </div>
        )}

        {selectedMedicoId !== "" && !doctorLoading && doctorDetail && (
          <div>
            <div className="mb-4 flex flex-wrap items-baseline gap-2 border-b border-gray-100 pb-4">
              <p className="text-lg font-semibold text-slate-800">{doctorDetail.medico_nombre}</p>
              <span className="text-sm text-gray-500">
                · {doctorDetail.total_records} registro(s) ·{" "}
                {formatLongDateFromIso(doctorDetail.fecha)}
              </span>
            </div>

            {doctorDetail.data.length === 0 ? (
              <p className="text-sm text-gray-500">Sin llamadas en esta fecha.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-3 font-medium">Hora (CO)</th>
                        <th className="text-left px-3 py-3 font-medium">Paciente</th>
                        <th className="text-left px-3 py-3 font-medium">Consultorio</th>
                        <th className="text-left px-3 py-3 font-medium">Sala</th>
                        <th className="text-left px-3 py-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-800">
                      {doctorDetail.data.map((row, idx) => (
                        <tr key={`${row.fecha_llamada}-${idx}`} className="border-b border-gray-100">
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            {formatTimeBogota(row.fecha_llamada)}
                          </td>
                          <td className="px-3 py-2.5 font-medium">{row.paciente_nombre}</td>
                          <td className="px-3 py-2.5">{row.consultorio_numero}</td>
                          <td className="px-3 py-2.5">{row.sala_nombre}</td>
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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">
                    Página {doctorDetail.current_page} de {doctorDetail.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={doctorDetail.current_page <= 1}
                      onClick={() => setDoctorPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={doctorDetail.current_page >= doctorDetail.total_pages}
                      onClick={() => setDoctorPage((p) => p + 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
