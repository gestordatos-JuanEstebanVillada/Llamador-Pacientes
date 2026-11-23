import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, auth, calls, dashboard, locations, medicos, pantallas, salas_screen, websocket_routes
from app.websocket.manager import sala_manager

settings = get_settings()


async def _prune_stale_screens_loop() -> None:
    while True:
        await asyncio.sleep(5)
        try:
            await sala_manager.prune_stale_screens()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_prune_stale_screens_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Llamador de Pacientes", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(calls.router)
app.include_router(medicos.router)
app.include_router(salas_screen.router)
app.include_router(pantallas.router)
app.include_router(admin.router)
app.include_router(dashboard.router)
app.include_router(websocket_routes.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
