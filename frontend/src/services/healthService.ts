import api from "./api";
import type { ApiHealth } from "../types";

export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const response = await api.get<ApiHealth>("/health", { signal, timeout: 8_000 });
  return response.data;
}
