"""Location search and coordinate resolution."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.geocoding import reverse_geocode, search_locations
from ..utils.validation import clean_text, parse_latitude, parse_longitude

geo_bp = Blueprint("geo", __name__, url_prefix="/api/geocode")


@geo_bp.get("")
def geocode():
    query = clean_text(
        request.args.get("q"),
        "q",
        min_length=2,
        max_length=80,
        required=True,
    )
    results = search_locations(query)
    return jsonify({"query": query, "results": results})


@geo_bp.get("/reverse")
def reverse():
    lat = parse_latitude(request.args.get("latitude"))
    lon = parse_longitude(request.args.get("longitude"))
    return jsonify(reverse_geocode(lat, lon))
