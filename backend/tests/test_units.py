"""Pure-function unit tests for AQI, windows, savings and rate limiting."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.services.air_quality import categorize_aqi, find_best_window
from app.services.planner import _estimate_savings
from app.services.rate_limit import SlidingWindowLimiter


def test_aqi_categories_match_epa_breakpoints():
    assert categorize_aqi(0)["level"] == "good"
    assert categorize_aqi(50)["level"] == "good"
    assert categorize_aqi(51)["level"] == "moderate"
    assert categorize_aqi(101)["level"] == "sensitive"
    assert categorize_aqi(151)["level"] == "unhealthy"
    assert categorize_aqi(201)["level"] == "very-unhealthy"
    assert categorize_aqi(400)["level"] == "hazardous"
    assert categorize_aqi(None)["level"] == "unknown"


def test_find_best_window_prefers_cleanest_daylight_hours():
    start = datetime.now().replace(hour=7, minute=0, second=0, microsecond=0)
    hourly = []
    for index in range(18):
        moment = start + timedelta(hours=index)
        hourly.append(
            {
                "time": moment.strftime("%Y-%m-%dT%H:%M"),
                "label": moment.strftime("%H:%M"),
                "aqi": 160 if index < 8 else (42 if index in (9, 10) else 120),
            }
        )
    best = find_best_window(hourly)
    assert best is not None
    assert best["averageAqi"] == 42
    assert best["startLabel"] in {"16:00", "17:00"}


def test_find_best_window_returns_none_without_data():
    assert find_best_window([]) is None


def test_car_to_metro_savings_are_positive():
    result = _estimate_savings("car", 10)
    metro = next(option for option in result["options"] if option["id"] == "metro")
    # (0.192 - 0.041) * 10 * 2 * 5 = 15.1 kg per week
    assert metro["estimatedCo2SavedKgPerWeek"] == 15.1
    assert metro["dailyCo2SavedKg"] == 3.02


def test_walking_has_no_tailpipe_emissions_message():
    result = _estimate_savings("walk", 4)
    assert any(option["id"] == "keep-active" for option in result["options"])


def test_rate_limiter_blocks_after_limit_and_recovers():
    limiter = SlidingWindowLimiter()
    assert limiter.allow("ip", 2)
    assert limiter.allow("ip", 2)
    assert not limiter.allow("ip", 2)
    limiter.reset()
    assert limiter.allow("ip", 1)
