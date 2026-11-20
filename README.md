# BreatheWise — AI-Powered Air Pollution Assistant

BreatheWise turns live air-quality data into decisions a household can actually use: whether it is safe to go outside, when to exercise, how to protect children and older adults, when to ventilate, and how to lower your own pollution footprint.

Built for **PromptWars** with a React + TypeScript frontend and a Flask API that grounds every answer in live Open-Meteo data. The Gemini API key never leaves the server.

> **Honest-data promise:** every value is either live Open-Meteo data or an explicitly labelled demo dataset. The app never presents made-up numbers as live measurements.

---

## Highlights

| Area | What it does |
| --- | --- |
| **Live dashboard** | US AQI, six pollutants, weather, 25-hour hourly forecast, 7-day outlook, WHO guideline comparisons, cleanest outdoor window and actionable recommendations. |
| **AI assistant** | Chat grounded in current AQI, pollutant, weather and forecast data. Uses Gemini when a key is configured; otherwise a transparent rule engine with a visible mode badge. |
| **Daily planner** | Personal routine (occupation, commute, outdoor activity) combined with the hourly forecast to produce a timed plan, alerts, best outdoor window and lower-emission commute swaps. |
| **Family protection** | Household profiles for children, adults and older adults with age-aware precautions, risk levels and “avoid today” guidance. |
| **Indoor protection** | Ventilation timing, purifier CADR sizing for your room, source-control tips and a daily checklist that resets automatically. |
| **Impact tracker** | Logs low-carbon choices in `localStorage`, estimates avoided CO₂e, shows a seven-day chart and streak — clearly separated from local AQI claims. |
| **Location** | Global city search, quick picks and browser geolocation with reverse geocoding. The last choice is remembered locally. |
| **Quality bar** | Loading skeletons, empty/error states, retry actions, keyboard-friendly controls, skip link, reduced-motion support and no dead buttons. |

---

## Architecture

```
BreatheWise/
├── backend/                 Flask REST API (Python 3.11+)
│   ├── app/
│   │   ├── __init__.py      App factory, CORS, rate limits, security headers
│   │   ├── routes/          health, air, geocode, assistant, planner, family, indoor
│   │   ├── services/        Open-Meteo, Gemini, planner/family/indoor engines
│   │   └── utils/           TTL cache, validation, errors
│   ├── tests/               24 pytest tests (no network required)
│   ├── config.py
│   ├── run.py
│   └── requirements.txt
└── frontend/                React 19 + Vite + TypeScript + Tailwind v4
    ├── src/
    │   ├── pages/           Dashboard, Assistant, Planner, Family, Indoor, Impact, NotFound
    │   ├── components/      Layout, dashboard and shared UI
    │   ├── context/         AirProvider — one shared live-data fetch
    │   ├── services/        Typed API clients
    │   ├── lib/             AQI styles, formatting, impact maths, safe storage
    │   └── types/           Shared API interfaces
    └── vite.config.ts
```

**Stack:** React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router 7, Lucide, Recharts, Framer Motion, Vitest · Flask 3, Requests, python-dotenv · Gemini REST API · Open-Meteo Air Quality, Weather and Geocoding APIs.

---

## Quick start

Prerequisites: **Python 3.11+** and **Node.js 20.19+ or 22.12+** (Vite 8 requirement).

### 1. Backend

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

Copy-Item .env.example .env
# Optional: edit .env and add GEMINI_API_KEY=...
python run.py
```

The API starts at **http://127.0.0.1:5000**. Check it:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

### 2. Frontend

Open a second terminal:

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\frontend"
npm install

Copy-Item .env.example .env.local
npm run dev
```

Open **http://localhost:5173**.

Both servers must run at the same time. If you change the backend port, update `VITE_API_URL` in `frontend/.env.local`.

### Production build

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\frontend"
npm run build
npm run preview      # http://localhost:4173
```

`http://localhost:4173` is already included in the backend CORS defaults.

---

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `FLASK_ENV` | `development` | Flask environment label. |
| `FLASK_DEBUG` | `0` | Set `1` to enable the Flask debugger locally only. |
| `SECRET_KEY` | dev-only value | Replace before deploying. |
| `CORS_ORIGINS` | localhost ports 5173/4173 | Comma-separated allowed frontend origins. |
| `GEMINI_API_KEY` | empty | Enables Gemini answers. Empty = labelled demo/rule-engine mode. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name. |
| `DEMO_MODE` | `0` | `1` forces the labelled demo dataset. Live data is always preferred when `0`. |
| `HTTP_TIMEOUT_SECONDS` | `12` | Open-Meteo request timeout. |
| `AIR_CACHE_TTL_SECONDS` | `600` | Air-quality cache TTL. |
| `GEO_CACHE_TTL_SECONDS` | `86400` | Geocoding cache TTL. |
| `RATE_LIMIT_PER_MINUTE` | `90` | Global per-IP API limit. |
| `ASSISTANT_RATE_LIMIT_PER_MINUTE` | `15` | Assistant limit per IP. |
| `GENERATION_RATE_LIMIT_PER_MINUTE` | `30` | Planner limit per IP. |
| `PORT` / `HOST` | `5000` / `127.0.0.1` | Development server binding. |

### Frontend (`frontend/.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://127.0.0.1:5000/api` | Base URL of the Flask API. |

> Only `VITE_*` values are exposed to the browser. Gemini credentials belong **only** in `backend/.env`.

