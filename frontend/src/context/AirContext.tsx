import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getAirQuality } from "../services/aqiService";
import { getApiErrorMessage } from "../services/api";
import { reverseGeocode } from "../services/geocodeService";
import { readStored, writeStored } from "../lib/storage";
import type { AirQualityData, LocationOption } from "../types";

const LOCATION_STORAGE_KEY = "breathew.location.v1";
const DEMO_STORAGE_KEY = "breathew.demo-mode.v1";

export const DEFAULT_LOCATION: LocationOption = {
  name: "Siliguri",
  label: "Siliguri, West Bengal, India",
  latitude: 26.7271,
  longitude: 88.3953,
  country: "India",
  admin1: "West Bengal",
  timezone: "Asia/Kolkata",
};

function isStoredLocation(value: unknown): value is LocationOption {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocationOption>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.latitude === "number" &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === "number" &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
}

interface AirContextValue {
  location: LocationOption;
  chooseLocation: (location: LocationOption) => void;
  air: AirQualityData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  locating: boolean;
  locationError: string | null;
  clearLocationError: () => void;
  locate: () => Promise<void>;
}

const AirContext = createContext<AirContextValue | null>(null);

export function AirProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationOption>(() => {
    const stored = readStored<unknown>(LOCATION_STORAGE_KEY, null);
    return isStoredLocation(stored) ? stored : DEFAULT_LOCATION;
  });
  const [demoMode, setDemoModeState] = useState<boolean>(() =>
    readStored<boolean>(DEMO_STORAGE_KEY, false),
  );
  const [air, setAir] = useState<AirQualityData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFetching(true);
      setError(null);
      try {
        const data = await getAirQuality(
          {
            latitude: location.latitude,
            longitude: location.longitude,
            name: location.label || location.name,
            demo: demoMode,
            refresh: force,
          },
          controller.signal,
        );
        if (requestRef.current !== requestId) return;
        setAir(data);
        setLastUpdated(data.meta.fetchedAt || new Date().toISOString());
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(getApiErrorMessage(err));
      } finally {
        if (requestRef.current === requestId) setFetching(false);
      }
    },
    [demoMode, location.latitude, location.longitude, location.label],
  );

  // Reset stale data when the user changes place or mode, then load.
  useEffect(() => {
    setAir(null);
    setError(null);
    void load(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const chooseLocation = useCallback((next: LocationOption) => {
    const sanitized: LocationOption = {
      ...next,
      name: next.name.trim() || "Selected place",
      label: (next.label || next.name).trim(),
      latitude: Number(next.latitude),
      longitude: Number(next.longitude),
    };
    setLocation(sanitized);
    writeStored(LOCATION_STORAGE_KEY, sanitized);
    setPickerOpen(false);
    setLocationError(null);
  }, []);

  const setDemoMode = useCallback((enabled: boolean) => {
    setDemoModeState(enabled);
    writeStored(DEMO_STORAGE_KEY, enabled);
  }, []);

  const openPicker = useCallback(() => {
    setLocationError(null);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const clearLocationError = useCallback(() => setLocationError(null), []);

  const locate = useCallback(async () => {
    setLocationError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Your browser does not support location access. Search for your city instead.");
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 300_000,
        });
      });
      const { latitude, longitude } = position.coords;
      let label = `My location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
      let name = "My location";
      let country: string | null = null;
      let admin1: string | null = null;
      let timezone: string | null = null;

      try {
        const resolved = await reverseGeocode(latitude, longitude);
        name = resolved.name || name;
        label = resolved.label || label;
        country = resolved.country ?? null;
        admin1 = resolved.admin1 ?? null;
        timezone = resolved.timezone ?? null;
      } catch {
        // Coordinates still work even if reverse geocoding is unavailable.
      }

      chooseLocation({
        name,
        label,
        latitude,
        longitude,
        country,
        admin1,
        timezone,
      });
    } catch (err) {
      const geoError = err as GeolocationPositionError;
      if (geoError?.code === 1) {
        setLocationError("Location permission was denied. Search for your city instead.");
      } else if (geoError?.code === 2) {
        setLocationError("Your device could not determine a location right now.");
      } else if (geoError?.code === 3) {
        setLocationError("Location lookup timed out. Please try again or search for a city.");
      } else {
        setLocationError("We could not access your location. Search for your city instead.");
      }
    } finally {
      setLocating(false);
    }
  }, [chooseLocation]);

  const value = useMemo<AirContextValue>(
    () => ({
      location,
      chooseLocation,
      air,
      loading: fetching && air === null,
      refreshing: fetching && air !== null,
      error,
      lastUpdated,
      refresh,
      demoMode,
      setDemoMode,
      pickerOpen,
      openPicker,
      closePicker,
      locating,
      locationError,
      clearLocationError,
      locate,
    }),
    [
      location,
      chooseLocation,
      air,
      fetching,
      error,
      lastUpdated,
      refresh,
      demoMode,
      setDemoMode,
      pickerOpen,
      openPicker,
      closePicker,
      locating,
      locationError,
      clearLocationError,
      locate,
    ],
  );

  return <AirContext.Provider value={value}>{children}</AirContext.Provider>;
}

export function useAir(): AirContextValue {
  const context = useContext(AirContext);
  if (!context) {
    throw new Error("useAir must be used inside an AirProvider.");
  }
  return context;
}
