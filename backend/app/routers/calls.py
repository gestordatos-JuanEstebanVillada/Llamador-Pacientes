from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import require_medico
from app.config import get_settings
from app.database import get_db
from app.models.entities import Consultorio, Llamada, Sala, Usuario
from app.schemas.common import CallCreate, CurrentCallOut
from app.services.call_service import call_to_ws_payload, create_patient_call
from app.websocket.manager import sala_manager

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.post("", response_model=CurrentCallOut)
async def create_call(
    body: CallCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_medico),
):
    medico_id = user.medico_id
    try:
        llamada = create_patient_call(db, body.consultorio_id, body.paciente_nombre, medico_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    llamada = (
        db.query(Llamada)
        .options(joinedload(Llamada.consultorio).joinedload(Consultorio.sala).joinedload(Sala.sede))
        .filter(Llamada.id == llamada.id)
        .first()
    )

    sala = llamada.consultorio.sala
    await sala_manager.send_to_sala(sala.id, call_to_ws_payload(llamada))

    sede = sala.sede
    ttl = get_settings().call_ttl_seconds
    return CurrentCallOut(
        call_id=llamada.id,
        paciente_nombre=llamada.paciente_nombre,
        consultorio_numero=llamada.consultorio.numero,
        sala_nombre=sala.nombre,
        sede_nombre=sede.nombre if sede else "",
        fecha_llamada=llamada.fecha_llamada,
        fecha_expiracion=llamada.fecha_expiracion,
        ttl_seconds=ttl,
    )
