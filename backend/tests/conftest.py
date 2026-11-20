from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make `backend/` importable when running `pytest` directly.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app  # noqa: E402
from config import Config  # noqa: E402
from app.services.rate_limit import rate_limiter  # noqa: E402
from app.utils.cache import air_cache, geo_cache  # noqa: E402


class TestConfig(Config):
    TESTING = True
    DEBUG = False
    SECRET_KEY = "test-only"
    GEMINI_API_KEY = ""
    DEMO_MODE = False
    RATE_LIMIT_PER_MINUTE = 10_000
    ASSISTANT_RATE_LIMIT_PER_MINUTE = 10_000
    GENERATION_RATE_LIMIT_PER_MINUTE = 10_000
    AIR_CACHE_TTL_SECONDS = 600
    HTTP_TIMEOUT_SECONDS = 2


@pytest.fixture()
def app():
    application = create_app(TestConfig)
    rate_limiter.reset()
    air_cache.clear()
    geo_cache.clear()
    yield application
    air_cache.clear()
    geo_cache.clear()
    rate_limiter.reset()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def sample_air():
    from app.services.air_quality import _demo_payload

    payload = _demo_payload(26.7271, 88.3953, "Siliguri, West Bengal, India")
    payload["meta"]["isDemo"] = False
    payload["meta"]["source"] = "Open-Meteo Air Quality + Weather"
    payload["meta"]["notice"] = None
    return payload
