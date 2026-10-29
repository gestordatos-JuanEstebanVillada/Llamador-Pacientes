from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Sede(Base):
    __tablename__ = "LLAMADOR_SEDES"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column("NOMBRE", String(200))
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)

    salas: Mapped[list["Sala"]] = relationship(back_populates="sede")


class Sala(Base):
    __tablename__ = "LLAMADOR_SALAS"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    sede_id: Mapped[int] = mapped_column("SEDE_ID", ForeignKey("LLAMADOR_SEDES.ID"))
    nombre: Mapped[str] = mapped_column("NOMBRE", String(200))
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)

    sede: Mapped["Sede"] = relationship(back_populates="salas")
    consultorios: Mapped[list["Consultorio"]] = relationship(back_populates="sala")
    pantalla: Mapped["Pantalla | None"] = relationship(back_populates="sala", uselist=False)


class Consultorio(Base):
    __tablename__ = "LLAMADOR_CONSULTORIOS"
    __table_args__ = (
        UniqueConstraint("SALA_ID", "NUMERO", name="UQ_LLAMADOR_CONSULTORIO_SALA_NUMERO"),
    )

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    sala_id: Mapped[int] = mapped_column("SALA_ID", ForeignKey("LLAMADOR_SALAS.ID"))
    numero: Mapped[str] = mapped_column("NUMERO", String(50))
    descripcion: Mapped[str | None] = mapped_column("DESCRIPCION", String(500))
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)

    sala: Mapped["Sala"] = relationship(back_populates="consultorios", lazy="joined")


class Pantalla(Base):
    __tablename__ = "LLAMADOR_PANTALLAS"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    sala_id: Mapped[int] = mapped_column("SALA_ID", ForeignKey("LLAMADOR_SALAS.ID"), unique=True)
    nombre: Mapped[str] = mapped_column("NOMBRE", String(200))
    codigo: Mapped[str] = mapped_column("CODIGO", String(100), unique=True)
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)

    sala: Mapped["Sala"] = relationship(back_populates="pantalla")
    llamadas: Mapped[list["Llamada"]] = relationship(back_populates="pantalla")


class Medico(Base):
    __tablename__ = "LLAMADOR_MEDICOS"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column("NOMBRE", String(200))
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)


class Usuario(Base):
    __tablename__ = "LLAMADOR_USUARIOS"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    username: Mapped[str] = mapped_column("USERNAME", String(100), unique=True)
    password_hash: Mapped[str] = mapped_column("PASSWORD_HASH", String(255))
    rol: Mapped[str] = mapped_column("ROL", String(20))
    medico_id: Mapped[int | None] = mapped_column("MEDICO_ID", ForeignKey("LLAMADOR_MEDICOS.ID"))
    activo: Mapped[int] = mapped_column("ACTIVO", Integer, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column("FECHA_CREACION", DateTime)


class Llamada(Base):
    __tablename__ = "LLAMADOR_LLAMADAS"

    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True)
    pantalla_id: Mapped[int] = mapped_column("PANTALLA_ID", ForeignKey("LLAMADOR_PANTALLAS.ID"))
    consultorio_id: Mapped[int] = mapped_column(
        "CONSULTORIO_ID", ForeignKey("LLAMADOR_CONSULTORIOS.ID")
    )
    medico_id: Mapped[int | None] = mapped_column("MEDICO_ID", ForeignKey("LLAMADOR_MEDICOS.ID"))
    paciente_nombre: Mapped[str] = mapped_column("PACIENTE_NOMBRE", String(300))
    estado: Mapped[str] = mapped_column("ESTADO", String(20))
    fecha_llamada: Mapped[datetime] = mapped_column("FECHA_LLAMADA", DateTime)
    fecha_expiracion: Mapped[datetime] = mapped_column("FECHA_EXPIRACION", DateTime)
    fecha_finalizacion: Mapped[datetime | None] = mapped_column("FECHA_FINALIZACION", DateTime)

    pantalla: Mapped["Pantalla"] = relationship(back_populates="llamadas")
    consultorio: Mapped["Consultorio"] = relationship()
    medico: Mapped["Medico | None"] = relationship()
