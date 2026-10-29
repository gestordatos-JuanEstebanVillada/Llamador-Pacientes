from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import require_pantalla
from app.config import get_settings
from app.database import get_db
from app.models.entities import Sala, Usuario
from app.schemas.common import CurrentCallOut
from app.services.call_service import get_current_call_for_sala

router = APIRouter(prefix="/api/salas", tags=["salas-pantalla"])


@router.get("/{sala_id}/current-call", response_model=CurrentCallOut | None)
def current_call_for_sala(
    sala_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_pantalla),
):
    sala = db.query(Sala).filter(Sala.id == sala_id, Sala.activo == 1).first()
    if not sala:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sala no encontrada")

    llamada = get_current_call_for_sala(db, sala_id)
    if not llamada:
        return None

    consultorio = llamada.consultorio
    sala_obj = consultorio.sala
    sede = sala_obj.sede if sala_obj else None
    ttl = get_settings().call_ttl_seconds

    return CurrentCallOut(
        call_id=llamada.id,
        paciente_nombre=llamada.paciente_nombre,
        consultorio_numero=consultorio.numero,
        sala_nombre=sala_obj.nombre if sala_obj else "",
        sede_nombre=sede.nombre if sede else "",
        fecha_llamada=llamada.fecha_llamada,
        fecha_expiracion=llamada.fecha_expiracion,
        ttl_seconds=ttl,
    )
