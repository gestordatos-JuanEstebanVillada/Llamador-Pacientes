from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas.common import CurrentCallOut
from app.services.call_service import get_current_call, get_pantalla_by_id_or_code

router = APIRouter(prefix="/api/screens", tags=["screens"])


@router.get("/{screen_id}/current-call", response_model=CurrentCallOut | None)
def current_call(screen_id: str, db: Session = Depends(get_db)):
    """
    Devuelve únicamente la llamada vigente (ACTIVA y no expirada).
    Al reconectar la pantalla, usar este endpoint — no reproducir historial.
    """
    pantalla = get_pantalla_by_id_or_code(db, screen_id)
    if not pantalla:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pantalla no encontrada")

    llamada = get_current_call(db, pantalla)
    if not llamada:
        return None

    consultorio = llamada.consultorio
    sala = consultorio.sala
    sede = sala.sede if sala else None
    ttl = get_settings().call_ttl_seconds

    return CurrentCallOut(
        call_id=llamada.id,
        paciente_nombre=llamada.paciente_nombre,
        consultorio_numero=consultorio.numero,
        sala_nombre=sala.nombre if sala else "",
        sede_nombre=sede.nombre if sede else "",
        fecha_llamada=llamada.fecha_llamada,
        fecha_expiracion=llamada.fecha_expiracion,
        ttl_seconds=ttl,
    )
