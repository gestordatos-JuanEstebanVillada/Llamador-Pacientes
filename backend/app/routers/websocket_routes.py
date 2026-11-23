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


def _user_from_ws_token(token: str, db: Session) -> Usuario | None:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    return (
        db.query(Usuario)
        .filter(Usuario.username == payload["sub"], Usuario.activo == 1)
        .first()
    )


def _authenticate_screen_token(token: str, db: Session) -> Usuario | None:
    user = _user_from_ws_token(token, db)
    if not user or user.rol not in ("PANTALLA", "ADMIN"):
        return None
    return user


def _authenticate_medico_token(token: str, db: Session) -> Usuario | None:
    user = _user_from_ws_token(token, db)
    if not user or user.rol not in ("MEDICO", "ADMIN"):
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
        user = _authenticate_screen_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return

        sala = db.query(Sala).filter(Sala.id == sala_id, Sala.activo == 1).first()
        if not sala:
            await websocket.close(code=4404)
            return

        await sala_manager.connect(
            sala_id,
            websocket,
            role="PANTALLA",
            sede_id=sala.sede_id,
        )
        await sala_manager.broadcast_screen_status(sala_id)

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
                    sala_manager.touch_screen(websocket)
                    await websocket.send_text(json.dumps({"type": "pong"}))
                else:
                    try:
                        parsed = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(parsed, dict) and parsed.get("type") == "ping":
                        sala_manager.touch_screen(websocket)
                        await websocket.send_text(json.dumps({"type": "pong"}))
        except WebSocketDisconnect:
            pass
        finally:
            ping_task.cancel()
            was_screen = await sala_manager.disconnect(sala_id, websocket)
            if was_screen:
                await sala_manager.broadcast_screen_status(sala_id)
    finally:
        db.close()


@router.websocket("/ws/medicos/salas/{sala_id}")
async def medico_sala_websocket(
    websocket: WebSocket,
    sala_id: int,
    token: str = Query(..., description="JWT de usuario con rol MEDICO"),
):
    db: Session = SessionLocal()
    try:
        user = _authenticate_medico_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return

        sala = db.query(Sala).filter(Sala.id == sala_id, Sala.activo == 1).first()
        if not sala:
            await websocket.close(code=4404)
            return

        await sala_manager.connect(
            sala_id,
            websocket,
            role="MEDICO",
            sede_id=sala.sede_id,
        )

        active = await sala_manager.active_screen_count(sala_id)
        await websocket.send_text(
            json.dumps(sala_manager.screen_status_payload(sala_id, active), default=str)
        )

        ping_task = asyncio.create_task(_ping_loop(websocket, settings.ws_ping_interval))

        try:
            while True:
                msg = await websocket.receive_text()
                if msg.strip().lower() == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                else:
                    try:
                        parsed = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(parsed, dict) and parsed.get("type") == "ping":
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