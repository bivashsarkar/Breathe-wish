import api from "./api";
import type { AirQualityData } from "../types";

export interface AirQuery {
  latitude: number;
  longitude: number;
  name?: string;
  demo?: boolean;
  refresh?: boolean;
}

export async function getAirQuality(
  query: AirQuery,
  signal?: AbortSignal,
): Promise<AirQualityData> {
  const response = await api.get<AirQualityData>("/air", {
    params: {
      latitude: query.latitude,
      longitude: query.longitude,
      name: query.name || undefined,
      demo: query.demo || undefined,
      refresh: query.refresh || undefined,
    },
    signal,
  });
  return response.data;
}
