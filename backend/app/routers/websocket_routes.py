import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.config import get_settings
from app.database import SessionLocal
from app.models.entities import Sala, Usuario
from app.services.call_service import call_to_ws_payload, get_current_call_for_sala
from app.websocket.manager import sala_manager

router = APIRouter(tags=["websocket"])
settings = get_settings()


def _authenticate_ws_token(token: str, db: Session) -> Usuario | None:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user = (
        db.query(Usuario)
        .filter(Usuario.username == payload["sub"], Usuario.activo == 1)
        .first()
    )
    if not user or user.rol not in ("PANTALLA", "ADMIN"):
        return None
    return user


@router.websocket("/ws/salas/{sala_id}")
async def sala_websocket(
    websocket: WebSocket,
    sala_id: int,
    token: str = Query(..., description="JWT de usuario con rol PANTALLA"),
):
    db: Session = SessionLocal()
    try:
        user = _authenticate_ws_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return

        sala = db.query(Sala).filter(Sala.id == sala_id, Sala.activo == 1).first()
        if not sala:
            await websocket.close(code=4404)
            return

        await sala_manager.connect(sala_id, websocket)

        current = get_current_call_for_sala(db, sala_id)
        if current:
            await websocket.send_text(
                json.dumps(
                    {**call_to_ws_payload(current), "play_audio": False},
                    default=str,
                )
            )
        else:
            await websocket.send_text(json.dumps({"type": "idle"}))

        ping_task = asyncio.create_task(_ping_loop(websocket, settings.ws_ping_interval))

        try:
            while True:
                msg = await websocket.receive_text()
                if msg.strip().lower() == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
        except WebSocketDisconnect:
            pass
        finally:
            ping_task.cancel()
            await sala_manager.disconnect(sala_id, websocket)
    finally:
        db.close()


async def _ping_loop(websocket: WebSocket, interval: int) -> None:
    try:
        while True:
            await asyncio.sleep(interval)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except asyncio.CancelledError:
        return
    except Exception:
        return
