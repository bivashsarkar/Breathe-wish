import api from "./api";
import type { GeocodeResult, LocationOption } from "../types";

interface GeocodeResponse {
  query: string;
  results: GeocodeResult[];
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const response = await api.get<GeocodeResponse>("/geocode", {
    params: { q: query },
    signal,
  });
  return response.data.results;
}

export interface ReverseGeocodeResult extends LocationOption {
  resolved: boolean;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const response = await api.get<ReverseGeocodeResult>("/geocode/reverse", {
    params: { latitude, longitude },
    signal,
  });
  return response.data;
}
