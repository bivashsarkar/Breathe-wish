"""AI assistant endpoint. The Gemini key never leaves the server."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from ..services.assistant import answer_question
from ..services.rate_limit import rate_limiter
from ..utils.errors import ApiError
from ..utils.validation import (
    clean_text,
    get_client_ip,
    json_body,
    parse_bool,
    parse_latitude,
    parse_longitude,
)

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api")


@assistant_bp.post("/assistant")
def assistant():
    rate_limiter.enforce(
        f"assistant:{get_client_ip()}",
        int(current_app.config.get("ASSISTANT_RATE_LIMIT_PER_MINUTE", 15)),
    )

    body = json_body()
    message = clean_text(body.get("message"), "message", min_length=2, max_length=1000)
    lat = parse_latitude(body.get("latitude"))
    lon = parse_longitude(body.get("longitude"))
    location_name = clean_text(
        body.get("locationName"),
        "locationName",
        min_length=1,
        max_length=80,
        required=False,
        default="",
    )
    demo = parse_bool(body.get("demo"), default=False)

    history = body.get("history") or []
    if not isinstance(history, list):
        raise ApiError(400, "invalid_field", "'history' must be a list.")
    if len(history) > 12:
        history = history[-12:]

    result = answer_question(
        message,
        history,
        lat=lat,
        lon=lon,
        location_name=location_name,
        demo=demo,
    )
    return jsonify(result)
