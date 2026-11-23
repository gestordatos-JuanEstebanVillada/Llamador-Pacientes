import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import WebSocket

Role = Literal["PANTALLA", "MEDICO"]
SCREEN_STALE_SECONDS = 12.0


@dataclass
class _WsMeta:
    sala_id: int
    sede_id: int | None
    role: Role
    last_seen: float


class SalaConnectionManager:
    """Conexiones WebSocket por sala, separando pantallas y médicos (solo memoria)."""

    def __init__(self) -> None:
        self._sockets: dict[int, WebSocket] = {}
        self._meta: dict[int, _WsMeta] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _wid(websocket: WebSocket) -> int:
        return id(websocket)

    def _screen_alive(self, meta: _WsMeta, now: float | None = None) -> bool:
        if meta.role != "PANTALLA":
            return False
        t = now if now is not None else time.monotonic()
        return (t - meta.last_seen) <= SCREEN_STALE_SECONDS

    async def connect(
        self,
        sala_id: int,
        websocket: WebSocket,
        *,
        role: Role,
        sede_id: int | None = None,
    ) -> None:
        await websocket.accept()
        now = time.monotonic()
        wid = self._wid(websocket)
        async with self._lock:
            self._sockets[wid] = websocket
            self._meta[wid] = _WsMeta(
                sala_id=sala_id,
                sede_id=sede_id,
                role=role,
                last_seen=now,
            )

    async def disconnect(self, sala_id: int, websocket: WebSocket) -> bool:
        """Elimina el socket. Devuelve True si era una pantalla de esa sala."""
        wid = self._wid(websocket)
        was_pantalla = False
        async with self._lock:
            meta = self._meta.get(wid)
            if meta and meta.sala_id == sala_id and meta.role == "PANTALLA":
                was_pantalla = True
            self._sockets.pop(wid, None)
            self._meta.pop(wid, None)
        return was_pantalla

    def touch_screen(self, websocket: WebSocket) -> None:
        wid = self._wid(websocket)
        meta = self._meta.get(wid)
        if meta and meta.role == "PANTALLA":
            meta.last_seen = time.monotonic()

    async def active_screen_count(self, sala_id: int) -> int:
        now = time.monotonic()
        async with self._lock:
            count = 0
            for meta in self._meta.values():
                if meta.sala_id == sala_id and self._screen_alive(meta, now):
                    count += 1
            return count

    async def has_active_screens(self, sala_id: int) -> bool:
        return (await self.active_screen_count(sala_id)) > 0

    def screen_status_payload(self, sala_id: int, active: int) -> dict[str, Any]:
        return {
            "type": "screen_status",
            "sala_id": sala_id,
            "online": active > 0,
            "active_screens": active,
        }

    async def broadcast_screen_status(self, sala_id: int) -> None:
        active = await self.active_screen_count(sala_id)
        await self.send_to_medicos(sala_id, self.screen_status_payload(sala_id, active))

    async def _targets_for_role(
        self,
        sala_id: int,
        role: Role,
        *,
        only_live_screens: bool = False,
    ) -> list[WebSocket]:
        now = time.monotonic()
        async with self._lock:
            out: list[WebSocket] = []
            for wid, ws in self._sockets.items():
                meta = self._meta.get(wid)
                if not meta or meta.sala_id != sala_id or meta.role != role:
                    continue
                if only_live_screens and not self._screen_alive(meta, now):
                    continue
                out.append(ws)
            return out

    async def _send_many(self, targets: list[WebSocket], message: dict[str, Any]) -> None:
        if not targets:
            return
        payload = json.dumps(message, default=str)
        dead: list[tuple[WebSocket, int | None]] = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append((ws, None))

        if not dead:
            return

        affected_salas: set[int] = set()
        async with self._lock:
            for ws, _ in dead:
                wid = self._wid(ws)
                meta = self._meta.pop(wid, None)
                self._sockets.pop(wid, None)
                if meta and meta.role == "PANTALLA":
                    affected_salas.add(meta.sala_id)

        for sala_id in affected_salas:
            await self.broadcast_screen_status(sala_id)

    async def send_to_screens(self, sala_id: int, message: dict[str, Any]) -> None:
        targets = await self._targets_for_role(sala_id, "PANTALLA", only_live_screens=True)
        await self._send_many(targets, message)

    async def send_to_medicos(self, sala_id: int, message: dict[str, Any]) -> None:
        targets = await self._targets_for_role(sala_id, "MEDICO")
        await self._send_many(targets, message)

    async def send_to_sala(self, sala_id: int, message: dict[str, Any]) -> None:
        """Compatibilidad: eventos de llamada solo a pantallas activas."""
        await self.send_to_screens(sala_id, message)

    async def prune_stale_screens(self, timeout_sec: float = SCREEN_STALE_SECONDS) -> None:
        now = time.monotonic()
        stale: list[tuple[WebSocket, int]] = []
        async with self._lock:
            for wid, ws in list(self._sockets.items()):
                meta = self._meta.get(wid)
                if not meta or meta.role != "PANTALLA":
                    continue
                if (now - meta.last_seen) > timeout_sec:
                    stale.append((ws, meta.sala_id))

        if not stale:
            return

        affected: set[int] = set()
        for ws, sala_id in stale:
            affected.add(sala_id)
            try:
                await ws.close(code=1001)
            except Exception:
                pass
            await self.disconnect(sala_id, ws)

        for sala_id in affected:
            await self.broadcast_screen_status(sala_id)


sala_manager = SalaConnectionManager()
screen_manager = sala_manager