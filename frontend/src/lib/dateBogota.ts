export const BOGOTA_TZ = "America/Bogota";

/** Fecha de hoy en Bogotá (YYYY-MM-DD). */
export function todayIsoBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA_TZ }).format(new Date());
}

/** Primer día del mes actual en Bogotá (YYYY-MM-DD). */
export function startOfMonthIsoBogota(): string {
  const today = todayIsoBogota();
  return `${today.slice(0, 7)}-01`;
}

/** Hace ~3 meses calendario desde hoy en Bogotá (YYYY-MM-DD). */
export function threeMonthsAgoIsoBogota(): string {
  const [y, m, d] = todayIsoBogota().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCMonth(dt.getUTCMonth() - 3);
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA_TZ }).format(dt);
}

/** Título largo: "lunes, 26 de octubre de 2026" desde YYYY-MM-DD. */
export function formatLongDateFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const formatted = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(noonUtc);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Timestamps naive UTC del backend → hora Colombia AM/PM. */
export function parseBackendUtc(iso: string): Date {
  if (iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso);
  }
  return new Date(`${iso.replace(" ", "T")}Z`);
}

export function formatTimeBogota(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parseBackendUtc(iso));
}

export function formatHourLabelBogota(hour: number): string {
  const hh = String(hour).padStart(2, "0");
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    hour: "numeric",
    hour12: true,
  }).format(new Date(`2000-01-01T${hh}:00:00-05:00`));
}
