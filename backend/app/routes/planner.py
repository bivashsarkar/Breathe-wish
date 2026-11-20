"""Smart daily planner endpoint."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from ..services.planner import generate_plan
from ..services.rate_limit import rate_limiter
from ..utils.errors import ApiError
from ..utils.validation import (
    clean_text,
    get_client_ip,
    json_body,
    parse_bool,
    parse_float,
    parse_latitude,
    parse_longitude,
    require_mapping,
)

planner_bp = Blueprint("planner", __name__, url_prefix="/api")

OCCUPATIONS = {"student", "office", "remote", "outdoor-worker", "homemaker", "other"}
TRANSPORT = {"walk", "cycle", "bus", "metro", "two-wheeler", "car", "mixed"}
OUTDOOR_ACTIVITIES = {"walking", "running", "cycling", "sports", "none"}
ACTIVITY_TIMES = {"morning", "afternoon", "evening"}


def _choice(value, field: str, allowed: set[str], default: str) -> str:
    if value is None:
        return default
    if not isinstance(value, str) or value not in allowed:
        raise ApiError(
            400,
            "invalid_field",
            f"'{field}' must be one of: {', '.join(sorted(allowed))}.",
        )
    return value


@planner_bp.post("/planner")
def planner():
    rate_limiter.enforce(
        f"planner:{get_client_ip()}",
        int(current_app.config.get("GENERATION_RATE_LIMIT_PER_MINUTE", 30)),
    )

    body = json_body()
    raw_profile = require_mapping(body.get("profile"), "profile")
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

    profile = {
        "occupation": _choice(raw_profile.get("occupation"), "occupation", OCCUPATIONS, "office"),
        "transport": _choice(raw_profile.get("transport"), "transport", TRANSPORT, "mixed"),
        "outdoorActivity": _choice(
            raw_profile.get("outdoorActivity"),
            "outdoorActivity",
            OUTDOOR_ACTIVITIES,
            "walking",
        ),
        "activityTime": _choice(
            raw_profile.get("activityTime"),
            "activityTime",
            ACTIVITY_TIMES,
            "morning",
        ),
        "commuteDistanceKm": parse_float(
            raw_profile.get("commuteDistanceKm", 10),
            "commuteDistanceKm",
            minimum=0.5,
            maximum=100,
            required=False,
            default=10,
        ),
        "hasChildren": parse_bool(raw_profile.get("hasChildren"), default=False),
        "hasElderly": parse_bool(raw_profile.get("hasElderly"), default=False),
    }

    result = generate_plan(
        profile,
        lat=lat,
        lon=lon,
        location_name=location_name,
        demo=demo,
    )
    return jsonify(result)
