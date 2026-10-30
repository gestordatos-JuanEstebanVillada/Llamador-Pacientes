from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import require_admin, require_admin_panel
from app.auth.security import hash_password
from app.database import get_db
from app.models.entities import Consultorio, Llamada, Medico, Pantalla, Sede, Sala, Usuario
from app.schemas.common import (
    AuditoriaListOut,
    AuditoriaRowOut,
    ConsultorioBase,
    ConsultorioOut,
    DashboardMetrics,
    MedicoBase,
    MedicoOut,
    MessageOut,
    PantallaOut,
    PantallaWrite,
    SedeBase,
    SedeOut,
    SalaBase,
    SalaOut,
    UsuarioCreate,
    UsuarioFiltroOut,
    UsuarioOut,
    UsuarioUpdate,
)
from app.services.audit_query import list_auditoria
from app.services.audit_service import registrar_auditoria

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _bool_to_int(value: bool) -> int:
    return 1 if value else 0


def _sala_id_for_new_pantalla(db: Session) -> int:
    """
    Oracle exige SALA_ID NOT NULL y UNIQUE por pantalla.
    Asigna automáticamente la primera sala activa sin pantalla (solo uso interno en BD).
    La sede/sala real la elige el operador en /pantalla/setup.
    """
    used_sala_ids = {row[0] for row in db.query(Pantalla.sala_id).all()}
    q = db.query(Sala).filter(Sala.activo == 1)
    if used_sala_ids:
        q = q.filter(~Sala.id.in_(used_sala_ids))
    sala = q.order_by(Sala.id).first()
    if not sala:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No hay salas libres para registrar otra pantalla. "
                "Cree una sala adicional en el panel admin (cada pantalla consume una sala interna en BD)."
            ),
        )
    return sala.id


def _consultorio_query(db: Session):
    return db.query(Consultorio).options(
        joinedload(Consultorio.sala).joinedload(Sala.sede),
    )


def _consultorio_out(row: Consultorio) -> ConsultorioOut:
    sala = row.sala
    sede = sala.sede if sala else None
    return ConsultorioOut(
        id=row.id,
        sala_id=row.sala_id,
        numero=row.numero,
        descripcion=row.descripcion,
        activo=bool(row.activo),
        fecha_creacion=row.fecha_creacion,
        sala_nombre=sala.nombre if sala else "",
        sede_id=sede.id if sede else None,
        sede_nombre=sede.nombre if sede else "",
    )


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def dashboard_metrics(db: Session = Depends(get_db), _=Depends(require_admin_panel)):
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
def list_sedes(db: Session = Depends(get_db), _=Depends(require_admin_panel)):
    return db.query(Sede).filter(Sede.activo == 1).order_by(Sede.nombre).all()


@router.post("/sedes", response_model=SedeOut, status_code=status.HTTP_201_CREATED)
async def create_sede(
    body: SedeBase,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_panel),
):
    row = Sede(nombre=body.nombre, activo=_bool_to_int(body.activo), fecha_creacion=datetime.utcnow())
    db.add(row)
    db.flush()
    await registrar_auditoria(
        db, actor, "SEDES", "CREAR", f"Se creó la sede «{row.nombre}» (id {row.id})"
    )
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


@router.delete("/sedes/{sede_id}", response_model=MessageOut)
def delete_sede(sede_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Sede).filter(Sede.id == sede_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    sala_hija = (
        db.query(Sala).filter(Sala.sede_id == sede_id, Sala.activo == 1).first()
    )
    if sala_hija:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar la sede porque tiene salas ancladas. Elimine o reasigne las salas primero.",
        )
    row.activo = 0
    db.commit()
    db.refresh(row)
    return MessageOut(message="Sede eliminada")


@router.get("/salas", response_model=list[SalaOut])
def list_salas(sede_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_admin_panel)):
    q = db.query(Sala).filter(Sala.activo == 1)
    if sede_id is not None:
        q = q.filter(Sala.sede_id == sede_id)
    return q.order_by(Sala.nombre).all()


