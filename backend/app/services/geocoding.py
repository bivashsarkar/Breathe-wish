"""Forward and reverse geocoding.

Forward search uses Open-Meteo's free geocoding API. Reverse geocoding uses
BigDataCloud's keyless client endpoint with a graceful fallback, so a denied
browser location permission never breaks the app.
"""

from __future__ import annotations

from typing import Any

import requests
from flask import current_app

from ..utils.cache import geo_cache
from ..utils.errors import ApiError

USER_AGENT = "BreatheWise/1.0 (hackathon air-quality assistant)"


def search_locations(query: str) -> list[dict[str, Any]]:
    normalized = " ".join(query.lower().split())
    cache_key = f"geo:{normalized}"
    cached = geo_cache.get(cache_key)
    if cached is not None:
        return cached

    url = current_app.config["GEOCODE_BASE_URL"]
    timeout = int(current_app.config.get("HTTP_TIMEOUT_SECONDS", 12))
    try:
        response = requests.get(
            url,
            params={
                "name": query,
                "count": 8,
                "language": "en",
                "format": "json",
            },
            timeout=timeout,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
    except requests.RequestException as exc:
        raise ApiError(
            502,
            "geocoding_unavailable",
            "Location search is temporarily unavailable. Please try again.",
        ) from exc

    if response.status_code != 200:
        raise ApiError(
            502,
            "geocoding_error",
            "Location search is temporarily unavailable. Please try again.",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise ApiError(502, "geocoding_error", "Location search returned invalid data.") from exc

    results: list[dict[str, Any]] = []
    for item in (payload.get("results") or [])[:8]:
        try:
            latitude = float(item.get("latitude"))
            longitude = float(item.get("longitude"))
        except (TypeError, ValueError):
            continue
        parts = [item.get("name")]
        if item.get("admin1"):
            parts.append(item["admin1"])
        if item.get("country"):
            parts.append(item["country"])
        results.append(
            {
                "id": f"{item.get('id', '')}-{latitude:.3f}-{longitude:.3f}",
                "name": item.get("name") or "Unknown place",
                "label": ", ".join(part for part in parts if part),
                "admin1": item.get("admin1"),
                "country": item.get("country"),
                "countryCode": item.get("country_code"),
                "timezone": item.get("timezone"),
                "latitude": latitude,
                "longitude": longitude,
                "population": item.get("population"),
            }
        )

    geo_cache.set(
        cache_key,
        results,
        int(current_app.config.get("GEO_CACHE_TTL_SECONDS", 86_400)),
    )
    return results


def reverse_geocode(lat: float, lon: float) -> dict[str, Any]:
    """Resolve coordinates to a display name without making it a hard failure."""
    fallback = {
        "name": "My location",
        "label": f"My location ({lat:.2f}, {lon:.2f})",
        "latitude": lat,
        "longitude": lon,
        "resolved": False,
        "country": None,
        "admin1": None,
        "timezone": None,
    }
    cache_key = f"rev:{lat:.3f}:{lon:.3f}"
    cached = geo_cache.get(cache_key)
    if cached is not None:
        return cached

    url = current_app.config["REVERSE_GEOCODE_BASE_URL"]
    try:
        response = requests.get(
            url,
            params={
                "latitude": lat,
                "longitude": lon,
                "localityLanguage": "en",
            },
            timeout=min(int(current_app.config.get("HTTP_TIMEOUT_SECONDS", 12)), 7),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        if response.status_code == 200:
            payload = response.json()
            city = payload.get("city") or payload.get("locality") or payload.get("principalSubdivision")
            if city:
                country = payload.get("countryName")
                parts = [city]
                if payload.get("principalSubdivision") and payload.get("principalSubdivision") != city:
                    parts.append(payload["principalSubdivision"])
                if country:
                    parts.append(country)
                resolved = {
                    "name": city,
                    "label": ", ".join(parts),
                    "latitude": lat,
                    "longitude": lon,
                    "resolved": True,
                    "country": country,
                    "admin1": payload.get("principalSubdivision"),
                    "timezone": None,
                }
                geo_cache.set(cache_key, resolved, 86_400)
                return resolved
    except (requests.RequestException, ValueError):
        # Reverse geocoding is a nicety, not a requirement.
        pass

    return fallback
