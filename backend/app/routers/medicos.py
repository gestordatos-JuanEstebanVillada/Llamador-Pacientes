from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import require_medico, require_medico_only
from app.database import get_db
from app.models.entities import Usuario
from app.schemas.common import CitasHoyOut, CitaHoyRowOut, MedicoCallsTodayOut
from app.services.agenda_service import fetch_citas_hoy
from app.services.medico_service import build_medico_calls_today

router = APIRouter(prefix="/api/medicos", tags=["medicos"])


@router.get("/citas-hoy", response_model=CitasHoyOut)
def citas_hoy(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_medico_only),
):
    """Agenda del día (SIIDE/CNCIT/ABPAC). Solo lectura; rol MEDICO."""
    day, rows = fetch_citas_hoy(db, user.username)
    return CitasHoyOut(
        fecha=day,
        username=user.username,
        data=[CitaHoyRowOut(**r) for r in rows],
    )


@router.get("/mis-llamadas-hoy", response_model=MedicoCallsTodayOut)
def mis_llamadas_hoy(
    page: int = Query(1, ge=1),
    limit: int = Query(5, ge=1, le=100),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_medico),
):
    if user.medico_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no tiene un médico asociado",
        )
    return build_medico_calls_today(db, user.medico_id, page=page, limit=limit)
