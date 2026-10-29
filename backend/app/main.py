from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, auth, calls, dashboard, locations, medicos, pantallas, salas_screen, websocket_routes

settings = get_settings()

app = FastAPI(title="Llamador de Pacientes", version="1.0.0")

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
