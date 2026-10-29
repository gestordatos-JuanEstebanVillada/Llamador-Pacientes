from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_location_reader, require_medico
from app.database import get_db
from app.models.entities import Consultorio, Sede, Sala
from app.schemas.common import ConsultorioOut, SedeOut, SalaOut

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("/sedes", response_model=list[SedeOut])
def list_sedes(db: Session = Depends(get_db), _=Depends(require_location_reader)):
    rows = db.query(Sede).filter(Sede.activo == 1).order_by(Sede.nombre).all()
    return [
        SedeOut(id=r.id, nombre=r.nombre, activo=bool(r.activo), fecha_creacion=r.fecha_creacion)
        for r in rows
    ]


@router.get("/sedes/{sede_id}/salas", response_model=list[SalaOut])
def list_salas(sede_id: int, db: Session = Depends(get_db), _=Depends(require_location_reader)):
    rows = (
        db.query(Sala)
        .filter(Sala.sede_id == sede_id, Sala.activo == 1)
        .order_by(Sala.nombre)
        .all()
    )
    return [
        SalaOut(
            id=r.id,
            sede_id=r.sede_id,
            nombre=r.nombre,
            activo=bool(r.activo),
            fecha_creacion=r.fecha_creacion,
        )
        for r in rows
    ]


@router.get("/salas/{sala_id}/consultorios", response_model=list[ConsultorioOut])
def list_consultorios(sala_id: int, db: Session = Depends(get_db), _=Depends(require_medico)):
    rows = (
        db.query(Consultorio)
        .filter(Consultorio.sala_id == sala_id, Consultorio.activo == 1)
        .order_by(Consultorio.numero)
        .all()
    )
    return [
        ConsultorioOut(
            id=r.id,
            sala_id=r.sala_id,
            numero=r.numero,
            descripcion=r.descripcion,
            activo=bool(r.activo),
            fecha_creacion=r.fecha_creacion,
        )
        for r in rows
    ]
