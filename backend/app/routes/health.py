"""Grounding health check for the API."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "service": "BreatheWise API",
            "version": "1.0.0",
            "time": datetime.now(timezone.utc).isoformat(),
            "features": {
                "geminiConfigured": bool(current_app.config.get("GEMINI_API_KEY")),
                "geminiModel": current_app.config.get("GEMINI_MODEL")
                if current_app.config.get("GEMINI_API_KEY")
                else None,
                "demoMode": bool(current_app.config.get("DEMO_MODE")),
                "airQualityProvider": "Open-Meteo",
                "geocodingProvider": "Open-Meteo Geocoding",
            },
        }
    )
