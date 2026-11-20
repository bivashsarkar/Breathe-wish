"""Personalised, rule-based daily planning.

The planner is deterministic on purpose: plans are testable, explainable and
do not require a Gemini key. Every recommendation is derived from the live AQI
forecast and the user's stated lifestyle.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .air_quality import categorize_aqi, find_best_window, get_air_quality

TRANSPORT_MODES = {
    "walk": {"label": "Walking", "factor": 0.0},
    "cycle": {"label": "Cycling", "factor": 0.0},
    "bus": {"label": "Bus", "factor": 0.082},
    "metro": {"label": "Metro / train", "factor": 0.041},
    "two-wheeler": {"label": "Two-wheeler", "factor": 0.103},
    "car": {"label": "Private car", "factor": 0.192},
    "mixed": {"label": "Mixed transport", "factor": 0.15},
}

CARPOOL_FACTOR = 0.096
EMISSION_NOTE = (
    "CO₂e estimates use standard per-passenger-km emission factors and assume a "
    "5-day commute week. They are estimates of avoided carbon, not measured changes in local AQI."
)


def _estimate_savings(mode: str, distance_km: float) -> dict[str, Any]:
    current = TRANSPORT_MODES.get(mode, TRANSPORT_MODES["mixed"])
    options: list[dict[str, Any]] = []

    candidates = [
        ("metro", "metro", 0.85, "Switch to metro or train where available"),
        ("bus", "bus", 0.75, "Take the bus for this commute"),
        ("cycle", "cycle", 0.95, "Cycle for shorter, safer trips"),
        ("walk", "walk", 0.9, "Walk when the trip is short"),
        ("carpool", "carpool", 0.7, "Share a car with a colleague"),
        ("wfh", "remote", 0.6, "Work from home two days a week"),
    ]

    for alt_id, kind, factor_multiplier, title in candidates:
        if kind == "remote":
            saved_per_day = current["factor"] * distance_km * 2
            weekly = saved_per_day * 2
            if mode == "walk" or mode == "cycle":
                continue
            options.append(
                {
                    "id": alt_id,
                    "title": title,
                    "description": (
                        "Replace two car commute days with remote work. It removes the trip entirely "
                        "and reduces exposure during peak traffic."
                    ),
                    "dailyCo2SavedKg": round(saved_per_day, 2),
                    "estimatedCo2SavedKgPerWeek": round(weekly, 2),
                    "assumptions": f"Distance {distance_km:.0f} km each way, two days per week.",
                }
            )
            continue

        if kind == "carpool":
            alt_factor = CARPOOL_FACTOR
            alt_label = "carpooling"
        else:
            alt_factor = TRANSPORT_MODES[kind]["factor"]
            alt_label = TRANSPORT_MODES[kind]["label"].lower()

        saved_per_trip = (current["factor"] - alt_factor) * distance_km
        if saved_per_trip <= 0.02:
            continue
        weekly = saved_per_trip * 2 * 5
        if kind in {"walk", "cycle"} and distance_km > 8:
            continue
        options.append(
            {
                "id": alt_id,
                "title": title,
                "description": (
                    f"Replacing your {current['label'].lower()} commute with "
                    f"{alt_label} saves an estimated "
                    f"{weekly:.1f} kg CO₂e per week."
                ),
                "dailyCo2SavedKg": round(saved_per_trip * 2, 2),
                "estimatedCo2SavedKgPerWeek": round(weekly, 2),
                "assumptions": (
                    f"{distance_km:.0f} km each way, 5 days per week, "
                    f"{current['label'].lower()} emits about {current['factor']:.3f} kg CO₂e/km."
                ),
                "logActivityType": kind if kind in {"walk", "cycle", "bus", "metro"} else "avoided-car",
            }
        )

    # Walking and cycling already have no tailpipe emissions.
    if mode in {"walk", "cycle"}:
        options.insert(
            0,
            {
                "id": "keep-active",
                "title": "Keep up the zero-tailpipe commute",
                "description": (
                    "You already avoid a tailpipe trip. On high-pollution days, consider a mask "
                    "and a quieter route away from traffic."
                ),
                "dailyCo2SavedKg": round(0.192 * distance_km * 2, 2),
                "estimatedCo2SavedKgPerWeek": round(0.192 * distance_km * 2 * 5, 2),
                "assumptions": "Compared with driving the same round trip in a petrol car.",
            },
        )

    return {
        "currentMode": mode,
        "currentLabel": current["label"],
        "options": options[:3],
        "note": EMISSION_NOTE,
    }


def _safety_label(aqi: float | None) -> str:
    if aqi is None:
        return "unknown"
    if aqi <= 50:
        return "good"
    if aqi <= 100:
        return "acceptable"
    if aqi <= 150:
        return "caution"
    return "avoid"


def _transport_advice(mode: str, aqi: float | None) -> tuple[str, str, str]:
    """Return (status, title, description)."""
    if aqi is None:
        return (
            "caution",
            "Check live data before leaving",
            "Air quality is unavailable right now. Use your usual route and re-check before outdoor travel.",
        )
    if aqi > 150:
        if mode in {"walk", "cycle"}:
            return (
                "avoid",
                "Switch to public transport or a shared ride",
                "At this AQI, breathing heavily beside traffic adds a significant pollution dose. "
                "If you must walk or cycle, use a quieter route and a well-fitted N95/FFP2 mask.",
            )
        return (
            "caution",
            "Take the cleanest route",
            "Keep windows closed in the car, use recirculation and avoid idling. Public transport or "
            "carpooling cuts both exposure and emissions.",
        )
    if aqi > 100:
        return (
            "caution",
            "Sensitive groups should adjust the commute",
            "Most people can travel normally. Children, older adults and anyone with heart or lung "
            "conditions should use public transport or a filtered ride rather than a long walk beside traffic.",
        )
    return (
        "good",
        "A good day for low-emission travel",
        "Walk, cycle or take public transport where practical. This cuts CO₂e and avoids adding "
        "another car to the traffic queue.",
    )


def build_plan(
    profile: dict[str, Any],
    air: dict[str, Any],
) -> dict[str, Any]:
    current = air.get("current") or {}
    category = current.get("category") or {}
    weather = current.get("weather") or {}
    hourly = air.get("hourly") or []
    aqi = current.get("aqi")
    goals = profile.get("outdoorActivity", "walking")
    activity_time = profile.get("activityTime", "morning")
    transport = profile.get("transport", "mixed")
    occupation = profile.get("occupation", "office")
    distance = float(profile.get("commuteDistanceKm") or 10)
    children = bool(profile.get("hasChildren"))
    elderly = bool(profile.get("hasElderly"))

    best = find_best_window(hourly) or (air.get("insights") or {}).get("bestOutdoorWindow")
    best_label = (
        f"{best['startLabel']}–{best['endLabel']}" if best and best.get("startLabel") else "the cleanest hour"
    )
    best_aqi = best.get("averageAqi") if best else aqi
    best_category = categorize_aqi(best_aqi) if best_aqi is not None else category

    commute_status, commute_title, commute_description = _transport_advice(transport, aqi)
    on_feet = transport in {"walk", "cycle"}
    outdoor_unsafe = aqi is not None and aqi > 150
    outdoor_caution = aqi is not None and aqi > 100

    if occupation == "outdoor-worker":
        work_text = (
            "Take scheduled breaks in a filtered indoor space. Rotate strenuous tasks to the "
            "cleanest hours and keep a well-fitted mask for unavoidable exposure."
        )
    elif occupation == "student":
        work_text = (
            "Keep study sessions indoors with windows closed during peak smog. Use the cleanest "
            "window for travel between classes."
        )
    elif occupation == "remote":
        work_text = (
            "Use today's avoided commute to bank a lower-emission day. Air the room only during "
            "the cleanest hour and run a purifier if PM2.5 is elevated."
        )
    elif occupation == "homemaker":
        work_text = (
            "Use an extractor fan or a briefly opened kitchen window while cooking. Avoid frying at "
            "very high heat and never burn incense or coils indoors on a smoggy day."
        )
    else:
        work_text = (
            "Keep the workspace ventilated during the cleanest hour. Avoid printing in enclosed "
            "rooms and take screen breaks away from traffic-facing windows."
        )

    if goals == "running" or goals == "sports":
        activity_text = (
            "Move the session indoors today (gym, stairs, yoga) to avoid a high breathing rate in polluted air."
            if outdoor_unsafe
            else (
                f"Keep the session lighter and use {best_label}, when AQI is forecast around {int(best_aqi or 0)}."
                if outdoor_caution
                else f"Outdoor {goals} is reasonable. {best_label[0].upper() + best_label[1:]} is forecast to be cleanest."
            )
        )
    elif goals == "cycling":
        activity_text = (
            "Swap the road ride for an indoor trainer or a short, quiet-route ride with a mask."
            if outdoor_unsafe
            else f"Cycle on quieter streets away from traffic, ideally around {best_label}."
        )
    else:
        activity_text = (
            "Keep walks short and away from busy roads, or walk indoors instead."
            if outdoor_unsafe
            else f"A {goals} session around {best_label} should be the cleanest option today."
        )

    alerts: list[dict[str, str]] = []
    if aqi is not None and aqi > 150:
        alerts.append(
            {
                "level": "high",
                "message": "Air quality is unhealthy today. Prioritise indoor activity and filtered air.",
            }
        )
    if aqi is not None and aqi > 100 and on_feet:
        alerts.append(
            {
                "level": "medium",
                "message": "Your usual walking/cycling commute overlaps elevated pollution. Consider public transport.",
            }
        )
    if children or elderly:
        alerts.append(
            {
                "level": "medium" if aqi is None or aqi <= 150 else "high",
                "message": "Sensitive household members should use the cleanest travel window and avoid outdoor play during peak hours.",
            }
        )
    if weather.get("visibilityKm") is not None and weather["visibilityKm"] < 3:
        alerts.append(
            {
                "level": "medium",
                "message": "Low visibility suggests heavy haze. Allow extra travel time and avoid unnecessary trips.",
            }
        )
    if not hourly:
        alerts.append(
            {
                "level": "low",
                "message": "Hourly forecast is unavailable; timing advice is based on current conditions only.",
            }
        )

    if occupation == "remote":
        climate_action = (
            "Working remotely today avoids an estimated "
            f"{0.192 * distance * 2:.1f} kg CO₂e compared with a solo car commute."
        )
    elif on_feet:
        climate_action = (
            "Your active commute produces no tailpipe emissions. That is better for local air and your health "
            "when pollution levels are low."
        )
    else:
        climate_action = (
            "Choosing public transport or carpooling once can avoid roughly "
            f"{(TRANSPORT_MODES.get(transport, TRANSPORT_MODES['mixed'])['factor'] - 0.082) * distance * 2:.1f} kg CO₂e "
            "on a round trip compared with driving alone."
        )

    plan = [
        {
            "id": "morning-check",
            "time": "07:00",
            "title": "Check the air before you plan the day",
            "description": (
                f"Current AQI is {aqi} ({category.get('label')}). Open BreatheWise once more before "
                "leaving to catch any rapid change in the hourly forecast."
            ),
            "category": "health",
            "status": "good" if (aqi or 0) <= 100 else "caution",
        },
        {
            "id": "commute",
            "time": "08:30",
            "title": commute_title,
            "description": commute_description,
            "category": "transport",
            "status": commute_status,
        },
        {
            "id": "focus-block",
            "time": "10:00",
            "title": "Protect your indoor work block",
            "description": work_text
            + (f" {weather.get('condition')} outside, {weather.get('temperature')}°C." if weather else ""),
            "category": "indoor",
            "status": "good" if (aqi or 0) <= 100 else "caution",
        },
        {
            "id": "outdoor-window",
            "time": best.get("startLabel", "14:00") if best else "14:00",
            "title": f"Best outdoor window: {best_label}",
            "description": (
                f"Forecast average AQI {best_aqi} ({best_category.get('label')}). {activity_text}"
                if best_aqi is not None
                else activity_text
            ),
            "category": "outdoor" if not outdoor_unsafe else "indoor",
            "status": _safety_label(best_aqi),
        },
        {
            "id": "evening",
            "time": "18:30",
            "title": "Evening protection routine",
            "description": (
                "Shut windows before the evening inversion traps pollution near the ground. "
                "Run the purifier in the main living room and wipe down surfaces near open windows."
                if (aqi or 0) > 100
                else "Air out the kitchen after dinner and take a short low-traffic walk if you still have daylight."
            ),
            "category": "indoor",
            "status": "caution" if (aqi or 0) > 150 else "good",
        },
        {
            "id": "climate-action",
            "time": "20:00",
            "title": "One lower-emission choice today",
            "description": climate_action,
            "category": "eco",
            "status": "good",
        },
    ]

    summary = (
        f"Air quality in {air.get('location', {}).get('name', 'your area')} is "
        f"{category.get('label', 'unavailable').lower()} today (AQI {aqi}). "
        + (
            f"Your cleanest outdoor window is {best_label}; keep the rest of the day indoor-focused. "
            if aqi is not None and aqi > 150
            else f"The cleanest outdoor window is {best_label}. "
        )
        + "Transport and indoor ventilation are the two levers that matter most today."
    )

    return {
        "location": air.get("location"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "alerts": alerts,
        "bestWindow": best,
        "plan": plan,
        "alternatives": _estimate_savings(transport, distance),
        "dataSnapshot": {
            "aqi": aqi,
            "category": category.get("label"),
            "pm2_5": (current.get("pollutants") or {}).get("pm2_5", {}).get("displayValue"),
            "weather": weather or None,
            "isDemo": bool((air.get("meta") or {}).get("isDemo")),
            "source": (air.get("meta") or {}).get("source"),
        },
        "disclaimer": (
            "BreatheWise plans use general public-health guidance and are not medical advice. "
            + EMISSION_NOTE
        ),
    }


def generate_plan(
    profile: dict[str, Any],
    *,
    lat: float,
    lon: float,
    location_name: str | None,
    demo: bool = False,
) -> dict[str, Any]:
    air = get_air_quality(lat, lon, location_name, demo=demo)
    return build_plan(profile, air)
