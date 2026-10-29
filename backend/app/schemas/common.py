from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field


def _coerce_activo(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value == 1
    return bool(value)


ActiveBool = Annotated[bool, BeforeValidator(_coerce_activo)]


class MessageOut(BaseModel):
    message: str


class SedeBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    activo: ActiveBool = True


class SedeOut(SedeBase):
    id: int
    fecha_creacion: datetime | None = None

    model_config = {"from_attributes": True}


class SalaBase(BaseModel):
    sede_id: int
    nombre: str = Field(..., min_length=1, max_length=200)
    activo: ActiveBool = True


class SalaOut(SalaBase):
    id: int
    fecha_creacion: datetime | None = None

    model_config = {"from_attributes": True}


class ConsultorioBase(BaseModel):
    sala_id: int
    numero: str = Field(..., min_length=1, max_length=50)
    descripcion: str | None = None
    activo: ActiveBool = True


class ConsultorioOut(ConsultorioBase):
    id: int
    fecha_creacion: datetime | None = None

    model_config = {"from_attributes": True}


class PantallaBase(BaseModel):
    sala_id: int
    nombre: str = Field(..., min_length=1, max_length=200)
    codigo: str = Field(..., min_length=1, max_length=100)
    activo: ActiveBool = True


class PantallaOut(PantallaBase):
    id: int
    fecha_creacion: datetime | None = None

    model_config = {"from_attributes": True}


class MedicoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    activo: ActiveBool = True


class MedicoOut(MedicoBase):
    id: int
    fecha_creacion: datetime | None = None

    model_config = {"from_attributes": True}


class UsuarioCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    rol: str = Field(..., pattern="^(ADMIN|MEDICO|PANTALLA)$")
    medico_id: int | None = None
    activo: bool = True


class UsuarioUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=100)
    password: str | None = Field(None, min_length=6, max_length=128)
    rol: str | None = Field(None, pattern="^(ADMIN|MEDICO|PANTALLA)$")
    medico_id: int | None = None
    activo: bool | None = None


class UsuarioOut(BaseModel):
    id: int
    username: str
    rol: str
    medico_id: int | None
    activo: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    username: str
    medico_id: int | None = None


class CallCreate(BaseModel):
    consultorio_id: int
    paciente_nombre: str = Field(..., min_length=1, max_length=300)


class CurrentCallOut(BaseModel):
    call_id: int
    paciente_nombre: str
    consultorio_numero: str
    sala_nombre: str
    sede_nombre: str
    fecha_llamada: datetime
    fecha_expiracion: datetime
    ttl_seconds: int


class DashboardMetrics(BaseModel):
    llamadas_hoy: int
    llamadas_semana: int
    pantallas_activas: int
    sedes_activas: int
    llamadas_por_sede: list[dict]


class HourlyCallPoint(BaseModel):
    hour: int
    label: str
    total: int


class TopDoctorPoint(BaseModel):
    medico_id: int
    medico_nombre: str
    total: int


class DashboardSummaryOut(BaseModel):
    fecha_referencia: date
    llamadas_hoy: int
    llamadas_semana: int
    pantallas_activas: int
    medicos_activos_hoy: int


class FlujoPorHoraOut(BaseModel):
    fecha: date
    llamadas_por_hora: list[HourlyCallPoint]


class TopMedicosOut(BaseModel):
    fecha: date
    top_medicos: list[TopDoctorPoint]


class MedicoCallTodayRowOut(BaseModel):
    fecha_llamada: datetime
    paciente_nombre: str
    consultorio_numero: str
    estado: str


class MedicoCallsTodayOut(BaseModel):
    fecha: date
    data: list[MedicoCallTodayRowOut]
    total_records: int
    current_page: int
    total_pages: int


class DoctorCallRowOut(BaseModel):
    fecha_llamada: datetime
    paciente_nombre: str
    consultorio_numero: str
    sala_nombre: str
    estado: str


class DoctorDashboardOut(BaseModel):
    medico_id: int
    medico_nombre: str
    fecha: date
    total_records: int
    current_page: int
    total_pages: int
    data: list[DoctorCallRowOut]


class MedicoProduccionRowOut(BaseModel):
    medico_id: int
    medico_nombre: str
    activo: bool
    total_llamadas: int
    promedio_diario: float


class ProduccionDashboardOut(BaseModel):
    start_date: date
    end_date: date
    dias_en_rango: int
    medicos: list[MedicoProduccionRowOut]
