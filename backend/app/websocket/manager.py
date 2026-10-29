import asyncio
import json
from typing import Any

from fastapi import WebSocket


class SalaConnectionManager:
    """Conexiones WebSocket agrupadas por SALA_ID."""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, sala_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(sala_id, set()).add(websocket)

    async def disconnect(self, sala_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(sala_id)
            if not conns:
                return
            conns.discard(websocket)
            if not conns:
                del self._connections[sala_id]

    async def send_to_sala(self, sala_id: int, message: dict[str, Any]) -> None:
        payload = json.dumps(message, default=str)
        async with self._lock:
            targets = list(self._connections.get(sala_id, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                conns = self._connections.get(sala_id, set())
                for ws in dead:
                    conns.discard(ws)


sala_manager = SalaConnectionManager()

# Compatibilidad con imports antiguos
screen_manager = sala_manager
