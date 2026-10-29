from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import require_medico
from app.database import get_db
from app.models.entities import Usuario
from app.schemas.common import MedicoCallsTodayOut
from app.services.medico_service import build_medico_calls_today

router = APIRouter(prefix="/api/medicos", tags=["medicos"])


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
