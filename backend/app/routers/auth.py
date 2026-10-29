from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, verify_password
from app.database import get_db
from app.models.entities import Usuario
from app.schemas.common import LoginRequest, TokenResponse, UsuarioOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _read_login_credentials(request: Request) -> tuple[str, str]:
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
    elif (
        "application/x-www-form-urlencoded" in content_type
        or "multipart/form-data" in content_type
    ):
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Use application/json o application/x-www-form-urlencoded",
        )

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username y password son obligatorios",
        )
    return str(username), str(password)


def _build_token_response(user: Usuario) -> TokenResponse:
    token = create_access_token(user.username, {"rol": user.rol, "medico_id": user.medico_id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        rol=user.rol,
        username=user.username,
        medico_id=user.medico_id,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: Session = Depends(get_db)):
    username, password = await _read_login_credentials(request)
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user or user.activo != 1 or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    return _build_token_response(user)


@router.post("/login/json", response_model=TokenResponse, include_in_schema=False)
def login_json(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.username == body.username).first()
    if not user or user.activo != 1 or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    return _build_token_response(user)


@router.get("/me", response_model=UsuarioOut)
def me(user: Usuario = Depends(get_current_user)):
    return UsuarioOut(
        id=user.id,
        username=user.username,
        rol=user.rol,
        medico_id=user.medico_id,
        activo=bool(user.activo),
    )
