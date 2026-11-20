import api from "./api";
import type { PlannerProfile, PlannerResult } from "../types";

export interface GeneratePlanInput {
  profile: PlannerProfile;
  latitude: number;
  longitude: number;
  locationName: string;
  demo?: boolean;
}

export async function generatePlan(
  input: GeneratePlanInput,
  signal?: AbortSignal,
): Promise<PlannerResult> {
  const response = await api.post<PlannerResult>(
    "/planner",
    {
      profile: input.profile,
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName,
      demo: input.demo || false,
    },
    { signal },
  );
  return response.data;
}
