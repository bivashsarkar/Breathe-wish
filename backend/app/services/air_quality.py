"""Live air quality + weather aggregation.

Data source: Open-Meteo Air Quality API and Open-Meteo Weather API
(https://open-meteo.com, CC BY 4.0). Neither requires an API key.

Design notes
------------
* Upstream requests run in parallel and are cached for a few minutes.
* AQI categories follow the US EPA breakpoints returned by Open-Meteo.
* Pollutant guidance uses WHO 2021 global air quality guideline values.
* If Open-Meteo is unreachable, we either return a clear 502 error or a
  *clearly labelled* demo dataset when DEMO_MODE / ?demo=1 is enabled.
"""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from flask import current_app

from ..utils.cache import air_cache
from ..utils.errors import ApiError

AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "BreatheWise/1.0 (hackathon air-quality assistant)"

AIR_FIELDS = (
    "us_aqi,european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,"
    "ozone,sulphur_dioxide,dust"
)
HOURLY_AIR_FIELDS = "us_aqi,pm2_5,pm10"
WEATHER_CURRENT_FIELDS = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
    "precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,"
    "wind_direction_10m,wind_gusts_10m,uv_index,visibility"
)
WEATHER_HOURLY_FIELDS = "temperature_2m,precipitation_probability,weather_code"

AQI_BANDS = (
    (50, "good", "Good", "#15803D", "#ECFDF3"),
    (100, "moderate", "Moderate", "#A16207", "#FEF9C3"),
    (150, "sensitive", "Unhealthy for Sensitive Groups", "#C2410C", "#FFEDD5"),
    (200, "unhealthy", "Unhealthy", "#B91C1C", "#FEE2E2"),
    (300, "very-unhealthy", "Very Unhealthy", "#7E22CE", "#F3E8FF"),
    (None, "hazardous", "Hazardous", "#7F1D1D", "#FECACA"),
)

AQI_ADVICE = {
    "good": (
        "Air quality is satisfactory. Outdoor activity is fine for most people.",
        "Enjoy normal outdoor activities and air out your home.",
    ),
    "moderate": (
        "Air quality is acceptable, though unusually sensitive people may notice mild effects.",
        "Sensitive people should watch for symptoms during long or intense outdoor activity.",
    ),
    "sensitive": (
        "Sensitive groups may feel effects. Everyone should consider reducing prolonged outdoor exertion.",
        "Children, older adults and people with heart or lung conditions should take it easier outdoors.",
    ),
    "unhealthy": (
        "Some people will feel effects and sensitive groups may feel stronger effects. Limit outdoor exposure.",
        "Move exercise indoors, keep windows closed and use a well-fitted N95/FFP2 mask if travel is essential.",
    ),
    "very-unhealthy": (
        "Health alert: everyone may experience more serious effects. Avoid outdoor exertion.",
        "Stay indoors where possible, filter indoor air and avoid all outdoor burning.",
    ),
    "hazardous": (
        "Emergency conditions. Avoid outdoor activity and keep indoor air filtered.",
        "Follow local health advisories. Seek medical help if you feel unwell.",
    ),
}

