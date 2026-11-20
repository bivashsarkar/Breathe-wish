"""Input validation helpers used by every route."""

from __future__ import annotations

import math
from typing import Any, Mapping

from flask import Request, request

from .errors import ApiError


def parse_float(
    value: Any,
    field: str,
    *,
    minimum: float | None = None,
    maximum: float | None = None,
    required: bool = True,
    default: float | None = None,
) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ApiError(400, "missing_field", f"'{field}' is required.")
        return default
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ApiError(400, "invalid_field", f"'{field}' must be a number.") from exc
    if not math.isfinite(number):
        raise ApiError(400, "invalid_field", f"'{field}' must be a finite number.")
    if minimum is not None and number < minimum:
        raise ApiError(400, "out_of_range", f"'{field}' must be at least {minimum}.")
    if maximum is not None and number > maximum:
        raise ApiError(400, "out_of_range", f"'{field}' must be at most {maximum}.")
    return number


def parse_int(
    value: Any,
    field: str,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
    required: bool = True,
    default: int | None = None,
) -> int | None:
    number = parse_float(
        value,
        field,
        minimum=minimum,
        maximum=maximum,
        required=required,
        default=default,
    )
    if number is None:
        return None
    if number != int(number):
        raise ApiError(400, "invalid_field", f"'{field}' must be a whole number.")
    return int(number)


def parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def clean_text(
    value: Any,
    field: str,
    *,
    min_length: int = 1,
    max_length: int = 200,
    required: bool = True,
    default: str = "",
) -> str:
    if value is None:
        if required:
            raise ApiError(400, "missing_field", f"'{field}' is required.")
        return default
    if not isinstance(value, str):
        raise ApiError(400, "invalid_field", f"'{field}' must be text.")
    cleaned = " ".join(value.split()).strip()
    if len(cleaned) < min_length:
        if required:
            raise ApiError(
                400,
                "invalid_field",
                f"'{field}' must be at least {min_length} characters.",
            )
        return default
    if len(cleaned) > max_length:
        raise ApiError(
            400,
            "invalid_field",
            f"'{field}' must be at most {max_length} characters.",
        )
    return cleaned


def parse_latitude(value: Any) -> float:
    parsed = parse_float(value, "latitude", minimum=-90, maximum=90)
    assert parsed is not None
    return parsed


def parse_longitude(value: Any) -> float:
    parsed = parse_float(value, "longitude", minimum=-180, maximum=180)
    assert parsed is not None
    return parsed


def json_body() -> dict[str, Any]:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "invalid_body", "Request body must be a JSON object.")
    return body


def get_client_ip(req: Request | None = None) -> str:
    active = req or request
    forwarded = active.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (active.remote_addr or "unknown")[:64]


def require_mapping(value: Any, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ApiError(400, "invalid_field", f"'{field}' must be an object.")
    return value
