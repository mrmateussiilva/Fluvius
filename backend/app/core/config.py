from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Fluvius"
    API_V1_STR: str = "/api"
    
    # SQLite Database (default) or Postgres
    DATABASE_URL: str = "sqlite:///./fluvius.db"
    
    # Evolution API Default
    EVOLUTION_API_URL: str = "http://localhost:8080"
    EVOLUTION_API_KEY: str = "dev_fluvius_change_me"
    BACKEND_URL: str = "http://host.docker.internal:8000"
    
    # Frontend Origin
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    
    # Optional CORS origins
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )


settings = Settings()
