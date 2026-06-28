# ─────────────────────────────────────────────────────────────────
# config.py — Centralised settings loaded from .env
# Uses pydantic-settings so all env vars are type-validated on start
# ─────────────────────────────────────────────────────────────────

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # AI — NVIDIA NIM (primary)
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "minimaxai/minimax-m2.5"

    # AI — ZhipuAI GLM (legacy fallback, kept for .env compat)
    zhipuai_api_key: str = ""
    zhipuai_base_url: str = "https://api.z.ai/api/paas/v4/"
    zhipuai_model: str = "glm-4.7-flash"

    # Email / SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""

    # Database
    database_url: str = "sqlite:///./opportunityscout.db"

    # CORS
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings object."""
    return Settings()
