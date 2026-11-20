import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Database,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Notice from "../common/Notice";
import { useAir } from "../../context/AirContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { getApiErrorMessage } from "../../services/api";
import { searchLocations } from "../../services/geocodeService";
import type { GeocodeResult, LocationOption } from "../../types";
import { cn } from "../../lib/cn";

const QUICK_CITIES: LocationOption[] = [
  {
    name: "Siliguri",
    label: "Siliguri, West Bengal, India",
    latitude: 26.7271,
    longitude: 88.3953,
    country: "India",
    admin1: "West Bengal",
    timezone: "Asia/Kolkata",
  },
  {
    name: "New Delhi",
    label: "New Delhi, Delhi, India",
    latitude: 28.6139,
    longitude: 77.209,
    country: "India",
    admin1: "Delhi",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Mumbai",
    label: "Mumbai, Maharashtra, India",
    latitude: 19.076,
    longitude: 72.8777,
    country: "India",
    admin1: "Maharashtra",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Bengaluru",
    label: "Bengaluru, Karnataka, India",
    latitude: 12.9716,
    longitude: 77.5946,
    country: "India",
    admin1: "Karnataka",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Kolkata",
    label: "Kolkata, West Bengal, India",
    latitude: 22.5726,
    longitude: 88.3639,
    country: "India",
    admin1: "West Bengal",
    timezone: "Asia/Kolkata",
  },
];

export default function LocationPicker() {
  const {
    pickerOpen,
    closePicker,
    chooseLocation,
    location,
    locate,
    locating,
    locationError,
    demoMode,
    setDemoMode,
    clearLocationError,
  } = useAir();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 380);

  useEffect(() => {
    if (!pickerOpen) return;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setAttempted(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    searchLocations(debouncedQuery, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setResults(found);
        setAttempted(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSearchError(getApiErrorMessage(error));
        setResults([]);
        setAttempted(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, pickerOpen, searchNonce]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearchNonce((value) => value + 1);
  };

  const selectLocation = (place: LocationOption) => {
    chooseLocation(place);
    setQuery("");
    setResults([]);
    setAttempted(false);
  };

  return (
    <Modal
      open={pickerOpen}
      onClose={closePicker}
      title="Choose your location"
      description="Air quality, weather and every recommendation update for the place you select."
      footer={
        <div className="flex flex-col gap-2 text-[11px] leading-relaxed text-ink/45 sm:flex-row sm:items-center sm:justify-between">
          <span>Search by Open-Meteo Geocoding. Saved only in this browser.</span>
          <span className="inline-flex items-center gap-1.5">
            <Database size={12} aria-hidden="true" />
            Air quality by Open-Meteo
          </span>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="location-search" className="field-label">
            Search for a city
          </label>
          <form onSubmit={submitSearch} className="flex gap-2" role="search">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35"
                aria-hidden="true"
              />
              <input
                id="location-search"
                type="search"
                autoFocus
                autoComplete="off"
                className="field pl-10 pr-9"
                placeholder="e.g. Siliguri, Delhi, London"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-describedby="location-search-help"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setAttempted(false);
                  }}
                  aria-label="Clear location search"
                  className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink/35 hover:bg-forest-50 hover:text-ink"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <Button type="submit" variant="secondary" size="md" disabled={query.trim().length < 2}>
              Search
            </Button>
          </form>
          <p id="location-search-help" className="mt-1.5 text-xs text-ink/40">
            Type at least two characters. Results come from a live global place search.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void locate()}
          disabled={locating}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mint-200 bg-mint-50/70 px-4 py-3 text-left transition hover:border-mint-300 hover:bg-mint-50 disabled:cursor-wait disabled:opacity-70"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-forest-700 shadow-sm">
              {locating ? (
                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
              ) : (
                <Navigation size={17} aria-hidden="true" />
              )}
            </span>
            <span>
              <span className="block text-sm font-semibold text-forest-900">
                {locating ? "Finding your location…" : "Use my current location"}
              </span>
              <span className="block text-xs text-forest-700/60">
                Uses your browser's location permission. Coordinates are not stored on a server.
              </span>
            </span>
          </span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-forest-600 sm:inline">
            GPS
          </span>
        </button>

        {locationError ? (
          <Notice tone="warning" title="Location unavailable">
            {locationError}
          </Notice>
        ) : null}

        <div aria-live="polite" aria-atomic="true">
          {searching ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-forest-50/60 px-3.5 py-3 text-sm text-ink/55">
              <LoaderCircle size={15} className="animate-spin text-forest-500" aria-hidden="true" />
              Searching places…
            </div>
          ) : null}
          {searchError ? (
            <Notice tone="danger" title="Search failed">
              {searchError}
            </Notice>
          ) : null}
          {!searching && attempted && !searchError && results.length === 0 ? (
            <p className="rounded-xl bg-forest-50/60 px-3.5 py-3 text-sm text-ink/55">
              No places matched “{debouncedQuery}”. Try a nearby city or a different spelling.
            </p>
          ) : null}
        </div>

        {results.length > 0 ? (
          <ul className="space-y-1.5" aria-label="Search results">
            {results.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => selectLocation(place)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-forest-100 hover:bg-forest-50/60 focus-visible:border-mint-300"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-600 group-hover:bg-white">
                    <MapPin size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{place.name}</span>
                    <span className="block truncate text-xs text-ink/45">{place.label}</span>
                  </span>
                  <span className="text-[11px] font-medium text-ink/35">
                    {place.country ?? ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {query.trim().length < 2 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/40">
              Quick picks
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CITIES.map((city) => {
                const isActive =
                  Math.abs(city.latitude - location.latitude) < 0.02 &&
                  Math.abs(city.longitude - location.longitude) < 0.02;
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => selectLocation(city)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "border-mint-300 bg-mint-50 text-forest-800"
                        : "border-forest-100 bg-white text-ink/65 hover:border-mint-300 hover:text-forest-800",
                    )}
                    aria-pressed={isActive}
                  >
                    {isActive ? <Check size={12} aria-hidden="true" /> : <MapPin size={12} aria-hidden="true" />}
                    {city.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-forest-100 bg-forest-50/40 p-3.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => setDemoMode(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-forest-300 text-forest-700 accent-forest-700 focus:ring-mint-400"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">Load demo dataset</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink/50">
                Clearly labelled illustrative values for offline demos. Never presented as live data.
              </span>
            </span>
          </label>
          {demoMode ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
              <Database size={12} aria-hidden="true" />
              Demo mode is on. Untick to return to live Open-Meteo data.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-ink/40">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={12} aria-hidden="true" />
            {location.label}
          </span>
          {locationError ? (
            <button
              type="button"
              onClick={clearLocationError}
              className="font-semibold text-forest-700 hover:underline"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