---

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service status and whether Gemini is configured. |
| `GET` | `/api/air?latitude=&longitude=&name=&demo=&refresh=` | Current AQI, pollutants, weather, hourly/daily forecasts, insights and recommendations. |
| `GET` | `/api/geocode?q=` | Forward location search (Open-Meteo Geocoding). |
| `GET` | `/api/geocode/reverse?latitude=&longitude=` | Reverse geocoding for browser GPS. |
| `POST` | `/api/assistant` | Grounded chat. Body: `message`, `history`, `latitude`, `longitude`, `locationName`, `demo`. |
| `POST` | `/api/planner` | Daily plan. Body: `profile`, coordinates, `locationName`, `demo`. |
| `POST` | `/api/family/advice` | Household advice. Body: `members[]`, coordinates, `locationName`, `demo`. |
| `GET` | `/api/indoor?latitude=&longitude=&name=&areaSqm=&hasPurifier=&demo=` | Ventilation windows, CADR sizing, tips and checklist. |

Errors use a consistent shape:

```json
{ "error": { "code": "invalid_field", "message": "Human-readable explanation." } }
```

Inputs are validated (coordinate ranges, text lengths, allowed enum values, 64 KB body limit). Responses include `X-Request-ID`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Cache-Control: no-store`.

---

## How the data works

- **Air quality and weather:** [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), no API key needed. Requests are made in parallel and cached in memory for 10 minutes.
- **AQI:** the US AQI value returned by Open-Meteo is the headline index. Categories follow US EPA breakpoints.
- **Pollutant guidelines:** comparisons use WHO 2021 24-hour guideline values (PM2.5 15 µg/m³, PM10 45, NO₂ 25, O₃ 100, SO₂ 40, CO 4 mg/m³). “% of guideline” is shown so a value below the AQI alert threshold is not mistaken for “clean”.
- **Cleanest window:** the backend scans the next daylight hours for the lowest sustained AQI and returns a concrete start/end window.
- **Demo data:** only used when the user turns it on or `DEMO_MODE=1`; the API marks it `isDemo: true` and every screen shows a demo badge/notice. If upstream fails with `DEMO_MODE=0`, the API returns an error instead of silently inventing numbers.

### AI modes

| Mode | When | Behaviour |
| --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` set and the request succeeds | Gemini receives a strictly grounded prompt built from the latest live data. |
| `demo` | No API key | A deterministic rule engine answers from the same live data. Labelled “Demo guidance · rule engine”. |
| `fallback` | Gemini configured but the call fails | Same rule engine, labelled as an offline fallback. |

Every assistant reply carries its mode, the AQI/location it was grounded on, and a medical disclaimer.

---

## Testing

### Backend — 24 tests

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\backend"
python -m pip install -r requirements-dev.txt
python -m pytest
```

The tests monkeypatch upstream services, so they need no network access. They cover AQI categorisation, best-window selection, CO₂ maths, validation, rate limiting and every API route.

### Frontend — 10 tests

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\frontend"
npm test
```

Covers CO₂e factors, entry creation/clamping, seven-day aggregation and streak/goal summaries.

### Type-check and build

```powershell
cd "C:\vs code all project\breathew ise\BreatheWise\frontend"
npm run build
```

---

## Manual smoke test

1. Dashboard loads live AQI for Siliguri (the default) with a “Live · Open-Meteo” label.
2. Change location → search a city or pick a quick city → data refreshes.
3. Ask the assistant “Is it safe to go outside today?” → a labelled reply using today's AQI.
4. Daily planner → **Generate my daily plan** → timeline, best window and commute swaps appear.
5. Planner → **Log this swap** → “Saved to My Impact” → My Impact shows the entry and updated chart.
6. Family → **Load sample family** → risk cards for child, adult and older adult.
7. Indoor → toggle a checklist item, change room area, **Update guidance** → CADR range updates.
8. Turn on demo mode in the location picker → every screen shows a demo warning; turn it off to return to live data.
9. Visit an unknown URL → branded 404 page.

---

## Privacy and security

- The Gemini key and all server configuration stay in `backend/.env`; the browser only receives the resulting text.
- No accounts, analytics or tracking. Location, household profiles, planner preferences and impact entries live in `localStorage` on the device.
- Geocoding coordinates go only to the configured backend and upstream geocoding API; they are not persisted server-side beyond an in-memory cache.
- CORS is restricted to configured origins; per-IP sliding-window rate limits protect expensive endpoints.
- The assistant renders Markdown through a safe, custom React renderer — no `dangerouslySetInnerHTML`, so model output cannot inject HTML.
- `.env` files are git-ignored; `.env.example` contains placeholders only.

---

## Known limitations

- **Model-based data, not a local monitor.** Open-Meteo values are interpolated/model-derived and may differ from a nearby CPCB or reference monitor. The UI labels the source on every screen.
- **Planner, family and indoor logic are deterministic heuristics** based on public-health guidance. They are not medical advice or personalised diagnosis.
- **Gemini is optional.** Without a key, the assistant is useful but rule-based; with a free-tier key, quota and latency apply.
- **CO₂e savings are estimates** from average per-passenger-km factors. They are never presented as a measured reduction in local AQI or PM2.5.
- **Persistence is browser-local.** Clearing site data removes family profiles, checklist state and impact history. There is no sync between devices.
- **Single-process infrastructure.** The TTL cache and rate limiter are in memory, so they reset on restart and are not shared across multiple workers. A production deployment should use Redis and a WSGI server.
- **No authentication.** The app is designed as a public, read-only guidance tool with no user accounts.
- **Upstream availability.** If Open-Meteo is unreachable and demo mode is off, the API returns a clear error rather than fabricating data.

---

## Attribution

Air quality, weather and geocoding data by [Open-Meteo](https://open-meteo.com/) under CC BY 4.0. Reverse geocoding by BigDataCloud. AI answers by Google Gemini when configured.

BreatheWise is general environmental guidance, **not medical advice**. Anyone experiencing symptoms should consult a qualified health professional.