@router.post("/salas", response_model=SalaOut, status_code=status.HTTP_201_CREATED)
async def create_sala(
    body: SalaBase,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_panel),
):
    row = Sala(
        sede_id=body.sede_id,
        nombre=body.nombre,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    await registrar_auditoria(
        db, actor, "SALAS", "CREAR", f"Se creó la sala «{row.nombre}» (id {row.id})"
    )
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


@router.delete("/salas/{sala_id}", response_model=MessageOut)
def delete_sala(sala_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Sala).filter(Sala.id == sala_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    consultorio_hijo = (
        db.query(Consultorio).filter(Consultorio.sala_id == sala_id, Consultorio.activo == 1).first()
    )
    if consultorio_hijo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar la sala porque tiene consultorios anclados. Elimine los consultorios primero.",
        )
    row.activo = 0
    db.commit()
    db.refresh(row)
    return MessageOut(message="Sala eliminada")


@router.get("/consultorios", response_model=list[ConsultorioOut])
def list_consultorios(
    sala_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_admin_panel)
):
    q = _consultorio_query(db).filter(Consultorio.activo == 1)
    if sala_id is not None:
        q = q.filter(Consultorio.sala_id == sala_id)
    rows = q.all()
    rows.sort(
        key=lambda r: (
            (r.sala.sede.nombre if r.sala and r.sala.sede else "").lower(),
            (r.sala.nombre if r.sala else "").lower(),
            r.numero.lower(),
        )
    )
    return [_consultorio_out(r) for r in rows]


