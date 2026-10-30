export type Rol = "ADMIN" | "MEDICO" | "PANTALLA";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  rol: Rol;
  username: string;
  medico_id: number | null;
}

export interface CurrentCall {
  call_id: number;
  paciente_nombre: string;
  consultorio_numero: string;
  sala_nombre: string;
  sede_nombre: string;
  fecha_llamada: string;
  fecha_expiracion: string;
  ttl_seconds: number;
}

export interface Sede {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Sala {
  id: number;
  sede_id: number;
  nombre: string;
  activo: boolean;
}

export interface Consultorio {
  id: number;
  sala_id: number;
  numero: string;
  descripcion?: string | null;
  activo: boolean;
  sala_nombre?: string;
  sede_id?: number | null;
  sede_nombre?: string;
}

export interface Pantalla {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
}

export interface Medico {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Usuario {
  id: number;
  username: string;
  rol: Rol;
  medico_id: number | null;
  activo: boolean;
}

export interface DashboardMetrics {
  llamadas_hoy: number;
  llamadas_semana: number;
  pantallas_activas: number;
  sedes_activas: number;
  llamadas_por_sede: { sede: string; total: number }[];
}

export interface HourlyCallPoint {
  hour: number;
  label: string;
  total: number;
}

export interface TopDoctorPoint {
  medico_id: number;
  medico_nombre: string;
  total: number;
}

export interface DashboardSummary {
  fecha_referencia: string;
  llamadas_hoy: number;
  llamadas_semana: number;
  pantallas_activas: number;
  medicos_activos_hoy: number;
}

export interface FlujoPorHoraDashboard {
  fecha: string;
  llamadas_por_hora: HourlyCallPoint[];
}

export interface TopMedicosDashboard {
  fecha: string;
  top_medicos: TopDoctorPoint[];
}

export interface DoctorCallRow {
  fecha_llamada: string;
  paciente_nombre: string;
  consultorio_numero: string;
  sala_nombre: string;
  estado: string;
}

export interface MedicoCallTodayRow {
  fecha_llamada: string;
  paciente_nombre: string;
  consultorio_numero: string;
  estado: string;
}

export interface MedicoCallsToday {
  fecha: string;
  data: MedicoCallTodayRow[];
  total_records: number;
  current_page: number;
  total_pages: number;
}

export interface DoctorDashboardDetail {
  medico_id: number;
  medico_nombre: string;
  fecha: string;
  total_records: number;
  current_page: number;
  total_pages: number;
  data: DoctorCallRow[];
}

export interface MedicoProduccionRow {
  medico_id: number;
  medico_nombre: string;
  activo: boolean;
  total_llamadas: number;
  promedio_diario: number;
}

export interface ProduccionDashboard {
  start_date: string;
  end_date: string;
  dias_en_rango: number;
  medicos: MedicoProduccionRow[];
}

export interface PatientCallEvent {
  type: "patient_call";
  call_id: number;
  paciente_nombre: string;
  consultorio_numero: string;
  sala_nombre: string;
  sede_nombre: string;
  fecha_llamada: string;
  fecha_expiracion: string;
  play_audio?: boolean;
}

export type ScreenWsMessage =
  | PatientCallEvent
  | { type: "idle" }
  | { type: "ping" }
  | { type: "pong" };
