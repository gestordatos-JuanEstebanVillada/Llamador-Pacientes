from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models.entities import Consultorio, Llamada, Pantalla, Sala

settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _finalize_active_calls_for_sala(db: Session, sala_id: int, now: datetime) -> int:
    active = (
        db.query(Llamada)
        .join(Consultorio, Llamada.consultorio_id == Consultorio.id)
        .filter(Consultorio.sala_id == sala_id, Llamada.estado == "ACTIVA")
        .all()
    )
    for call in active:
        call.estado = "FINALIZADA"
        call.fecha_finalizacion = now
    return len(active)


def clear_active_calls_for_sala(db: Session, sala_id: int) -> int:
    """Finaliza todas las llamadas ACTIVA de la sala (sin DELETE)."""
    now = _utcnow()
    count = _finalize_active_calls_for_sala(db, sala_id, now)
    if count:
        db.commit()
    return count


PENDING_RECOVERY_MINUTES = 30


def get_pending_calls_for_sala(db: Session, sala_id: int) -> list[Llamada]:
    """Llamadas ACTIVA no expiradas o creadas en los últimos 30 minutos (FIFO)."""
    finalize_expired_active_calls_for_sala(db, sala_id)
    now = _utcnow()
    cutoff = now - timedelta(minutes=PENDING_RECOVERY_MINUTES)
    return (
        db.query(Llamada)
        .join(Consultorio, Llamada.consultorio_id == Consultorio.id)
        .options(
            joinedload(Llamada.consultorio).joinedload(Consultorio.sala).joinedload(Sala.sede),
        )
        .filter(
            Consultorio.sala_id == sala_id,
            Llamada.estado == "ACTIVA",
            or_(Llamada.fecha_expiracion > now, Llamada.fecha_llamada >= cutoff),
        )
        .order_by(Llamada.fecha_llamada.asc())
        .all()
    )


def finalize_expired_active_calls_for_sala(db: Session, sala_id: int) -> None:
    now = _utcnow()
    expired = (
        db.query(Llamada)
        .join(Consultorio, Llamada.consultorio_id == Consultorio.id)
        .filter(
            Consultorio.sala_id == sala_id,
            Llamada.estado == "ACTIVA",
            Llamada.fecha_expiracion <= now,
        )
        .all()
    )
    changed = False
    for call in expired:
        call.estado = "FINALIZADA"
        call.fecha_finalizacion = now
        changed = True
    if changed:
        db.commit()


def get_current_call_for_sala(db: Session, sala_id: int) -> Llamada | None:
    finalize_expired_active_calls_for_sala(db, sala_id)
    now = _utcnow()
    return (
        db.query(Llamada)
        .join(Consultorio, Llamada.consultorio_id == Consultorio.id)
        .options(
            joinedload(Llamada.consultorio).joinedload(Consultorio.sala).joinedload(Sala.sede),
        )
        .filter(
            Consultorio.sala_id == sala_id,
            Llamada.estado == "ACTIVA",
            Llamada.fecha_expiracion > now,
        )
        .order_by(Llamada.fecha_llamada.desc())
        .first()
    )


def resolve_pantalla_for_consultorio(db: Session, consultorio_id: int) -> tuple[Pantalla, Consultorio]:
    consultorio = (
        db.query(Consultorio)
        .options(joinedload(Consultorio.sala).joinedload(Sala.pantalla))
        .filter(Consultorio.id == consultorio_id, Consultorio.activo == 1)
        .first()
    )
    if not consultorio:
        raise ValueError("Consultorio no encontrado o inactivo")
    sala = consultorio.sala
    if not sala or sala.activo != 1:
        raise ValueError("Sala inactiva")
    pantalla = sala.pantalla if sala else None
    if not pantalla or pantalla.activo != 1:
        pantalla = (
            db.query(Pantalla)
            .filter(Pantalla.activo == 1)
            .order_by(Pantalla.id)
            .first()
        )
    if not pantalla:
        raise ValueError(
            "No hay pantalla activa registrada. Registre al menos una pantalla en el panel admin."
        )
    return pantalla, consultorio


def create_patient_call(
    db: Session,
    consultorio_id: int,
    paciente_nombre: str,
    medico_id: int | None,
) -> Llamada:
    pantalla, consultorio = resolve_pantalla_for_consultorio(db, consultorio_id)
    sala_id = consultorio.sala_id
    now = _utcnow()
    ttl = timedelta(seconds=settings.call_ttl_seconds)

    _finalize_active_calls_for_sala(db, sala_id, now)

    llamada = Llamada(
        pantalla_id=pantalla.id,
        consultorio_id=consultorio.id,
        medico_id=medico_id,
        paciente_nombre=paciente_nombre.strip(),
        estado="ACTIVA",
        fecha_llamada=now,
        fecha_expiracion=now + ttl,
    )
    db.add(llamada)
    db.commit()
    db.refresh(llamada)
    return llamada


def call_to_ws_payload(llamada: Llamada) -> dict:
    consultorio = llamada.consultorio
    sala = consultorio.sala if consultorio else None
    sede = sala.sede if sala else None
    return {
        "type": "patient_call",
        "call_id": llamada.id,
        "paciente_nombre": llamada.paciente_nombre,
        "consultorio_numero": consultorio.numero if consultorio else "",
        "sala_nombre": sala.nombre if sala else "",
        "sede_nombre": sede.nombre if sede else "",
        "sala_id": sala.id if sala else None,
        "fecha_llamada": llamada.fecha_llamada.isoformat(),
        "fecha_expiracion": llamada.fecha_expiracion.isoformat(),
        "play_audio": True,
    }
