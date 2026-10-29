import math

from sqlalchemy.orm import Session, joinedload

from app.models.entities import Consultorio, Llamada
from app.utils.timezone import day_bounds_utc_naive, today_bogota


def build_medico_calls_today(
    db: Session,
    medico_id: int,
    page: int = 1,
    limit: int = 5,
) -> dict:
    day = today_bogota()
    start_utc, end_utc = day_bounds_utc_naive(day)

    base_q = db.query(Llamada).filter(
        Llamada.medico_id == medico_id,
        Llamada.fecha_llamada >= start_utc,
        Llamada.fecha_llamada < end_utc,
    )

    total_records = base_q.count()
    total_pages = max(1, math.ceil(total_records / limit)) if limit > 0 else 1
    page = max(1, min(page, total_pages))
    offset = (page - 1) * limit

    llamadas = (
        base_q.options(joinedload(Llamada.consultorio))
        .order_by(Llamada.fecha_llamada.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    rows = []
    for ll in llamadas:
        consultorio = ll.consultorio
        rows.append(
            {
                "fecha_llamada": ll.fecha_llamada,
                "paciente_nombre": ll.paciente_nombre,
                "consultorio_numero": consultorio.numero if consultorio else "",
                "estado": ll.estado,
            }
        )

    return {
        "fecha": day.isoformat(),
        "data": rows,
        "total_records": total_records,
        "current_page": page,
        "total_pages": total_pages,
    }
