import time
from threading import Lock

from app.schemas.common import CurrentCallOut

_IDEMPOTENCY_TTL_SECONDS = 5.0
_lock = Lock()
_recent: dict[tuple[int, str, str], tuple[float, CurrentCallOut]] = {}


def _normalize_key(sala_id: int, consultorio_numero: str, paciente_nombre: str) -> tuple[int, str, str]:
    return (
        sala_id,
        consultorio_numero.strip().upper(),
        paciente_nombre.strip().upper(),
    )


def _prune_expired(now: float) -> None:
    expired = [k for k, (ts, _) in _recent.items() if now - ts > _IDEMPOTENCY_TTL_SECONDS]
    for k in expired:
        del _recent[k]


def get_recent_duplicate(
    sala_id: int,
    consultorio_numero: str,
    paciente_nombre: str,
) -> CurrentCallOut | None:
    key = _normalize_key(sala_id, consultorio_numero, paciente_nombre)
    now = time.monotonic()
    with _lock:
        _prune_expired(now)
        entry = _recent.get(key)
        if not entry:
            return None
        ts, response = entry
        if now - ts > _IDEMPOTENCY_TTL_SECONDS:
            del _recent[key]
            return None
        return response.model_copy(deep=True)


def remember_recent_call(
    sala_id: int,
    consultorio_numero: str,
    paciente_nombre: str,
    response: CurrentCallOut,
) -> None:
    key = _normalize_key(sala_id, consultorio_numero, paciente_nombre)
    now = time.monotonic()
    with _lock:
        _prune_expired(now)
        _recent[key] = (now, response.model_copy(deep=True))