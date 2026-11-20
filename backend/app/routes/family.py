"""Family protection advice endpoint."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.family import generate_family_advice
from ..utils.errors import ApiError
from ..utils.validation import (
    clean_text,
    json_body,
    parse_bool,
    parse_int,
    parse_latitude,
    parse_longitude,
    require_mapping,
)

family_bp = Blueprint("family", __name__, url_prefix="/api/family")

RELATIONS = {"child", "adult", "elderly"}


@family_bp.post("/advice")
def advice():
    body = json_body()
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

    raw_members = body.get("members") or []
    if not isinstance(raw_members, list):
        raise ApiError(400, "invalid_field", "'members' must be a list.")
    if len(raw_members) > 10:
        raise ApiError(400, "too_many_members", "You can add up to 10 family members.")

    members = []
    for index, item in enumerate(raw_members):
        member = require_mapping(item, f"members[{index}]")
        relation = member.get("relation")
        if relation not in RELATIONS:
            raise ApiError(
                400,
                "invalid_field",
                f"'members[{index}].relation' must be child, adult or elderly.",
            )
        name = clean_text(
            member.get("name"),
            f"members[{index}].name",
            min_length=1,
            max_length=40,
        )
        age = parse_int(
            member.get("age"),
            f"members[{index}].age",
            minimum=0,
            maximum=120,
            required=False,
            default=None,
        )
        activity = clean_text(
            member.get("activity"),
            f"members[{index}].activity",
            min_length=1,
            max_length=40,
            required=False,
            default="",
        )
        members.append(
            {
                "id": f"member-{index}",
                "name": name,
                "relation": relation,
                "age": age,
                "activity": activity or None,
            }
        )

    result = generate_family_advice(
        members,
        lat=lat,
        lon=lon,
        location_name=location_name,
        demo=demo,
    )
    return jsonify(result)
