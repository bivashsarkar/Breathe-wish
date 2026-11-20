"""Live air quality endpoint."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.air_quality import get_air_quality
from ..utils.validation import clean_text, parse_bool, parse_latitude, parse_longitude

air_bp = Blueprint("air", __name__, url_prefix="/api")


@air_bp.get("/air")
def air():
    lat = parse_latitude(request.args.get("latitude"))
    lon = parse_longitude(request.args.get("longitude"))
    name = clean_text(
        request.args.get("name"),
        "name",
        min_length=1,
        max_length=80,
        required=False,
        default="",
    )
    demo = parse_bool(request.args.get("demo"), default=False)
    force = parse_bool(request.args.get("refresh"), default=False)

    payload = get_air_quality(lat, lon, name, demo=demo, force=force)
    return jsonify(payload)
