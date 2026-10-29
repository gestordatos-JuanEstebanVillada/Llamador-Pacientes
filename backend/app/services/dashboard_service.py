import math
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.entities import Consultorio, Llamada, Medico, Pantalla, Sala
from app.utils.timezone import (
    bogota_hour_from_utc_naive,
    day_bounds_utc_naive,
    days_inclusive,
    range_bounds_utc_naive,
    today_bogota,
    week_start_utc_naive,
)


def _apply_sede_sala_filter(q, sede_id: int | None, sala_id: int | None):
    if sede_id is None and sala_id is None:
        return q
    q = q.join(Consultorio, Llamada.consultorio_id == Consultorio.id)
    if sala_id is not None:
        return q.filter(Consultorio.sala_id == sala_id)
    if sede_id is not None:
        return q.join(Sala, Consultorio.sala_id == Sala.id).filter(Sala.sede_id == sede_id)
    return q


def build_top_medicos(
    db: Session,
    day: date,
    sede_id: int | None = None,
    sala_id: int | None = None,
) -> list[dict]:
    start_utc, end_utc = day_bounds_utc_naive(day)
    q = (
        db.query(Medico.id, Medico.nombre, func.count(Llamada.id).label("total"))
        .join(Llamada, Llamada.medico_id == Medico.id)
        .filter(Llamada.fecha_llamada >= start_utc, Llamada.fecha_llamada < end_utc)
    )
    q = _apply_sede_sala_filter(q, sede_id, sala_id)
    top_rows = (
        q.group_by(Medico.id, Medico.nombre)
        .order_by(func.count(Llamada.id).desc())
        .limit(5)
        .all()
    )
    return [
        {"medico_id": int(mid), "medico_nombre": nombre, "total": int(total)}
        for mid, nombre, total in top_rows
    ]


def build_llamadas_por_hora(
    db: Session,
    day: date,
    sede_id: int | None = None,
    sala_id: int | None = None,
) -> list[dict]:
    chart_start_utc, chart_end_utc = day_bounds_utc_naive(day)
    hour_q = db.query(Llamada.fecha_llamada).filter(
        Llamada.fecha_llamada >= chart_start_utc,
        Llamada.fecha_llamada < chart_end_utc,
    )
    hour_q = _apply_sede_sala_filter(hour_q, sede_id, sala_id)
    timestamps = [row[0] for row in hour_q.all()]
    hour_map: dict[int, int] = {}
    for ts in timestamps:
        h = bogota_hour_from_utc_naive(ts)
        hour_map[h] = hour_map.get(h, 0) + 1

    return [
        {"hour": hour, "label": f"{hour:02d}", "total": hour_map.get(hour, 0)}
        for hour in range(24)
    ]


def build_dashboard_summary(db: Session) -> dict:
    today = today_bogota()
    start_utc, end_utc = day_bounds_utc_naive(today)
    week_start = week_start_utc_naive(today)

    llamadas_hoy = (
        db.query(func.count(Llamada.id))
        .filter(Llamada.fecha_llamada >= start_utc, Llamada.fecha_llamada < end_utc)
        .scalar()
        or 0
    )
    llamadas_semana = (
        db.query(func.count(Llamada.id))
        .filter(Llamada.fecha_llamada >= week_start, Llamada.fecha_llamada < end_utc)
        .scalar()
        or 0
    )
    pantallas_activas = (
        db.query(func.count(Pantalla.id)).filter(Pantalla.activo == 1).scalar() or 0
    )
    medicos_activos_hoy = (
        db.query(func.count(func.distinct(Llamada.medico_id)))
        .filter(
            Llamada.fecha_llamada >= start_utc,
            Llamada.fecha_llamada < end_utc,
            Llamada.medico_id.isnot(None),
        )
        .scalar()
        or 0
    )

    return {
        "fecha_referencia": today.isoformat(),
        "llamadas_hoy": int(llamadas_hoy),
        "llamadas_semana": int(llamadas_semana),
        "pantallas_activas": int(pantallas_activas),
        "medicos_activos_hoy": int(medicos_activos_hoy),
    }


def build_doctor_day_detail(
    db: Session,
    medico_id: int,
    fecha: date,
    page: int = 1,
    limit: int = 15,
) -> dict | None:
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        return None

    start_utc, end_utc = day_bounds_utc_naive(fecha)
    base_q = (
        db.query(Llamada)
        .options(joinedload(Llamada.consultorio).joinedload(Consultorio.sala))
        .filter(
            Llamada.medico_id == medico_id,
            Llamada.fecha_llamada >= start_utc,
            Llamada.fecha_llamada < end_utc,
        )
    )

    total_records = base_q.count()
    total_pages = max(1, math.ceil(total_records / limit)) if limit > 0 else 1
    page = max(1, min(page, total_pages))
    offset = (page - 1) * limit

    llamadas = (
        base_q.order_by(Llamada.fecha_llamada.desc()).offset(offset).limit(limit).all()
    )

    rows = []
    for ll in llamadas:
        consultorio = ll.consultorio
        sala = consultorio.sala if consultorio else None
        rows.append(
            {
                "fecha_llamada": ll.fecha_llamada,
                "paciente_nombre": ll.paciente_nombre,
                "consultorio_numero": consultorio.numero if consultorio else "",
                "sala_nombre": sala.nombre if sala else "",
                "estado": ll.estado,
            }
        )

    return {
        "medico_id": medico.id,
        "medico_nombre": medico.nombre,
        "fecha": fecha.isoformat(),
        "total_records": total_records,
        "current_page": page,
        "total_pages": total_pages,
        "data": rows,
    }


def build_produccion_medicos(db: Session, start: date, end: date) -> dict:
    start_utc, end_utc = range_bounds_utc_naive(start, end)
    dias = days_inclusive(start, end)

    count_rows = (
        db.query(Llamada.medico_id, func.count(Llamada.id))
        .filter(
            Llamada.fecha_llamada >= start_utc,
            Llamada.fecha_llamada < end_utc,
            Llamada.medico_id.isnot(None),
        )
        .group_by(Llamada.medico_id)
        .all()
    )
    totals_by_medico = {int(mid): int(total) for mid, total in count_rows if mid is not None}

    medicos = db.query(Medico).order_by(Medico.nombre.asc()).all()
    rows = []
    for medico in medicos:
        total = totals_by_medico.get(medico.id, 0)
        promedio = round(total / dias, 2) if dias > 0 else 0.0
        rows.append(
            {
                "medico_id": medico.id,
                "medico_nombre": medico.nombre,
                "activo": medico.activo == 1,
                "total_llamadas": total,
                "promedio_diario": promedio,
            }
        )

    rows.sort(key=lambda r: (-r["total_llamadas"], r["medico_nombre"]))

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "dias_en_rango": dias,
        "medicos": rows,
    }
