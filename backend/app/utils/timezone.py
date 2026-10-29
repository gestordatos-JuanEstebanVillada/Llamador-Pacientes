"""Utilidades de zona horaria — operación en America/Bogota."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

BOGOTA_TZ = ZoneInfo("America/Bogota")
UTC = ZoneInfo("UTC")

# Las fechas en Oracle se almacenan como TIMESTAMP naive en UTC.
DB_STORES_UTC_NAIVE = True


def now_bogota() -> datetime:
    return datetime.now(BOGOTA_TZ)


def today_bogota() -> date:
    return now_bogota().date()


def parse_fecha_param(fecha: str | None) -> date:
    if not fecha:
        return today_bogota()
    return date.fromisoformat(fecha)


def parse_date_range(start_date: str | None, end_date: str | None) -> tuple[date, date]:
    today = today_bogota()
    end = parse_fecha_param(end_date) if end_date else today
    start = parse_fecha_param(start_date) if start_date else end
    if start > end:
        start, end = end, start
    return start, end


def days_inclusive(start: date, end: date) -> int:
    return (end - start).days + 1


def range_bounds_utc_naive(start: date, end: date) -> tuple[datetime, datetime]:
    """Rango [start, end] inclusive en Bogotá → [start_utc, end_utc_exclusive)."""
    start_utc, _ = day_bounds_utc_naive(start)
    _, end_utc = day_bounds_utc_naive(end)
    return start_utc, end_utc


def day_bounds_utc_naive(day: date) -> tuple[datetime, datetime]:
    """Inicio (inclusive) y fin (exclusive) del día en Bogotá, como naive UTC para la BD."""
    start_bogota = datetime.combine(day, time.min, tzinfo=BOGOTA_TZ)
    end_bogota = start_bogota + timedelta(days=1)
    if DB_STORES_UTC_NAIVE:
        start = start_bogota.astimezone(UTC).replace(tzinfo=None)
        end = end_bogota.astimezone(UTC).replace(tzinfo=None)
        return start, end
    start = start_bogota.replace(tzinfo=None)
    end = end_bogota.replace(tzinfo=None)
    return start, end


def week_start_utc_naive(day: date) -> datetime:
    """Lunes de la semana del día dado (Bogotá), inicio en naive UTC."""
    weekday = day.weekday()
    monday = day - timedelta(days=weekday)
    start, _ = day_bounds_utc_naive(monday)
    return start


def utc_naive_to_bogota(dt: datetime) -> datetime:
    if DB_STORES_UTC_NAIVE:
        return dt.replace(tzinfo=UTC).astimezone(BOGOTA_TZ)
    return dt.replace(tzinfo=BOGOTA_TZ)


def bogota_hour_from_utc_naive(dt: datetime) -> int:
    return utc_naive_to_bogota(dt).hour
