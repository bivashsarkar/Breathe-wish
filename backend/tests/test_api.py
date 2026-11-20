"""API contract, validation and resilience tests (no network required)."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest


def _upstream_fixtures():
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    times = [(now + timedelta(hours=offset)).strftime("%Y-%m-%dT%H:%M") for offset in range(24)]
    air = {
        "latitude": 26.7271,
        "longitude": 88.3953,
        "timezone": "Asia/Kolkata",
        "elevation": 124,
        "current": {
            "time": times[0],
            "us_aqi": 168,
            "european_aqi": 58,
            "pm2_5": 72.4,
            "pm10": 96.2,
            "carbon_monoxide": 950,
            "nitrogen_dioxide": 19.4,
            "ozone": 88.0,
            "sulphur_dioxide": 7.2,
            "dust": 31,
        },
        "hourly": {
            "time": times,
            "us_aqi": [150 + (index % 6) * 8 for index in range(24)],
            "pm2_5": [64 + (index % 5) * 3 for index in range(24)],
            "pm10": [90 + (index % 4) * 4 for index in range(24)],
        },
    }
    weather = {
        "timezone": "Asia/Kolkata",
        "current": {
            "time": times[0],
            "temperature_2m": 24.4,
            "relative_humidity_2m": 71,
            "apparent_temperature": 26.0,
            "is_day": 1,
            "precipitation": 0,
            "weather_code": 45,
            "cloud_cover": 20,
            "surface_pressure": 1004,
            "wind_speed_10m": 4.1,
            "wind_direction_10m": 45,
            "wind_gusts_10m": 8.0,
            "uv_index": 2.1,
            "visibility": 6000,
        },
        "hourly": {
            "time": times,
            "temperature_2m": [24.0] * 24,
            "precipitation_probability": [0] * 24,
            "weather_code": [45] * 24,
        },
        "daily": {
            "time": [row[:10] for row in times[:7]],
            "weather_code": [45] * 7,
            "temperature_2m_max": [27] * 7,
            "temperature_2m_min": [18] * 7,
            "sunrise": [f"{row[:10]}T05:57" for row in times[:7]],
            "sunset": [f"{row[:10]}T16:44" for row in times[:7]],
            "uv_index_max": [4.0] * 7,
            "precipitation_probability_max": [5] * 7,
        },
    }
    return air, weather


# ---------------------------------------------------------------------------
# Health + errors
# ---------------------------------------------------------------------------


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["features"]["geminiConfigured"] is False
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_unknown_route_returns_json(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


# ---------------------------------------------------------------------------
# Air quality
# ---------------------------------------------------------------------------


def test_air_requires_coordinates(client):
    response = client.get("/api/air")
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "missing_field"


def test_air_rejects_out_of_range_latitude(client):
    response = client.get("/api/air?latitude=120&longitude=88")
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "out_of_range"


def test_air_live_payload(monkeypatch, client):
    from app.services import air_quality

    air, weather = _upstream_fixtures()
    monkeypatch.setattr(air_quality, "_fetch_upstream", lambda lat, lon: (air, weather, []))

    response = client.get("/api/air?latitude=26.7271&longitude=88.3953&name=Siliguri")
    assert response.status_code == 200
    body = response.get_json()
    assert body["current"]["aqi"] == 168
    assert body["current"]["category"]["level"] == "unhealthy"
    assert body["current"]["pollutants"]["pm2_5"]["displayValue"] == 72.4
    assert body["current"]["pollutants"]["co"]["displayUnit"] == "mg/m³"
    assert body["current"]["weather"]["condition"] == "Fog"
    assert body["meta"]["isDemo"] is False
    assert "Open-Meteo" in body["meta"]["source"]
    assert len(body["recommendations"]) >= 5
    assert body["insights"]["bestOutdoorWindow"] is not None


def test_air_demo_mode_is_labelled(client):
    response = client.get("/api/air?latitude=26.7&longitude=88.4&demo=1&name=Demo")
    assert response.status_code == 200
    body = response.get_json()
    assert body["meta"]["isDemo"] is True
    assert "illustrative" in body["meta"]["attribution"].lower()


def test_air_returns_clear_error_when_upstream_fails(monkeypatch, client):
    from app.services import air_quality
    from app.utils.errors import ApiError

    def fail(lat, lon):
        raise ApiError(502, "upstream_unavailable", "Live environmental data is unavailable.")

    monkeypatch.setattr(air_quality, "_fetch_upstream", fail)
    response = client.get("/api/air?latitude=26.7&longitude=88.4")
    assert response.status_code == 502
    assert response.get_json()["error"]["code"] == "upstream_unavailable"


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------


def test_geocode_requires_query(client):
    response = client.get("/api/geocode?q=a")
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "invalid_field"


def test_geocode_returns_results(monkeypatch, client):
    from app.services import geocoding

    monkeypatch.setattr(
        geocoding,
        "search_locations",
        lambda query: [
            {
                "id": "1",
                "name": "Siliguri",
                "label": "Siliguri, West Bengal, India",
                "latitude": 26.71,
                "longitude": 88.42,
            }
        ],
    )
    response = client.get("/api/geocode?q=siliguri")
    assert response.status_code == 200
    assert response.get_json()["results"][0]["name"] == "Siliguri"


# ---------------------------------------------------------------------------
# AI assistant
# ---------------------------------------------------------------------------


def test_assistant_demo_mode_is_grounded_and_labelled(monkeypatch, client, sample_air):
    from app.services import assistant

    monkeypatch.setattr(assistant, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/assistant",
        json={
            "message": "Is it safe to go outside today?",
            "latitude": 26.7271,
            "longitude": 88.3953,
            "locationName": "Siliguri",
            "history": [],
        },
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["mode"] == "demo"
    assert body["groundedOn"]["aqi"] == 202
    assert "GEMINI_API_KEY" in body["notice"]
    assert "Siliguri" in body["reply"]
    assert "not medical advice" in body["disclaimer"].lower()


def test_assistant_validates_empty_message(client):
    response = client.post(
        "/api/assistant",
        json={"message": " ", "latitude": 26.7, "longitude": 88.4},
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "invalid_field"


# ---------------------------------------------------------------------------
# Planner
# ---------------------------------------------------------------------------


def test_planner_generates_plan(monkeypatch, client, sample_air):
    from app.services import planner

    monkeypatch.setattr(planner, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/planner",
        json={
            "latitude": 26.7271,
            "longitude": 88.3953,
            "locationName": "Siliguri",
            "profile": {
                "occupation": "office",
                "transport": "car",
                "outdoorActivity": "running",
                "activityTime": "morning",
                "commuteDistanceKm": 12,
                "hasChildren": True,
                "hasElderly": False,
            },
        },
    )
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["plan"]) == 6
    assert body["bestWindow"] is not None
    assert body["alerts"]
    assert body["alternatives"]["options"]
    assert body["alternatives"]["options"][0]["estimatedCo2SavedKgPerWeek"] > 0
    assert "not medical advice" in body["disclaimer"].lower()


def test_planner_rejects_invalid_transport(monkeypatch, client, sample_air):
    from app.services import planner

    monkeypatch.setattr(planner, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/planner",
        json={
            "latitude": 26.7,
            "longitude": 88.4,
            "profile": {"transport": "rocket"},
        },
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "invalid_field"


def test_planner_rejects_invalid_distance(monkeypatch, client, sample_air):
    from app.services import planner

    monkeypatch.setattr(planner, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/planner",
        json={
            "latitude": 26.7,
            "longitude": 88.4,
            "profile": {"commuteDistanceKm": 500},
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Family
# ---------------------------------------------------------------------------


def test_family_advice_is_group_specific(monkeypatch, client, sample_air):
    from app.services import family

    monkeypatch.setattr(family, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/family/advice",
        json={
            "latitude": 26.7,
            "longitude": 88.4,
            "locationName": "Siliguri",
            "members": [
                {"name": "Aarav", "relation": "child", "age": 7},
                {"name": "Meera", "relation": "elderly", "age": 72},
                {"name": "Rohan", "relation": "adult", "age": 38},
            ],
        },
    )
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["members"]) == 3
    assert body["members"][0]["riskLevel"] in {"high", "very-high"}
    assert body["household"]
    assert "not medical advice" in body["disclaimer"].lower()


def test_family_rejects_unknown_relation(monkeypatch, client, sample_air):
    from app.services import family

    monkeypatch.setattr(family, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.post(
        "/api/family/advice",
        json={
            "latitude": 26.7,
            "longitude": 88.4,
            "members": [{"name": "Sam", "relation": "robot"}],
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Indoor
# ---------------------------------------------------------------------------


def test_indoor_guidance(monkeypatch, client, sample_air):
    from app.services import indoor

    monkeypatch.setattr(indoor, "get_air_quality", lambda *args, **kwargs: sample_air)
    response = client.get(
        "/api/indoor?latitude=26.7&longitude=88.4&areaSqm=30&hasPurifier=true&name=Siliguri"
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["ventilation"]["status"] in {"open", "brief", "closed"}
    assert body["purifier"]["cadrMin"] > 0
    assert len(body["checklist"]) == 6
    assert body["tips"]


def test_indoor_validates_area(client):
    response = client.get("/api/indoor?latitude=26.7&longitude=88.4&areaSqm=999")
    assert response.status_code == 400
