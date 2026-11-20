"""BreatheWise Flask application factory."""

from __future__ import annotations

import logging
import uuid

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config

from .routes import (
    air_bp,
    assistant_bp,
    family_bp,
    geo_bp,
    health_bp,
    indoor_bp,
    planner_bp,
)
from .services.rate_limit import rate_limiter
from .utils.errors import ApiError
from .utils.validation import get_client_ip


def create_app(config_object: type | object | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object or Config)
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    if not app.config.get("TESTING"):
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    for blueprint in (
        health_bp,
        air_bp,
        geo_bp,
        assistant_bp,
        planner_bp,
        family_bp,
        indoor_bp,
    ):
        app.register_blueprint(blueprint)

    @app.get("/")
    def index():
        return jsonify(
            {
                "name": "BreatheWise API",
                "version": "1.0.0",
                "status": "/api/health",
                "documentation": "See README.md for endpoint documentation.",
            }
        )

    @app.before_request
    def assign_request_context():
        g.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        if request.method == "OPTIONS":
            return None
        if request.path.startswith("/api/") and request.path != "/api/health":
            rate_limiter.enforce(
                f"global:{get_client_ip()}",
                int(app.config.get("RATE_LIMIT_PER_MINUTE", 90)),
            )
        return None

    @app.after_request
    def add_security_headers(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(self)"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify(error.to_dict()), error.status_code

    @app.errorhandler(404)
    def handle_not_found(_error):
        return (
            jsonify({"error": {"code": "not_found", "message": "That API route does not exist."}}),
            404,
        )

    @app.errorhandler(405)
    def handle_method_not_allowed(_error):
        return (
            jsonify(
                {
                    "error": {
                        "code": "method_not_allowed",
                        "message": "That HTTP method is not supported for this route.",
                    }
                }
            ),
            405,
        )

    @app.errorhandler(413)
    def handle_too_large(_error):
        return (
            jsonify(
                {
                    "error": {
                        "code": "payload_too_large",
                        "message": "Request body is too large.",
                    }
                }
            ),
            413,
        )

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception):
        if isinstance(error, HTTPException):
            return (
                jsonify(
                    {
                        "error": {
                            "code": "http_error",
                            "message": error.description or "Request could not be completed.",
                        }
                    }
                ),
                error.code or 500,
            )
        app.logger.exception("Unhandled API error", exc_info=error)
        return (
            jsonify(
                {
                    "error": {
                        "code": "internal_error",
                        "message": "Something went wrong on our side. Please try again.",
                    }
                }
            ),
            500,
        )

    return app
