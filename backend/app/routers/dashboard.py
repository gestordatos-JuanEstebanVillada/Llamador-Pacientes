from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import require_admin_panel
from app.database import get_db
from app.models.entities import Usuario
from app.schemas.common import (
    DashboardSummaryOut,
    DoctorDashboardOut,
    FlujoPorHoraOut,
    ProduccionDashboardOut,
    TopMedicosOut,
)
from app.services.dashboard_service import (
    build_dashboard_summary,
    build_doctor_day_detail,
    build_llamadas_por_hora,
    build_produccion_medicos,
    build_top_medicos,
)
from app.utils.timezone import parse_date_range, parse_fecha_param

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
def dashboard_summary(
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_admin_panel),
):
    return build_dashboard_summary(db)


@router.get("/flujo-por-hora", response_model=FlujoPorHoraOut)
def flujo_por_hora(
    fecha: str | None = Query(None, description="YYYY-MM-DD (Bogotá); default hoy"),
    sede_id: int | None = Query(None, description="Filtra por sede"),
    sala_id: int | None = Query(None, description="Filtra por sala"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_admin_panel),
):
    day = parse_fecha_param(fecha)
    return {
        "fecha": day,
        "llamadas_por_hora": build_llamadas_por_hora(db, day, sede_id=sede_id, sala_id=sala_id),
    }


@router.get("/top-medicos", response_model=TopMedicosOut)
def top_medicos(
    fecha: str | None = Query(None, description="YYYY-MM-DD (Bogotá); default hoy"),
    sede_id: int | None = Query(None, description="Filtra por sede"),
    sala_id: int | None = Query(None, description="Filtra por sala"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_admin_panel),
):
    day = parse_fecha_param(fecha)
    return {
        "fecha": day,
        "top_medicos": build_top_medicos(db, day, sede_id=sede_id, sala_id=sala_id),
    }


@router.get("/doctor/{medico_id}", response_model=DoctorDashboardOut)
def doctor_dashboard(
    medico_id: int,
    fecha: str | None = Query(None, description="YYYY-MM-DD (Bogotá); default hoy"),
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_admin_panel),
):
    day = parse_fecha_param(fecha)
    detail = build_doctor_day_detail(db, medico_id, day, page=page, limit=limit)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico no encontrado")
    return detail


@router.get("/produccion", response_model=ProduccionDashboardOut)
def produccion_medicos(
    start_date: str | None = Query(None, description="YYYY-MM-DD inicio (Bogotá)"),
    end_date: str | None = Query(None, description="YYYY-MM-DD fin (Bogotá)"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_admin_panel),
):
    start, end = parse_date_range(start_date, end_date)
    return build_produccion_medicos(db, start, end)
