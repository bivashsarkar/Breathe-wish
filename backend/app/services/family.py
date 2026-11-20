"""Household protection guidance grounded in live air quality.

This module deliberately stays in public-health guidance territory: it never
diagnoses, never prescribes and always includes a clear disclaimer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .air_quality import get_air_quality

RELATION_LABELS = {
    "child": "Child",
    "adult": "Adult",
    "elderly": "Older adult",
}

DISCLAIMER = (
    "General guidance for planning daily activities, not medical advice or a diagnosis. "
    "Children, older adults and people with heart or lung conditions may be more sensitive "
    "to air pollution. If someone has chest pain, severe breathlessness, wheezing or other "
    "concerning symptoms, seek advice from a qualified health professional."
)


def _risk_for(relation: str, aqi: float | None) -> tuple[str, str]:
    if aqi is None:
        return "unknown", "Live AQI unavailable — re-check before outdoor plans."
    if relation in {"child", "elderly"}:
        if aqi > 200:
            return "very-high", "Very high sensitivity today"
        if aqi > 150:
            return "high", "High sensitivity today"
        if aqi > 100:
            return "moderate", "Take extra care today"
        return "low", "Comfortable conditions today"
    if aqi > 250:
        return "very-high", "Very high sensitivity today"
    if aqi > 180:
        return "high", "Take extra care today"
    if aqi > 120:
        return "moderate", "Reasonable with sensible precautions"
    return "low", "Comfortable conditions today"


def _actions_for(relation: str, aqi: float | None, weather: dict[str, Any] | None) -> tuple[list[str], list[str]]:
    actions: list[str] = []
    avoid: list[str] = []
    high = aqi is not None and aqi > 150
    moderate = aqi is not None and aqi > 100

    if relation == "child":
        actions.append(
            "Keep outdoor play short and away from busy roads; choose the cleanest daylight window."
            if moderate
            else "Outdoor play is fine for most children; keep younger children away from traffic-heavy streets."
        )
        actions.append(
            "Create a clean-air room with windows closed and a HEPA purifier for homework and naps."
            if high
            else "Keep bedrooms ventilated during the cleanest hour and free from dust and damp."
        )
        actions.append(
            "For school travel, prefer a filtered bus, carpool or a quieter walking route."
            if moderate
            else "Walking or cycling to school is a healthy, low-emission option today."
        )
        actions.append(
            "If a mask is needed, use a well-fitted, age-appropriate N95/FFP2 and supervise younger children. "
            "Masks are not suitable for children under two."
            if high
            else "Teach handwashing after outdoor play and keep indoor play areas dust-free."
        )
        avoid.extend(
            [
                "Do not let children play near idling vehicles or burning waste.",
                "Avoid indoor incense, candles and mosquito coils, which add fine particles.",
            ]
        )

    elif relation == "elderly":
        actions.append(
            "Plan errands for the cleanest hour and keep outdoor time brief."
            if moderate
            else "Normal outdoor activity is reasonable, but avoid the most polluted commute hours."
        )
        actions.append(
            "Keep regular medications and a phone within reach, and check in with a family member daily."
        )
        actions.append(
            "Use a HEPA purifier in the main living room and keep windows closed during peak pollution."
            if high
            else "Ventilate briefly during the cleanest hour to avoid stale indoor air."
        )
        actions.append(
            "Choose a filtered ride or public transport instead of a long walk beside traffic."
            if moderate
            else "A short walk in a park away from traffic is a good low-emission activity."
        )
        avoid.extend(
            [
                "Avoid strenuous outdoor activity and heavy housework during smog peaks.",
                "Do not rely on ozone generators or unverified 'air purifying' devices.",
            ]
        )

    else:
        actions.append(
            "Move vigorous exercise indoors while AQI is elevated, or keep it short and low-intensity."
            if moderate
            else "Outdoor exercise is reasonable today; prefer parks and side streets over main roads."
        )
        actions.append(
            "Use public transport, carpool or active travel to cut both exposure and emissions."
        )
        actions.append(
            "Work from a filtered room during the worst hours and ventilate when the hourly AQI drops."
        )
        actions.append(
            "Check on children and older relatives, and share the cleanest outdoor window with them."
        )
        avoid.extend(
            [
                "Avoid burning waste, leaves or wood, and avoid idling your vehicle.",
                "Do not smoke indoors or use incense as a room freshener.",
            ]
        )

    humidity = (weather or {}).get("humidity")
    temperature = (weather or {}).get("temperature")
    if humidity is not None and humidity > 80:
        actions.append("Damp, humid air can trap haze; keep indoor humidity comfortable and fix leaks promptly.")
    if temperature is not None and temperature > 35:
        actions.append("Heat increases strain on the heart; hydrate and rest in the coolest clean-air room.")
    if temperature is not None and temperature < 8:
        actions.append("Cold air can irritate airways; warm up indoors and cover your nose and mouth outdoors if needed.")
    if (weather or {}).get("precipitation") and (weather or {}).get("precipitation", 0) > 0:
        actions.append("After rain, brief ventilation may help, but keep monitoring the hourly AQI.")

    return actions[:5], avoid


def build_family_advice(
    members: list[dict[str, Any]],
    air: dict[str, Any],
) -> dict[str, Any]:
    current = air.get("current") or {}
    aqi = current.get("aqi")
    category = current.get("category") or {}
    weather = current.get("weather")
    insights = air.get("insights") or {}

    member_advice: list[dict[str, Any]] = []
    for index, member in enumerate(members):
        relation = member.get("relation", "adult")
        risk_level, headline = _risk_for(relation, aqi)
        actions, avoid = _actions_for(relation, aqi, weather)
        member_advice.append(
            {
                "id": member.get("id") or f"member-{index}",
                "name": member.get("name"),
                "relation": relation,
                "relationLabel": RELATION_LABELS.get(relation, "Adult"),
                "age": member.get("age"),
                "activity": member.get("activity"),
                "riskLevel": risk_level,
                "headline": headline,
                "actions": actions,
                "avoid": avoid,
            }
        )

    high_count = sum(
        1 for item in member_advice if item["riskLevel"] in {"high", "very-high"}
    )
    household: list[str] = [
        (
            f"Current AQI is {aqi} ({category.get('label')}). "
            "Re-check it before outdoor plans, especially if conditions are changing quickly."
        ),
        insights.get(
            "ventilationAdvice",
            "Keep windows closed during peak pollution and ventilate when outdoor air is cleaner.",
        ),
        "Designate one clean-air room: windows closed, door shut and a HEPA purifier sized for the space.",
        "Avoid indoor burning — incense, candles, mosquito coils, wood fires and smoking all add PM2.5.",
        "Agree on a check-in routine so older relatives and children are not caught outdoors during a smog peak.",
    ]
    if high_count:
        household.append(
            f"{high_count} household member{'s' if high_count > 1 else ''} may be more sensitive today. "
            "Keep outdoor time short and shared activities indoors."
        )
    if (air.get("meta") or {}).get("isDemo"):
        household.append(
            "Note: environmental values are from the labelled demo dataset, not live measurements."
        )

    summary = (
        f"Air quality is {category.get('label', 'unavailable').lower()} in "
        f"{air.get('location', {}).get('name', 'your area')}. "
        + (
            "Keep vulnerable household members in filtered indoor air where possible."
            if aqi is not None and aqi > 100
            else "Conditions are generally comfortable for most household activities."
        )
    )

    return {
        "location": air.get("location"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "current": {
            "aqi": aqi,
            "category": category,
            "weather": weather,
            "isDemo": bool((air.get("meta") or {}).get("isDemo")),
            "source": (air.get("meta") or {}).get("source"),
        },
        "summary": summary,
        "household": household,
        "members": member_advice,
        "disclaimer": DISCLAIMER,
    }


def generate_family_advice(
    members: list[dict[str, Any]],
    *,
    lat: float,
    lon: float,
    location_name: str | None,
    demo: bool = False,
) -> dict[str, Any]:
    air = get_air_quality(lat, lon, location_name, demo=demo)
    return build_family_advice(members, air)
