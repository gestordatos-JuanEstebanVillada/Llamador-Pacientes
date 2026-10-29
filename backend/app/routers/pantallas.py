from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import require_pantalla
from app.config import get_settings
from app.database import get_db
from app.models.entities import Sala, Usuario
from app.schemas.common import CurrentCallOut, MessageOut
from app.services.call_service import (
    clear_active_calls_for_sala,
    get_pending_calls_for_sala,
)
from app.websocket.manager import sala_manager

router = APIRouter(prefix="/api/pantallas", tags=["pantallas"])


def _llamada_to_out(llamada, ttl: int) -> CurrentCallOut:
    consultorio = llamada.consultorio
    sala_obj = consultorio.sala if consultorio else None
    sede = sala_obj.sede if sala_obj else None
    return CurrentCallOut(
        call_id=llamada.id,
        paciente_nombre=llamada.paciente_nombre,
        consultorio_numero=consultorio.numero if consultorio else "",
        sala_nombre=sala_obj.nombre if sala_obj else "",
        sede_nombre=sede.nombre if sede else "",
        fecha_llamada=llamada.fecha_llamada,
        fecha_expiracion=llamada.fecha_expiracion,
        ttl_seconds=ttl,
    )


def _get_sala_or_404(db: Session, sala_id: int) -> Sala:
    sala = db.query(Sala).filter(Sala.id == sala_id, Sala.activo == 1).first()
    if not sala:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sala no encontrada")
    return sala


@router.get("/{sala_id}/pendientes", response_model=list[CurrentCallOut])
def list_pending_calls(
    sala_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_pantalla),
):
    _get_sala_or_404(db, sala_id)
    ttl = get_settings().call_ttl_seconds
    llamadas = get_pending_calls_for_sala(db, sala_id)
    return [_llamada_to_out(llamada, ttl) for llamada in llamadas]


@router.post("/{sala_id}/limpiar-cola", response_model=MessageOut)
async def limpiar_cola(
    sala_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_pantalla),
):
    _get_sala_or_404(db, sala_id)
    count = clear_active_calls_for_sala(db, sala_id)
    await sala_manager.send_to_sala(sala_id, {"type": "idle"})
    return MessageOut(message=f"Cola limpiada: {count} llamada(s) finalizada(s)")
