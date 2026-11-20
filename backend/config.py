"""Configuration for the BreatheWise Flask API.

Every secret is read from the environment (or backend/.env). API keys are never
sent to the browser. The defaults are intentionally safe for local development.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _origins_env() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    )
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


class Config:
    """Default application configuration."""

    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = _bool_env("FLASK_DEBUG", False)
    TESTING = False

    SECRET_KEY = os.getenv("SECRET_KEY", "breathewise-local-dev-secret-change-me")

    CORS_ORIGINS = _origins_env()

    # --- Google Gemini -----------------------------------------------------
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    GEMINI_TIMEOUT_SECONDS = _int_env("GEMINI_TIMEOUT_SECONDS", 28)

    # --- Upstream services -------------------------------------------------
    HTTP_TIMEOUT_SECONDS = _int_env("HTTP_TIMEOUT_SECONDS", 12)
    AIR_CACHE_TTL_SECONDS = _int_env("AIR_CACHE_TTL_SECONDS", 600)
    GEO_CACHE_TTL_SECONDS = _int_env("GEO_CACHE_TTL_SECONDS", 86_400)
    GEOCODE_BASE_URL = os.getenv(
        "GEOCODE_BASE_URL", "https://geocoding-api.open-meteo.com/v1/search"
    )
    REVERSE_GEOCODE_BASE_URL = os.getenv(
        "REVERSE_GEOCODE_BASE_URL",
        "https://api.bigdatacloud.net/data/reverse-geocode-client",
    )

    # When true, the API keeps working with a *clearly labelled* demo dataset
    # if Open-Meteo is unreachable. It is never presented as live data.
    DEMO_MODE = _bool_env("DEMO_MODE", False)

    # --- Protection --------------------------------------------------------
    MAX_CONTENT_LENGTH = 64 * 1024  # 64 KB request bodies
    RATE_LIMIT_PER_MINUTE = _int_env("RATE_LIMIT_PER_MINUTE", 90)
    ASSISTANT_RATE_LIMIT_PER_MINUTE = _int_env("ASSISTANT_RATE_LIMIT_PER_MINUTE", 15)
    GENERATION_RATE_LIMIT_PER_MINUTE = _int_env("GENERATION_RATE_LIMIT_PER_MINUTE", 30)