@router.post("/consultorios", response_model=ConsultorioOut, status_code=status.HTTP_201_CREATED)
async def create_consultorio(
    body: ConsultorioBase,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_panel),
):
    row = Consultorio(
        sala_id=body.sala_id,
        numero=body.numero,
        descripcion=body.descripcion,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    await registrar_auditoria(
        db,
        actor,
        "CONSULTORIOS",
        "CREAR",
        f"Se creó el consultorio «{row.numero}» (id {row.id})",
    )
    db.commit()
    loaded = _consultorio_query(db).filter(Consultorio.id == row.id).first()
    assert loaded is not None
    return _consultorio_out(loaded)


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
    loaded = _consultorio_query(db).filter(Consultorio.id == consultorio_id).first()
    assert loaded is not None
    return _consultorio_out(loaded)


@router.delete("/consultorios/{consultorio_id}", response_model=MessageOut)
def delete_consultorio(
    consultorio_id: int, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Consultorio).filter(Consultorio.id == consultorio_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Consultorio no encontrado")
    row.activo = 0
    db.commit()
    db.refresh(row)
    return MessageOut(message="Consultorio eliminado")


@router.get("/pantallas", response_model=list[PantallaOut])
def list_pantallas(db: Session = Depends(get_db), _=Depends(require_admin_panel)):
    return db.query(Pantalla).filter(Pantalla.activo == 1).order_by(Pantalla.nombre).all()


@router.post("/pantallas", response_model=PantallaOut, status_code=status.HTTP_201_CREATED)
async def create_pantalla(
    body: PantallaWrite,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_panel),
):
    row = Pantalla(
        sala_id=_sala_id_for_new_pantalla(db),
        nombre=body.nombre,
        codigo=body.codigo,
        activo=_bool_to_int(body.activo),
        fecha_creacion=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    await registrar_auditoria(
        db,
        actor,
        "PANTALLAS",
        "CREAR",
        f"Se creó la pantalla «{row.nombre}» (código {row.codigo}, id {row.id})",
    )
    db.commit()
    db.refresh(row)
    return row


@router.put("/pantallas/{pantalla_id}", response_model=PantallaOut)
def update_pantalla(
    pantalla_id: int, body: PantallaWrite, db: Session = Depends(get_db), _=Depends(require_admin)
):
    row = db.query(Pantalla).filter(Pantalla.id == pantalla_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")
    row.nombre = body.nombre
    row.codigo = body.codigo
    row.activo = _bool_to_int(body.activo)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/pantallas/{pantalla_id}", response_model=MessageOut)
def delete_pantalla(pantalla_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Pantalla).filter(Pantalla.id == pantalla_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")
    row.activo = 0
    db.commit()
    db.refresh(row)
    return MessageOut(message="Pantalla eliminada")


@router.get("/medicos", response_model=list[MedicoOut])
def list_medicos(db: Session = Depends(get_db), _=Depends(require_admin_panel)):
    return db.query(Medico).filter(Medico.activo == 1).order_by(Medico.nombre).all()


@router.post("/medicos", response_model=MedicoOut, status_code=status.HTTP_201_CREATED)
async def create_medico(
    body: MedicoBase,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_panel),
):
    row = Medico(nombre=body.nombre, activo=_bool_to_int(body.activo), fecha_creacion=datetime.utcnow())
    db.add(row)
    db.flush()
    await registrar_auditoria(
        db, actor, "MEDICOS", "CREAR", f"Se creó el médico «{row.nombre}» (id {row.id})"
    )
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


@router.delete("/medicos/{medico_id}", response_model=MessageOut)
def delete_medico(medico_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    row = db.query(Medico).filter(Medico.id == medico_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    row.activo = 0
    db.commit()
    db.refresh(row)
    return MessageOut(message="Médico eliminado")


@router.get("/usuarios", response_model=list[UsuarioOut])
def list_usuarios(db: Session = Depends(get_db), _=Depends(require_admin_panel)):
    users = db.query(Usuario).filter(Usuario.activo == 1).order_by(Usuario.username).all()
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
async def create_usuario(
    body: UsuarioCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin),
):
    if body.rol == "MEDICO" and not body.medico_id:
        raise HTTPException(status_code=400, detail="MEDICO requiere medico_id")
    if body.rol == "PANTALLA" and body.medico_id:
        raise HTTPException(status_code=400, detail="PANTALLA no debe tener medico_id")
    if body.rol in ("ADMIN", "GESTOR", "PANTALLA") and body.medico_id:
        raise HTTPException(status_code=400, detail="Este rol no debe tener medico_id")
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
    db.flush()
    await registrar_auditoria(
        db,
        actor,
        "USUARIOS",
        "CREAR",
        f"Se creó el usuario «{row.username}» con rol {row.rol} (id {row.id})",
    )
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
        if body.rol in ("ADMIN", "GESTOR", "PANTALLA"):
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
    db.refresh(row)
    return MessageOut(message="Usuario eliminado")


@router.get("/usuarios-por-rol", response_model=list[UsuarioFiltroOut])
def list_usuarios_por_rol(
    rol: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _=Depends(require_admin_panel),
):
    allowed = {"ADMIN", "GESTOR", "MEDICO", "PANTALLA"}
    r = rol.upper()
    if r not in allowed:
        raise HTTPException(status_code=400, detail="Rol no válido")

    rows = (
        db.query(Usuario)
        .filter(Usuario.rol == r, Usuario.activo == 1)
        .order_by(Usuario.username)
        .all()
    )

    if r == "MEDICO":
        medico_ids = {u.medico_id for u in rows if u.medico_id}
        medicos_by_id: dict[int, Medico] = {}
        if medico_ids:
            for m in db.query(Medico).filter(Medico.id.in_(medico_ids)).all():
                medicos_by_id[m.id] = m
        return [
            UsuarioFiltroOut(
                id=u.id,
                nombre=(
                    f"{medicos_by_id[u.medico_id].nombre} ({u.username})"
                    if u.medico_id and u.medico_id in medicos_by_id
                    else u.username
                ),
            )
            for u in rows
        ]

    return [UsuarioFiltroOut(id=u.id, nombre=u.username) for u in rows]


@router.get("/auditoria", response_model=AuditoriaListOut)
def get_auditoria(
    db: Session = Depends(get_db),
    _=Depends(require_admin_panel),
    rol: str | None = Query(None, description="ADMIN, GESTOR, MEDICO o PANTALLA"),
    usuario_id: int | None = Query(None, ge=1),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    if rol:
        allowed = {"ADMIN", "GESTOR", "MEDICO", "PANTALLA"}
        r = rol.upper()
        if r not in allowed:
            raise HTTPException(status_code=400, detail="Rol de filtro no válido")
    if usuario_id is not None:
        exists = db.query(Usuario.id).filter(Usuario.id == usuario_id, Usuario.activo == 1).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
        raise HTTPException(status_code=400, detail="fecha_fin no puede ser anterior a fecha_inicio")

    result = list_auditoria(
        db,
        rol=rol.upper() if rol else None,
        usuario_id=usuario_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        page=page,
        limit=limit,
    )
    return AuditoriaListOut(
        data=[AuditoriaRowOut.model_validate(row) for row in result["data"]],
        total_records=result["total_records"],
        current_page=result["current_page"],
        total_pages=result["total_pages"],
    )
