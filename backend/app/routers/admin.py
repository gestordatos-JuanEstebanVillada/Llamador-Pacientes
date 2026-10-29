from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import require_admin
from app.auth.security import hash_password
from app.database import get_db
from app.models.entities import Consultorio, Llamada, Medico, Pantalla, Sede, Sala, Usuario
from app.schemas.common import (
    ConsultorioBase,
    ConsultorioOut,
    DashboardMetrics,
    MedicoBase,
    MedicoOut,
    MessageOut,
    PantallaBase,
    PantallaOut,
    SedeBase,
    SedeOut,
    SalaBase,
    SalaOut,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _bool_to_int(value: bool) -> int:
    return 1 if value else 0


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def dashboard_metrics(db: Session = Depends(get_db), _=Depends(require_admin)):
    now = datetime.utcnow()
    start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = start_day - timedelta(days=start_day.weekday())

    llamadas_hoy = (
        db.query(func.count(Llamada.id)).filter(Llamada.fecha_llamada >= start_day).scalar() or 0
    )
    llamadas_semana = (
        db.query(func.count(Llamada.id)).filter(Llamada.fecha_llamada >= start_week).scalar() or 0
    )
    pantallas_activas = db.query(func.count(Pantalla.id)).filter(Pantalla.activo == 1).scalar() or 0
    sedes_activas = db.query(func.count(Sede.id)).filter(Sede.activo == 1).scalar() or 0

    rows = (
        db.query(Sede.nombre, func.count(Llamada.id))
        .join(Sala, Sala.sede_id == Sede.id)
        .join(Pantalla, Pantalla.sala_id == Sala.id)
        .join(Llamada, Llamada.pantalla_id == Pantalla.id)
        .filter(Llamada.fecha_llamada >= start_day)
        .group_by(Sede.nombre)
        .all()
    )
    llamadas_por_sede = [{"sede": nombre, "total": int(total)} for nombre, total in rows]

    return DashboardMetrics(
        llamadas_hoy=int(llamadas_hoy),
        llamadas_semana=int(llamadas_semana),
        pantallas_activas=int(pantallas_activas),
        sedes_activas=int(sedes_activas),
        llamadas_por_sede=llamadas_por_sede,
    )


@router.get("/sedes", response_model=list[SedeOut])
def list_sedes(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Sede).order_by(Sede.nombre).all()


@router.post("/sedes", response_model=SedeOut, status_code=status.HTTP_201_CREATED)
def create_sede(body: SedeBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = Sede(nombre=body.nombre, activo=_bool_to_int(body.activo), fecha_creacion=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/sedes/{sede_id}", response_model=SedeOut)
def update_sede(sede_id: int, body: SedeBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Sede).filter(Sede.id == sede_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    row.nombre = body.nombre
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.get("/salas", response_model=list[SalaOut])
def list_salas(sede_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(Sala)
    if sede_id is not None:
        q = q.filter(Sala.sede_id == sede_id)
    return q.order_by(Sala.nombre).all()


@router.post("/salas", response_model=SalaOut, status_code=status.HTTP_201_CREATED)
def create_sala(body: SalaBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = Sala(
        sede_id=body.sede_id,
        nombre=body.nombre,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/salas/{sala_id}", response_model=SalaOut)
def update_sala(sala_id: int, body: SalaBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Sala).filter(Sala.id == sala_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    row.sede_id = body.sede_id
    row.nombre = body.nombre
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.get("/consultorios", response_model=list[ConsultorioOut])
def list_consultorios(
    sala_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_admin)
):
    q = db.query(Consultorio)
    if sala_id is not None:
        q = q.filter(Consultorio.sala_id == sala_id)
    return q.order_by(Consultorio.numero).all()


@router.post("/consultorios", response_model=ConsultorioOut, status_code=status.HTTP_201_CREATED)
def create_consultorio(body: ConsultorioBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = Consultorio(
        sala_id=body.sala_id,
        numero=body.numero,
        descripcion=body.descripcion,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/consultorios/{consultorio_id}", response_model=ConsultorioOut)
def update_consultorio(
    consultorio_id: int, body: ConsultorioBase, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Consultorio).filter(Consultorio.id == consultorio_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Consultorio no encontrado")
    row.sala_id = body.sala_id
    row.numero = body.numero
    row.descripcion = body.descripcion
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.get("/pantallas", response_model=list[PantallaOut])
def list_pantallas(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Pantalla).order_by(Pantalla.nombre).all()


@router.post("/pantallas", response_model=PantallaOut, status_code=status.HTTP_201_CREATED)
def create_pantalla(body: PantallaBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = Pantalla(
        sala_id=body.sala_id,
        nombre=body.nombre,
        codigo=body.codigo,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/pantallas/{pantalla_id}", response_model=PantallaOut)
def update_pantalla(
    pantalla_id: int, body: PantallaBase, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Pantalla).filter(Pantalla.id == pantalla_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")
    row.sala_id = body.sala_id
    row.nombre = body.nombre
    row.codigo = body.codigo
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.get("/medicos", response_model=list[MedicoOut])
def list_medicos(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Medico).order_by(Medico.nombre).all()


@router.post("/medicos", response_model=MedicoOut, status_code=status.HTTP_201_CREATED)
def create_medico(body: MedicoBase, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = Medico(nombre=body.nombre, activo=_bool_to_int(body.activo), fecha_creacion=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/medicos/{medico_id}", response_model=MedicoOut)
def update_medico(
    medico_id: int, body: MedicoBase, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Medico).filter(Medico.id == medico_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    row.nombre = body.nombre
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.get("/usuarios", response_model=list[UsuarioOut])
def list_usuarios(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(Usuario).order_by(Usuario.username).all()
    return [
        UsuarioOut(
            id=u.id,
            username=u.username,
            rol=u.rol,
            medico_id=u.medico_id,
            activo=bool(u.activo),
        )
        for u in users
    ]


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def create_usuario(body: UsuarioCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if body.rol == "MEDICO" and not body.medico_id:
        raise HTTPException(status_code=400, detail="MEDICO requiere medico_id")
    if body.rol == "PANTALLA" and body.medico_id:
        raise HTTPException(status_code=400, detail="PANTALLA no debe tener medico_id")
    medico_id = body.medico_id if body.rol == "MEDICO" else None
    row = Usuario(
        username=body.username,
        password_hash=hash_password(body.password),
        rol=body.rol,
        medico_id=medico_id,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return UsuarioOut(
        id=row.id,
        username=row.username,
        rol=row.rol,
        medico_id=row.medico_id,
        activo=bool(row.activo),
    )


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def update_usuario(
    usuario_id: int, body: UsuarioUpdate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if body.username is not None:
        clash = (
            db.query(Usuario)
            .filter(Usuario.username == body.username, Usuario.id != usuario_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
        row.username = body.username
    if body.password:
        row.password_hash = hash_password(body.password)
    if body.rol is not None:
        row.rol = body.rol
        if body.rol in ("ADMIN", "PANTALLA"):
            row.medico_id = None
    if body.medico_id is not None:
        row.medico_id = body.medico_id
    if body.activo is not None:
        row.activo = _bool_to_int(body.activo)
    if row.rol == "MEDICO" and not row.medico_id:
        raise HTTPException(status_code=400, detail="MEDICO requiere medico_id")
    db.commit()
    db.refresh(row)
    return UsuarioOut(
        id=row.id,
        username=row.username,
        rol=row.rol,
        medico_id=row.medico_id,
        activo=bool(row.activo),
    )


@router.delete("/usuarios/{usuario_id}", response_model=MessageOut)
def delete_usuario(usuario_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    row.activo = 0
    db.commit()
    return MessageOut(message="Usuario desactivado")
