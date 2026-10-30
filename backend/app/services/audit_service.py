from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.entities import Auditoria, Usuario

BOGOTA = ZoneInfo("America/Bogota")


def now_bogota() -> datetime:
    """Hora local Colombia (naive) para persistir en TIMESTAMP Oracle."""
    return datetime.now(BOGOTA).replace(tzinfo=None)


def _snapshot_usuario(usuario: Usuario | None) -> tuple[int | None, str, str]:
    if usuario is None:
        return None, "Sistema", "SISTEMA"
    return usuario.id, usuario.username, usuario.rol


async def registrar_auditoria(
    db: Session,
    usuario: Usuario | None,
    modulo: str,
    accion: str,
    detalles: str,
) -> None:
    usuario_id, nombre_usuario, rol_usuario = _snapshot_usuario(usuario)
    detalle_text = (detalles or "")[:4000]
    row = Auditoria(
        usuario_id=usuario_id,
        nombre_usuario=nombre_usuario,
        rol_usuario=rol_usuario,
        modulo=modulo,
        accion=accion,
        detalles=detalle_text,
        fecha=now_bogota(),
    )
    db.add(row)
    db.flush()
