"""Indoor air protection endpoint."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.indoor import generate_indoor_advice
from ..utils.validation import (
    clean_text,
    parse_bool,
    parse_float,
    parse_latitude,
    parse_longitude,
)

indoor_bp = Blueprint("indoor", __name__, url_prefix="/api")


@indoor_bp.get("/indoor")
def indoor():
    lat = parse_latitude(request.args.get("latitude"))
    lon = parse_longitude(request.args.get("longitude"))
    location_name = clean_text(
        request.args.get("name"),
        "name",
        min_length=1,
        max_length=80,
        required=False,
        default="",
    )
    area_sqm = parse_float(
        request.args.get("areaSqm", 30),
        "areaSqm",
        minimum=5,
        maximum=200,
        required=False,
        default=30,
    )
    has_purifier = parse_bool(request.args.get("hasPurifier"), default=False)
    demo = parse_bool(request.args.get("demo"), default=False)

    result = generate_indoor_advice(
        lat=lat,
        lon=lon,
        location_name=location_name,
        area_sqm=area_sqm or 30,
        has_purifier=has_purifier,
        demo=demo,
    )
    return jsonify(result)
