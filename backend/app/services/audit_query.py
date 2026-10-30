import math
from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.models.entities import Auditoria
def bogota_day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


def list_auditoria(
    db: Session,
    *,
    rol: str | None = None,
    usuario_id: int | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    page: int = 1,
    limit: int = 25,
) -> dict:
    q = db.query(Auditoria)
    if rol:
        q = q.filter(Auditoria.rol_usuario == rol.upper())
    if usuario_id is not None:
        q = q.filter(Auditoria.usuario_id == usuario_id)
    if fecha_inicio:
        start, _ = bogota_day_bounds(fecha_inicio)
        q = q.filter(Auditoria.fecha >= start)
    if fecha_fin:
        _, end = bogota_day_bounds(fecha_fin)
        q = q.filter(Auditoria.fecha <= end)

    total_records = q.count()
    total_pages = max(1, math.ceil(total_records / limit)) if limit > 0 else 1
    page = max(1, min(page, total_pages))
    offset = (page - 1) * limit

    rows = (
        q.order_by(Auditoria.fecha.desc(), Auditoria.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "data": rows,
        "total_records": total_records,
        "current_page": page,
        "total_pages": total_pages,
    }
