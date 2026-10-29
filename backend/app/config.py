from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    scse_db_user: str = Field(validation_alias="SCSE_DB_USER")
    scse_db_passwd: str = Field(validation_alias="SCSE_DB_PASSWD")
    scse_db_ip: str = Field(validation_alias="SCSE_DB_IP")
    scse_db_port: str = Field(default="1521", validation_alias="SCSE_DB_PORT")
    scse_db_database: str = Field(validation_alias="SCSE_DB_DATABASE")

    jwt_secret: str = Field(validation_alias="JWT_SECRET")
    jwt_expire_minutes: int = Field(default=480, validation_alias="JWT_EXPIRE_MINUTES")
    cors_origins: str = Field(default="http://localhost", validation_alias="CORS_ORIGINS")
    ws_ping_interval: int = Field(default=30, validation_alias="WS_PING_INTERVAL")
    call_ttl_seconds: int = Field(default=120, validation_alias="CALL_TTL_SECONDS")

    @property
    def database_url(self) -> str:
        from urllib.parse import quote_plus

        user = quote_plus(self.scse_db_user)
        password = quote_plus(self.scse_db_passwd)
        host = self.scse_db_ip
        port = self.scse_db_port
        service = quote_plus(self.scse_db_database)
        return f"oracle+oracledb://{user}:{password}@{host}:{port}/?service_name={service}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
