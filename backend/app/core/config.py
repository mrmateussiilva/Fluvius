from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Fluvius"
    API_V1_STR: str = "/api"
    
    # SQLite Database (default) or Postgres
    DATABASE_URL: str = "sqlite:///./fluvius.db"
    
    # Backend host -> Evolution API
    EVOLUTION_BASE_URL: str | None = "http://localhost:8080"
    # Legacy name kept for existing local env files.
    EVOLUTION_API_URL: str | None = None
    EVOLUTION_API_KEY: str = "dev_fluvius_change_me"
    
    # Security Webhook Secret
    EVOLUTION_WEBHOOK_SECRET: str | None = None

    # Browser/frontend -> backend
    PUBLIC_API_BASE_URL: str = "http://localhost:8000"

    # Evolution API container -> backend host
    WEBHOOK_PUBLIC_BASE_URL: str | None = "http://host.docker.internal:8000"
    # Legacy name kept for existing local env files.
    BACKEND_URL: str | None = None
    
    # Frontend Origin
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    
    # Optional CORS origins
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # AI Integration
    GEMINI_API_KEY: str | None = None


    @property
    def evolution_base_url(self) -> str:
        return self.EVOLUTION_BASE_URL or self.EVOLUTION_API_URL or "http://localhost:8080"

    @property
    def webhook_public_base_url(self) -> str:
        return self.WEBHOOK_PUBLIC_BASE_URL or self.BACKEND_URL or "http://host.docker.internal:8000"
    
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )


settings = Settings()
