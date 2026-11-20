import api from "./api";
import type { AssistantMessage, AssistantResponse } from "../types";

export interface AskAssistantInput {
  message: string;
  history: AssistantMessage[];
  latitude: number;
  longitude: number;
  locationName: string;
  demo?: boolean;
}

export async function askAssistant(
  input: AskAssistantInput,
  signal?: AbortSignal,
): Promise<AssistantResponse> {
  const history = input.history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 1200),
    }));

  const response = await api.post<AssistantResponse>(
    "/assistant",
    {
      message: input.message,
      history,
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName,
      demo: input.demo || false,
    },
    { signal, timeout: 40_000 },
  );
  return response.data;
}
