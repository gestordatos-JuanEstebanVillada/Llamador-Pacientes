from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models.entities import Usuario

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    username = payload["sub"]
    user = db.query(Usuario).filter(Usuario.username == username, Usuario.activo == 1).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol ADMIN")
    return user


def require_admin_panel(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("ADMIN", "GESTOR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol ADMIN o GESTOR",
        )
    return user


def require_medico(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("MEDICO", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol MEDICO")
    return user


def require_pantalla(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("PANTALLA", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol PANTALLA")
    return user


def require_location_reader(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("ADMIN", "MEDICO", "PANTALLA"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    return user
