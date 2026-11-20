import api from "./api";
import type { IndoorAdvice } from "../types";

export interface IndoorAdviceQuery {
  latitude: number;
  longitude: number;
  name?: string;
  areaSqm: number;
  hasPurifier: boolean;
  demo?: boolean;
}

export async function getIndoorAdvice(
  query: IndoorAdviceQuery,
  signal?: AbortSignal,
): Promise<IndoorAdvice> {
  const response = await api.get<IndoorAdvice>("/indoor", {
    params: {
      latitude: query.latitude,
      longitude: query.longitude,
      name: query.name || undefined,
      areaSqm: query.areaSqm,
      hasPurifier: query.hasPurifier,
      demo: query.demo || undefined,
    },
    signal,
  });
  return response.data;
}