WMO_CONDITIONS = {
    0: ("Clear sky", "sun"),
    1: ("Mainly clear", "sun"),
    2: ("Partly cloudy", "cloud-sun"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "fog"),
    48: ("Rime fog", "fog"),
    51: ("Light drizzle", "drizzle"),
    53: ("Drizzle", "drizzle"),
    55: ("Heavy drizzle", "drizzle"),
    56: ("Freezing drizzle", "drizzle"),
    57: ("Freezing drizzle", "drizzle"),
    61: ("Light rain", "rain"),
    63: ("Rain", "rain"),
    65: ("Heavy rain", "rain"),
    66: ("Freezing rain", "rain"),
    67: ("Freezing rain", "rain"),
    71: ("Light snow", "snow"),
    73: ("Snow", "snow"),
    75: ("Heavy snow", "snow"),
    77: ("Snow grains", "snow"),
    80: ("Rain showers", "rain"),
    81: ("Rain showers", "rain"),
    82: ("Heavy showers", "rain"),
    85: ("Snow showers", "snow"),
    86: ("Snow showers", "snow"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm with hail", "storm"),
    99: ("Thunderstorm with hail", "storm"),
}

POLLUTANT_SPECS = (
    # key, label, api key, unit, WHO guideline, guideline unit, short description
    ("pm2_5", "PM2.5", "pm2_5", "µg/m³", 15, "µg/m³", "Fine particles that reach deep into the lungs"),
    ("pm10", "PM10", "pm10", "µg/m³", 45, "µg/m³", "Coarse dust and smoke particles"),
    ("no2", "NO₂", "nitrogen_dioxide", "µg/m³", 25, "µg/m³", "Traffic and combustion-related gas"),
    ("o3", "O₃", "ozone", "µg/m³", 100, "µg/m³", "Ground-level ozone formed in sunlight"),
    ("so2", "SO₂", "sulphur_dioxide", "µg/m³", 40, "µg/m³", "Coal, oil and industrial combustion"),
    ("co", "CO", "carbon_monoxide", "µg/m³", 4, "mg/m³", "Incomplete combustion; low-oxygen risk indoors"),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _round(value: Any, digits: int = 1) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, digits)


def _tz(name: str | None) -> ZoneInfo | timezone:
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def _now_in(name: str | None) -> datetime:
    return datetime.now(_tz(name))


def _format_clock(time_str: str) -> str:
    try:
        return datetime.fromisoformat(time_str).strftime("%H:%M")
    except ValueError:
        return time_str[-5:]


def _cardinal(degrees: Any) -> str:
    if degrees is None:
        return "—"
    directions = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    try:
        index = int((float(degrees) % 360) / 45 + 0.5) % 8
    except (TypeError, ValueError):
        return "—"
    return directions[index]


def categorize_aqi(aqi: float | None) -> dict[str, Any]:
    """Return an EPA-style category object for a US AQI value."""
    if aqi is None:
        return {
            "level": "unknown",
            "label": "Unavailable",
            "color": "#64748B",
            "softColor": "#F1F5F9",
            "advice": "Live air quality data is not available right now.",
            "sensitiveAdvice": "Check back shortly or consult your local pollution board.",
        }
    value = max(0.0, float(aqi))
    for upper, level, label, color, soft in AQI_BANDS:
        if upper is None or value <= upper:
            advice, sensitive = AQI_ADVICE[level]
            return {
                "level": level,
                "label": label,
                "color": color,
                "softColor": soft,
                "advice": advice,
                "sensitiveAdvice": sensitive,
            }
    # pragma: no cover - the final band always matches
    return {
        "level": "hazardous",
        "label": "Hazardous",
        "color": "#7F1D1D",
        "softColor": "#FECACA",
        "advice": AQI_ADVICE["hazardous"][0],
        "sensitiveAdvice": AQI_ADVICE["hazardous"][1],
    }


def weather_condition(code: Any) -> tuple[str, str]:
    try:
        return WMO_CONDITIONS.get(int(code), ("Mixed conditions", "cloud"))
    except (TypeError, ValueError):
        return ("Mixed conditions", "cloud")


def _fetch_json(url: str, params: dict[str, Any], timeout: int) -> dict[str, Any]:
    try:
        response = requests.get(
            url,
            params=params,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
    except requests.RequestException as exc:
        raise ApiError(
            502,
            "upstream_unavailable",
            "Live environmental data is temporarily unavailable. Please try again.",
        ) from exc
    if response.status_code != 200:
        raise ApiError(
            502,
            "upstream_error",
            "The environmental data provider returned an unexpected response.",
            {"status": response.status_code},
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ApiError(
            502, "upstream_error", "The environmental data provider sent invalid data."
        ) from exc
    if not isinstance(payload, dict):
        raise ApiError(502, "upstream_error", "The environmental data provider sent invalid data.")
    return payload


def _fetch_upstream(lat: float, lon: float) -> tuple[dict[str, Any], dict[str, Any] | None, list[str]]:
    timeout = int(current_app.config.get("HTTP_TIMEOUT_SECONDS", 12))
    air_params = {
        "latitude": lat,
        "longitude": lon,
        "current": AIR_FIELDS,
        "hourly": HOURLY_AIR_FIELDS,
        "timezone": "auto",
        "forecast_days": 7,
    }
    weather_params = {
        "latitude": lat,
        "longitude": lon,
        "current": WEATHER_CURRENT_FIELDS,
        "hourly": WEATHER_HOURLY_FIELDS,
        "daily": (
            "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,"
            "uv_index_max,precipitation_probability_max"
        ),
        "timezone": "auto",
        "forecast_days": 7,
    }

    warnings: list[str] = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        air_future = pool.submit(_fetch_json, AIR_URL, air_params, timeout)
        weather_future = pool.submit(_fetch_json, WEATHER_URL, weather_params, timeout)
        air = air_future.result()  # air quality is essential
        try:
            weather = weather_future.result()
        except ApiError:
            weather = None
            warnings.append("Weather data is temporarily unavailable; air quality is still live.")
    return air, weather, warnings


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------


def _pollutants(current: dict[str, Any]) -> dict[str, Any]:
    pollutants: dict[str, Any] = {}
    for key, label, api_key, unit, guideline, guideline_unit, description in POLLUTANT_SPECS:
        raw = current.get(api_key)
        if raw is None:
            continue
        value = _round(raw)
        if value is None:
            continue
        if key == "co":
            display_value = _round(value / 1000, 2)
            display_unit = "mg/m³"
        else:
            display_value = value
            display_unit = unit
        percent = None
        if display_value is not None and guideline:
            percent = round((display_value / guideline) * 100, 0)
        pollutants[key] = {
            "key": key,
            "label": label,
            "value": value,
            "unit": unit,
            "displayValue": display_value,
            "displayUnit": display_unit,
            "guideline": guideline,
            "guidelineUnit": guideline_unit,
            "percentOfGuideline": percent,
            "description": description,
        }
    return pollutants


def _weather_current(weather: dict[str, Any] | None) -> dict[str, Any] | None:
    if not weather:
        return None
    current = weather.get("current") or {}
    if not current:
        return None
    condition, icon = weather_condition(current.get("weather_code"))
    visibility = _round(current.get("visibility"))
    return {
        "time": current.get("time"),
        "temperature": _round(current.get("temperature_2m")),
        "apparentTemperature": _round(current.get("apparent_temperature")),
        "humidity": _round(current.get("relative_humidity_2m"), 0),
        "windSpeed": _round(current.get("wind_speed_10m")),
        "windGust": _round(current.get("wind_gusts_10m")),
        "windDirection": _round(current.get("wind_direction_10m"), 0),
        "windDirectionLabel": _cardinal(current.get("wind_direction_10m")),
        "condition": condition,
        "icon": icon,
        "weatherCode": current.get("weather_code"),
        "precipitation": _round(current.get("precipitation")),
        "cloudCover": _round(current.get("cloud_cover"), 0),
        "pressure": _round(current.get("surface_pressure")),
        "uvIndex": _round(current.get("uv_index")),
        "visibilityKm": _round(visibility / 1000, 1) if visibility is not None else None,
        "isDay": bool(current.get("is_day")),
        "sunrise": (weather.get("daily") or {}).get("sunrise", [None])[0],
        "sunset": (weather.get("daily") or {}).get("sunset", [None])[0],
    }


def _merge_hourly(air: dict[str, Any], weather: dict[str, Any] | None) -> list[dict[str, Any]]:
    hourly_air = air.get("hourly") or {}
    times = hourly_air.get("time") or []
    if not times:
        return []

    hourly_weather = (weather or {}).get("hourly") or {}
    weather_times = hourly_weather.get("time") or []
    weather_index = {value: index for index, value in enumerate(weather_times)}

    tz_name = air.get("timezone")
    cutoff = _now_in(tz_name) - timedelta(minutes=30)

    rows: list[dict[str, Any]] = []
    for index, timestamp in enumerate(times):
        try:
            parsed = datetime.fromisoformat(timestamp)
        except ValueError:
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=_tz(tz_name))
        if parsed < cutoff:
            continue

        aqi = _round((hourly_air.get("us_aqi") or [None] * len(times))[index])
        if aqi is None:
            continue
        weather_pos = weather_index.get(timestamp)
        temp = None
        precip_prob = None
        code = None
        if weather_pos is not None:
            temp = _round((hourly_weather.get("temperature_2m") or [None])[weather_pos])
            precip_prob = _round(
                (hourly_weather.get("precipitation_probability") or [None])[weather_pos], 0
            )
            code = (hourly_weather.get("weather_code") or [None])[weather_pos]
        condition, icon = weather_condition(code)
        rows.append(
            {
                "time": timestamp,
                "label": _format_clock(timestamp),
                "aqi": aqi,
                "pm2_5": _round((hourly_air.get("pm2_5") or [None])[index]),
                "pm10": _round((hourly_air.get("pm10") or [None])[index]),
                "temperature": temp,
                "precipitationProbability": precip_prob,
                "weatherCode": code,
                "condition": condition,
                "icon": icon,
            }
        )
        if len(rows) >= 25:
            break
    return rows


def _build_daily(
    hourly: list[dict[str, Any]], weather: dict[str, Any] | None
) -> list[dict[str, Any]]:
    weather_daily = (weather or {}).get("daily") or {}
    dates = weather_daily.get("time") or []
    if not dates:
        dates = sorted({row["time"][:10] for row in hourly})[:7]

    by_date: dict[str, list[dict[str, Any]]] = {}
    for row in hourly:
        by_date.setdefault(row["time"][:10], []).append(row)

    daily: list[dict[str, Any]] = []
    for index, date in enumerate(dates[:7]):
        rows = by_date.get(date, [])
        aqis = [row["aqi"] for row in rows if row.get("aqi") is not None]
        pm_values = [row["pm2_5"] for row in rows if row.get("pm2_5") is not None]
        code = (weather_daily.get("weather_code") or [None] * len(dates))[index]
        condition, icon = weather_condition(code)
        try:
            weekday = datetime.strptime(date, "%Y-%m-%d").strftime("%a")
        except ValueError:
            weekday = date
        daily.append(
            {
                "date": date,
                "weekday": weekday,
                "aqiMax": max(aqis) if aqis else None,
                "aqiAvg": round(sum(aqis) / len(aqis), 1) if aqis else None,
                "pm2_5Max": max(pm_values) if pm_values else None,
                "tempMax": _round((weather_daily.get("temperature_2m_max") or [None] * len(dates))[index]),
                "tempMin": _round((weather_daily.get("temperature_2m_min") or [None] * len(dates))[index]),
                "precipitationProbability": _round(
                    (weather_daily.get("precipitation_probability_max") or [None] * len(dates))[index],
                    0,
                ),
                "weatherCode": code,
                "condition": condition,
                "icon": icon,
                "uvIndexMax": _round((weather_daily.get("uv_index_max") or [None] * len(dates))[index]),
            }
        )
    return daily


# ---------------------------------------------------------------------------
# Insight + recommendation rules
# ---------------------------------------------------------------------------


def find_best_window(
    hourly: list[dict[str, Any]],
    *,
    duration_hours: int = 2,
    start_hour: int = 6,
    end_hour: int = 20,
) -> dict[str, Any] | None:
    """Find the cleanest consecutive daylight window in the next 24 hours."""
    if not hourly:
        return None
    best: dict[str, Any] | None = None
    best_score = float("inf")
    for index in range(0, max(0, len(hourly) - duration_hours + 1)):
        group = hourly[index : index + duration_hours]
        if len(group) < duration_hours:
            continue
        scores: list[float] = []
        valid = True
        for item in group:
            try:
                hour = int(item["time"][11:13])
            except (KeyError, ValueError, TypeError):
                valid = False
                break
            aqi = item.get("aqi")
            if aqi is None:
                valid = False
                break
            if hour < start_hour or hour > end_hour:
                valid = False
                break
            scores.append(float(aqi))
        if not valid or not scores:
            continue
        average = sum(scores) / len(scores)
        if average < best_score:
            best_score = average
            best = {
                "start": group[0]["time"],
                "end": group[-1]["time"],
                "startLabel": _format_clock(group[0]["time"]),
                "endLabel": _format_clock(group[-1]["time"]),
                "averageAqi": round(average, 0),
                "category": categorize_aqi(average),
            }
    return best


def _build_insights(
    current: dict[str, Any],
    hourly: list[dict[str, Any]],
    daily: list[dict[str, Any]],
) -> dict[str, Any]:
    aqi = current["aqi"]
    category = current["category"]
    best = find_best_window(hourly)
    min_row = min(hourly, key=lambda row: row["aqi"]) if hourly else None

    if best and best["averageAqi"] <= 50:
        ventilation = (
            f"Good time to ventilate: open windows around {best['startLabel']}–{best['endLabel']} "
            "for 10–15 minutes."
        )
    elif best and best["averageAqi"] <= 100:
        ventilation = (
            f"Outdoor air is cleanest around {best['startLabel']}–{best['endLabel']}. "
            "A short 10-minute airing is reasonable if the indoor air feels stale."
        )
    elif min_row and min_row["aqi"] <= 150:
        ventilation = (
            "Outdoor air stays elevated today. Keep windows mostly closed and ventilate "
            "briefly only if the hourly AQI drops below 100."
        )
    else:
        ventilation = (
            "Keep windows closed and rely on filtration until outdoor air improves. "
            "Avoid smoking, incense and candles indoors."
        )

    trend = "stable"
    if len(daily) >= 2 and daily[0].get("aqiAvg") and daily[1].get("aqiAvg"):
        delta = daily[1]["aqiAvg"] - daily[0]["aqiAvg"]
        if delta <= -15:
            trend = "improving"
        elif delta >= 15:
            trend = "worsening"

    if aqi is None:
        headline = "Live conditions unavailable"
    elif aqi <= 50:
        headline = "Clean air — a good day to be outside"
    elif aqi <= 100:
        headline = "Acceptable air — sensitive people should take note"
    elif aqi <= 150:
        headline = "Sensitive groups should reduce outdoor exposure"
    elif aqi <= 200:
        headline = "Unhealthy air — limit outdoor exposure"
    elif aqi <= 300:
        headline = "Very unhealthy air — stay indoors where possible"
    else:
        headline = "Hazardous air — avoid outdoor activity"

    return {
        "headline": headline,
        "categoryLabel": category["label"],
        "bestOutdoorWindow": best,
        "cleanestHour": (
            {
                "time": min_row["time"],
                "label": min_row["label"],
                "aqi": min_row["aqi"],
                "category": categorize_aqi(min_row["aqi"]),
            }
            if min_row
            else None
        ),
        "ventilationAdvice": ventilation,
        "trend": trend,
        "summary": category["advice"],
    }


def _rec(
    rec_id: str,
    title: str,
    description: str,
    category: str,
    impact: str,
    priority: str,
    icon: str,
) -> dict[str, Any]:
    return {
        "id": rec_id,
        "title": title,
        "description": description,
        "category": category,
        "impact": impact,
        "priority": priority,
        "icon": icon,
    }


def _build_recommendations(
    current: dict[str, Any],
    weather: dict[str, Any] | None,
    insights: dict[str, Any],
) -> list[dict[str, Any]]:
    aqi = current.get("aqi") or 0
    recs: list[dict[str, Any]] = []

    if aqi > 200:
        recs.append(
            _rec(
                "avoid-outdoor-exertion",
                "Keep outdoor exertion to a minimum",
                "At this AQI, strenuous activity outdoors can significantly increase the amount of pollution you inhale. Move workouts, playtime and errands indoors where possible.",
                "health",
                "Reducing outdoor exertion lowers your exposure to fine particles that can irritate the heart and lungs.",
                "high",
                "shield",
            )
        )
        recs.append(
            _rec(
                "seal-indoor-air",
                "Create a clean-air room",
                "Keep windows and doors closed during peak pollution and run a HEPA purifier in the room you use most. Avoid incense, candles, smoking and frying without extraction.",
                "indoor",
                "Filtering indoor air reduces exposure to PM2.5 that seeps in from outside and is generated by household burning.",
                "high",
                "home",
            )
        )
    elif aqi > 150:
        recs.append(
            _rec(
                "move-workout-indoors",
                "Move your workout indoors",
                "Choose indoor exercise or a shorter, gentler session. If you must be outside, keep it brief, avoid busy roads and consider a well-fitted N95/FFP2 mask.",
                "health",
                "Breathing polluted air during vigorous exercise increases both the dose and depth of particle exposure.",
                "high",
                "heart",
            )
        )
        recs.append(
            _rec(
                "protect-sensitive",
                "Check on sensitive family members",
                "Children, older adults and anyone with heart or lung conditions should stay in filtered indoor spaces. Shared advice applies to everyone; seek medical help if someone feels unwell.",
                "health",
                "Sensitive groups can experience effects at lower concentrations, so earlier precautions matter.",
                "high",
                "users",
            )
        )
    elif aqi > 100:
        recs.append(
            _rec(
                "sensitive-groups",
                "Sensitive groups should take it easier",
                "Children, older adults and people with heart or lung conditions should reduce long or intense outdoor activity. Everyone else can keep normal activity but watch for irritation.",
                "health",
                "Lowering prolonged outdoor exertion reduces the inhaled dose of fine particles.",
                "high",
                "users",
            )
        )
        recs.append(
            _rec(
                "commute-cleaner",
                "Choose the cleanest commute option",
                "Use public transport, carpool or a filtered cab rather than walking or cycling beside heavy traffic. Check the hourly forecast for the cleanest travel window.",
                "travel",
                "A shared bus trip produces far less CO₂e per passenger than a solo car trip and reduces traffic emissions.",
                "medium",
                "bus",
            )
        )
    elif aqi > 50:
        recs.append(
            _rec(
                "sensitive-watch",
                "Unusually sensitive people should watch for symptoms",
                "Most people can enjoy normal outdoor activity. If you are unusually sensitive to pollution, keep intense exercise shorter and avoid busy roads.",
                "health",
                "Awareness helps you adjust the length and intensity of exposure before symptoms start.",
                "medium",
                "heart",
            )
        )
        recs.append(
            _rec(
                "ventilate-clean-window",
                "Ventilate during the cleanest hour",
                insights.get("ventilationAdvice", "Air out your home when outdoor AQI is lowest."),
                "indoor",
                "Replacing stale indoor air with cleaner outdoor air can lower indoor CO₂ and pollutant build-up.",
                "medium",
                "wind",
            )
        )
    else:
        recs.append(
            _rec(
                "active-travel",
                "Take the low-emission route",
                "Air quality is good. Walk, cycle or use public transport for short trips instead of driving alone.",
                "travel",
                "Active travel has zero tailpipe emissions; a 5 km car trip avoided prevents roughly 1 kg of CO₂e.",
                "high",
                "bike",
            )
        )
        recs.append(
            _rec(
                "air-out-home",
                "Air out your home",
                insights.get("ventilationAdvice", "Open windows for 10–15 minutes."),
                "indoor",
                "Fresh air reduces indoor CO₂ and helps clear accumulated volatile organic compounds.",
                "medium",
                "wind",
            )
        )

    # Shared, always-useful recommendations.
    recs.append(
        _rec(
            "skip-burning",
            "Skip burning and unnecessary idling",
            "Avoid burning leaves, rubbish or wood, and switch off engines while waiting. These are direct sources of PM2.5 and black carbon.",
            "eco",
            "Avoiding one small waste fire prevents a concentrated burst of fine particles near homes, and less idling cuts both CO₂ and local exhaust.",
            "high" if aqi > 100 else "medium",
            "leaf",
        )
    )

    wind_speed = (weather or {}).get("windSpeed")
    if aqi > 100 and wind_speed is not None and wind_speed < 8:
        recs.append(
            _rec(
                "still-air",
                "Still air is trapping pollution",
                "Light winds mean pollutants are not dispersing quickly. Delay outdoor errands and avoid adding new emissions nearby until conditions improve.",
                "outdoor",
                "Low wind speeds allow pollutants to accumulate near the ground, raising local concentrations.",
                "medium",
                "wind",
            )
        )

    precip = (weather or {}).get("precipitation")
    if precip is not None and precip > 0:
        recs.append(
            _rec(
                "rain-washout",
                "Rain may briefly clean the air",
                "Rain can wash some particles out of the air, but traffic and indoor sources still matter. Keep monitoring the hourly forecast.",
                "outdoor",
                "Wet deposition can temporarily reduce airborne particles, though effects vary by rainfall intensity.",
                "low",
                "droplets",
            )
        )

    recs.append(
        _rec(
            "track-your-impact",
            "Turn one trip into measurable savings",
            "Log a walk, cycle or public-transport journey in My Impact to see estimated CO₂e avoided and build a weekly habit.",
            "eco",
            "Consistent low-emission choices reduce your carbon footprint. Local pollution reductions depend on many sources, so carbon savings are an estimate, not a measured AQI change.",
            "low",
            "activity",
        )
    )

    priority_rank = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda item: priority_rank.get(item["priority"], 3))
    return recs[:8]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _build_payload(
    air: dict[str, Any],
    weather: dict[str, Any] | None,
    name: str,
    *,
    warnings: list[str] | None = None,
    is_demo: bool = False,
    demo_notice: str | None = None,
) -> dict[str, Any]:
    current_raw = air.get("current") or {}
    aqi = _round(current_raw.get("us_aqi"))
    category = categorize_aqi(aqi)
    weather_current = _weather_current(weather)
    hourly = _merge_hourly(air, weather)
    daily = _build_daily(hourly, weather)

    current = {
        "time": current_raw.get("time"),
        "aqi": aqi,
        "europeanAqi": _round(current_raw.get("european_aqi")),
        "category": category,
        "pollutants": _pollutants(current_raw),
        "weather": weather_current,
    }
    insights = _build_insights(current, hourly, daily)
    recommendations = _build_recommendations(current, weather_current, insights)

    payload = {
        "location": {
            "name": name,
            "latitude": air.get("latitude"),
            "longitude": air.get("longitude"),
            "timezone": air.get("timezone", "UTC"),
            "elevation": air.get("elevation"),
        },
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "insights": insights,
        "recommendations": recommendations,
        "meta": {
            "isDemo": is_demo,
            "source": "BreatheWise demo dataset" if is_demo else "Open-Meteo Air Quality + Weather",
            "attribution": (
                "Demo values are illustrative and must not be treated as live measurements."
                if is_demo
                else "Air quality and weather data by Open-Meteo (CC BY 4.0)."
            ),
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "timezone": air.get("timezone", "UTC"),
            "warnings": warnings or [],
            "notice": demo_notice,
            "cacheTtlSeconds": int(current_app.config.get("AIR_CACHE_TTL_SECONDS", 600)),
        },
    }
    return payload


def _demo_payload(
    lat: float,
    lon: float,
    name: str,
    *,
    notice: str = "Demo mode: these are illustrative values, not live measurements.",
) -> dict[str, Any]:
    """Deterministic, clearly labelled demo dataset for offline demos."""
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    hours = [now + timedelta(hours=offset) for offset in range(0, 25)]

    hourly_rows: list[dict[str, Any]] = []
    for offset, moment in enumerate(hours):
        cycle = math.sin((moment.hour - 3) / 24 * 2 * math.pi)
        aqi = int(round(178 + 46 * cycle + (8 if offset in (5, 6) else 0)))
        pm25 = round(aqi * 0.36, 1)
        condition, icon = (("Fog", "fog") if 4 <= moment.hour <= 9 else ("Partly cloudy", "cloud-sun"))
        hourly_rows.append(
            {
                "time": moment.strftime("%Y-%m-%dT%H:%M"),
                "label": moment.strftime("%H:%M"),
                "aqi": aqi,
                "pm2_5": pm25,
                "pm10": round(pm25 * 1.55, 1),
                "temperature": round(22 + (2.5 * cycle), 1),
                "precipitationProbability": 0,
                "weatherCode": 45 if icon == "fog" else 2,
                "condition": condition,
                "icon": icon,
            }
        )

    daily: list[dict[str, Any]] = []
    for day_offset in range(7):
        day = (now + timedelta(days=day_offset)).date()
        day_rows = [
            row
            for row in hourly_rows
            if row["time"][:10] == day.isoformat()
        ]
        day_rows = day_rows or hourly_rows
        aqis = [row["aqi"] for row in day_rows]
        daily.append(
            {
                "date": day.isoformat(),
                "weekday": day.strftime("%a"),
                "aqiMax": max(aqis),
                "aqiAvg": round(sum(aqis) / len(aqis), 1),
                "pm2_5Max": max(row["pm2_5"] for row in day_rows),
                "tempMax": 27 + (day_offset % 2),
                "tempMin": 17 + (day_offset % 2),
                "precipitationProbability": 10,
                "weatherCode": 2,
                "condition": "Partly cloudy",
                "icon": "cloud-sun",
                "uvIndexMax": 5.0,
            }
        )

    current_raw = {
        "time": now.strftime("%Y-%m-%dT%H:%M"),
        "us_aqi": 202,
        "european_aqi": 67,
        "pm2_5": 63.3,
        "pm10": 78.7,
        "carbon_monoxide": 811,
        "nitrogen_dioxide": 8.5,
        "ozone": 117,
        "sulphur_dioxide": 6.8,
        "dust": 29,
    }
    category = categorize_aqi(202)
    current = {
        "time": current_raw["time"],
        "aqi": 202,
        "europeanAqi": 67,
        "category": category,
        "pollutants": _pollutants(current_raw),
        "weather": {
            "time": current_raw["time"],
            "temperature": 24.2,
            "apparentTemperature": 25.9,
            "humidity": 62,
            "windSpeed": 3.8,
            "windGust": 7.6,
            "windDirection": 11,
            "windDirectionLabel": "N",
            "condition": "Fog",
            "icon": "fog",
            "weatherCode": 45,
            "precipitation": 0,
            "cloudCover": 15,
            "pressure": 1001.5,
            "uvIndex": 0.7,
            "visibilityKm": 12.4,
            "isDay": True,
            "sunrise": f"{now.date().isoformat()}T05:57",
            "sunset": f"{now.date().isoformat()}T16:44",
        },
    }
    insights = _build_insights(current, hourly_rows, daily)
    recommendations = _build_recommendations(current, current["weather"], insights)

    return {
        "location": {
            "name": name,
            "latitude": lat,
            "longitude": lon,
            "timezone": "Asia/Kolkata",
            "elevation": 124,
        },
        "current": current,
        "hourly": hourly_rows,
        "daily": daily,
        "insights": insights,
        "recommendations": recommendations,
        "meta": {
            "isDemo": True,
            "source": "BreatheWise demo dataset",
            "attribution": "Demo values are illustrative and must not be treated as live measurements.",
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "timezone": "Asia/Kolkata",
            "warnings": [],
            "notice": notice,
            "cacheTtlSeconds": 0,
        },
    }


def get_air_quality(
    lat: float,
    lon: float,
    name: str | None = None,
    *,
    demo: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    """Return normalised live air quality, cached for a few minutes."""
    display_name = (name or "").strip() or f"{lat:.3f}, {lon:.3f}"
    want_demo = demo or bool(current_app.config.get("DEMO_MODE", False))
    cache_key = f"air:{lat:.3f}:{lon:.3f}:{display_name[:80]}:{int(want_demo)}"

    if not force:
        cached = air_cache.get(cache_key)
        if cached is not None:
            return cached

    if want_demo:
        payload = _demo_payload(lat, lon, display_name)
        air_cache.set(cache_key, payload, 60)
        return payload

    try:
        air, weather, warnings = _fetch_upstream(lat, lon)
    except ApiError:
        if current_app.config.get("DEMO_MODE", False):
            payload = _demo_payload(
                lat,
                lon,
                display_name,
                notice=(
                    "Live data is temporarily unavailable. Showing a clearly labelled demo "
                    "dataset so you can keep exploring the app."
                ),
            )
            return payload
        raise

    payload = _build_payload(air, weather, display_name, warnings=warnings)
    ttl = int(current_app.config.get("AIR_CACHE_TTL_SECONDS", 600))
    air_cache.set(cache_key, payload, ttl)
    return payload
