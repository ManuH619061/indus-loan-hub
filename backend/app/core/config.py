"""Application configuration, loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "AI Invoice Accounting API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # SQLAlchemy connection string. Swap to a postgresql:// URL later without
    # any code changes elsewhere — every query in this codebase is ORM-based.
    DATABASE_URL: str = f"sqlite:///{BACKEND_ROOT / 'data' / 'app.db'}"

    STORAGE_DIR: Path = BACKEND_ROOT / "storage"

    MAX_UPLOAD_SIZE_MB: int = 25
    MAX_BATCH_FILES: int = 1000
    ALLOWED_EXTENSIONS: tuple[str, ...] = ("pdf", "jpg", "jpeg", "png")
    THUMBNAIL_MAX_DIM: int = 480

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    def client_dir(self, client_id: str) -> Path:
        """Root storage directory for a single client. Every other per-client
        path (invoices, and future masters/exports) lives under here, so a
        client's data is a single self-contained folder on disk."""
        return self.STORAGE_DIR / "clients" / client_id

    def client_originals_dir(self, client_id: str) -> Path:
        return self.client_dir(client_id) / "invoices" / "originals"

    def client_thumbnails_dir(self, client_id: str) -> Path:
        return self.client_dir(client_id) / "invoices" / "thumbnails"


@lru_cache
def get_settings() -> Settings:
    return Settings()
