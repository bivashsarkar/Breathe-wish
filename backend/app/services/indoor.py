"""Indoor air protection guidance derived from live outdoor conditions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .air_quality import get_air_quality

DISCLAIMER = (
    "Indoor air guidance is general information, not a certification or medical advice. "
    "Product performance varies; follow the manufacturer's instructions and local safety guidance."
)

CHECKLIST = [
    {"id": "windows", "label": "Checked the hourly AQI before opening windows", "hint": "Ventilate when outdoor PM2.5 is lowest."},
    {"id": "purifier", "label": "Ran the purifier in the room we use most", "hint": "Close doors to create a cleaner room."},
    {"id": "cooking", "label": "Used extraction while cooking", "hint": "Frying and grilling generate fine particles."},
    {"id": "burning", "label": "Avoided candles, incense, coils and smoke", "hint": "These are direct indoor PM2.5 sources."},
    {"id": "dust", "label": "Damp-dusted surfaces and vacuumed with a HEPA filter", "hint": "Dry dusting just moves particles around."},
    {"id": "filter", "label": "Checked the purifier or HVAC filter", "hint": "Replace a clogged filter when airflow drops."},
]


def _window_label(time_str: str) -> str:
    try:
        return datetime.fromisoformat(time_str).strftime("%H:%M")
    except ValueError:
        return time_str[-5:]


def _ventilation_windows(hourly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = [
        row
        for row in hourly[:14]
        if row.get("aqi") is not None
        and row["aqi"] <= 100
        and (row.get("precipitationProbability") or 0) <= 70
    ]
    windows: list[dict[str, Any]] = []
    group: list[dict[str, Any]] = []

    def flush() -> None:
        if not group:
            return
        aqis = [item["aqi"] for item in group]
        windows.append(
            {
                "start": group[0]["time"],
                "end": group[-1]["time"],
                "startLabel": _window_label(group[0]["time"]),
                "endLabel": _window_label(group[-1]["time"]),
                "averageAqi": round(sum(aqis) / len(aqis)),
                "durationHours": len(group),
            }
        )
        group.clear()

    for row in hourly[:14]:
        if (
            row.get("aqi") is not None
            and row["aqi"] <= 100
            and (row.get("precipitationProbability") or 0) <= 70
        ):
            group.append(row)
        else:
            flush()
    flush()

    if not windows and candidates:
        low = min(candidates, key=lambda row: row["aqi"])
        windows.append(
            {
                "start": low["time"],
                "end": low["time"],
                "startLabel": _window_label(low["time"]),
                "endLabel": _window_label(low["time"]),
                "averageAqi": low["aqi"],
                "durationHours": 1,
            }
        )

    return windows[:3]


def _purifier_guidance(area_sqm: float, has_purifier: bool, outdoor_aqi: float | None) -> dict[str, Any]:
    room_height = 2.6
    volume = area_sqm * room_height
    # HEPA sizing rule of thumb: 3–5 air changes per hour.
    min_cadr = int(round(volume * 3 / 10) * 10)
    max_cadr = int(round(volume * 5 / 10) * 10)
    recommended = outdoor_aqi is not None and outdoor_aqi > 50

    notes = [
        f"For a {area_sqm:.0f} m² room (about {volume:.0f} m³), look for a HEPA purifier rated around "
        f"{min_cadr}–{max_cadr} m³/h CADR for 3–5 air changes per hour.",
        "Choose a true HEPA (H13/H14) filter. Activated carbon helps with smoke odour and some VOCs.",
        "Place the purifier centrally, away from walls and curtains, and keep doors closed for a cleaner room.",
        "Avoid ozone generators: they can irritate the lungs and are not a substitute for filtration.",
    ]
    if has_purifier:
        notes.insert(
            0,
            "Run it on high while outdoor PM2.5 is elevated, then reduce speed once the room is cleaner. "
            "Check the filter every few weeks and replace it when airflow drops or it looks grey.",
        )
    else:
        notes.insert(
            0,
            "A HEPA purifier is the most reliable way to lower indoor PM2.5 when outdoor air is poor. "
            "If budget is tight, a DIY box-fan filter can help as a temporary measure but must be built and used safely.",
        )

    return {
        "recommended": recommended,
        "cadrMin": min_cadr,
        "cadrMax": max_cadr,
        "hasPurifier": has_purifier,
        "notes": notes,
    }


def _tips(outdoor_aqi: float | None, weather: dict[str, Any] | None, area_sqm: float) -> list[dict[str, Any]]:
    tips = [
        {
            "id": "source-control",
            "category": "Source control",
            "title": "Deal with indoor sources first",
            "description": (
                "Cooking, candles, incense, mosquito coils, smoking and wood fires can raise indoor PM2.5 "
                "far above outdoor levels. Use an extractor fan, avoid burning, and do not smoke indoors."
            ),
            "cost": "free",
            "icon": "flame",
        },
        {
            "id": "dusting",
            "category": "Cleaning",
            "title": "Damp-dust instead of dry-dusting",
            "description": (
                "A damp cloth traps particles instead of lifting them back into the air. Use a vacuum with a "
                "HEPA filter, and wash bedding regularly."
            ),
            "cost": "free",
            "icon": "sparkles",
        },
        {
            "id": "filtration",
            "category": "Filtration",
            "title": "Size the purifier to the room",
            "description": (
                f"For a {area_sqm:.0f} m² room, aim for roughly 3–5 air changes per hour and keep the purifier "
                "running in the room you use most. Filters need replacing — a clogged filter cannot clean effectively."
            ),
            "cost": "medium",
            "icon": "wind",
        },
        {
            "id": "humidity",
            "category": "Moisture",
            "title": "Keep humidity in a comfortable range",
            "description": (
                "High humidity can encourage mould and dust mites; very dry air can irritate airways. "
                "Aim for roughly 30–50% relative humidity indoors and fix leaks promptly."
            ),
            "cost": "low",
            "icon": "droplets",
        },
        {
            "id": "entryway",
            "category": "Home habits",
            "title": "Stop particles at the door",
            "description": (
                "Remove shoes at the entrance, use a doormat and keep windows and doors closed on high-pollution days. "
                "Seal obvious gaps around doors and windows."
            ),
            "cost": "low",
            "icon": "home",
        },
        {
            "id": "testing",
            "category": "Monitoring",
            "title": "Use a low-cost particle monitor if possible",
            "description": (
                "A consumer PM2.5 monitor can show whether your clean-air room is actually cleaner. "
                "Treat readings as indicative and follow the manufacturer's calibration guidance."
            ),
            "cost": "medium",
            "icon": "activity",
        },
    ]
    if outdoor_aqi is not None and outdoor_aqi > 150:
        tips.insert(
            0,
            {
                "id": "keep-closed",
                "category": "Ventilation",
                "title": "Keep windows closed during the smog peak",
                "description": (
                    "Outdoor PM2.5 is high right now. Keep windows closed, use a HEPA purifier and avoid "
                    "activities that create indoor smoke. Ventilate only when the hourly forecast shows AQI under 100."
                ),
                "cost": "free",
                "icon": "shield",
            },
        )
    if weather and weather.get("windSpeed") is not None and weather["windSpeed"] < 8 and outdoor_aqi and outdoor_aqi > 100:
        tips.append(
            {
                "id": "still-air",
                "category": "Ventilation",
                "title": "Low wind means haze lingers",
                "description": (
                    "Still conditions trap pollution near the ground. Delay airing the home and rely on filtration "
                    "until wind or rain clears the air."
                ),
                "cost": "free",
                "icon": "cloud",
            }
        )
    return tips[:7]


def build_indoor_advice(
    air: dict[str, Any],
    *,
    area_sqm: float = 30,
    has_purifier: bool = False,
) -> dict[str, Any]:
    current = air.get("current") or {}
    weather = current.get("weather") or {}
    category = current.get("category") or {}
    aqi = current.get("aqi")
    hourly = air.get("hourly") or []
    windows = _ventilation_windows(hourly)
    best = (air.get("insights") or {}).get("bestOutdoorWindow")

    if aqi is not None and aqi <= 50:
        status = "open"
        headline = "Good time to air out your home"
        advice = (
            "Outdoor air is clean. Open windows for 10–15 minutes to reduce indoor CO₂ and freshen rooms, "
            "then close them if traffic or cooking smoke builds up."
        )
    elif windows and (aqi is None or aqi <= 100):
        status = "open"
        first = windows[0]
        headline = f"Ventilate around {first['startLabel']}–{first['endLabel']}"
        advice = (
            "Outdoor AQI is forecast to reach a cleaner level. Open windows briefly then, and "
            "keep filtration running in the main room."
        )
    elif windows and aqi is not None and aqi <= 150:
        status = "brief"
        first = windows[0]
        headline = f"Brief ventilation only around {first['startLabel']}"
        advice = (
            "Outdoor air is still moderately polluted. Keep windows mostly closed and ventilate for "
            "5–10 minutes only if indoor air feels stale, then run the purifier."
        )
    else:
        status = "closed"
        headline = "Keep windows closed and filter the air"
        advice = (
            "Outdoor pollution is elevated with no clean window forecast soon. Close windows, "
            "run a HEPA purifier in the room you use most and avoid indoor burning."
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
        "ventilation": {
            "status": status,
            "headline": headline,
            "advice": advice,
            "windows": windows,
            "bestOutdoorWindow": best,
        },
        "purifier": _purifier_guidance(float(area_sqm), bool(has_purifier), aqi),
        "tips": _tips(aqi, weather, float(area_sqm)),
        "checklist": CHECKLIST,
        "disclaimer": DISCLAIMER,
    }


def generate_indoor_advice(
    *,
    lat: float,
    lon: float,
    location_name: str | None,
    area_sqm: float = 30,
    has_purifier: bool = False,
    demo: bool = False,
) -> dict[str, Any]:
    air = get_air_quality(lat, lon, location_name, demo=demo)
    return build_indoor_advice(air, area_sqm=area_sqm, has_purifier=has_purifier)
