import api from "./api";
import type { FamilyAdvice, FamilyMember } from "../types";

export interface FamilyAdviceInput {
  members: FamilyMember[];
  latitude: number;
  longitude: number;
  locationName: string;
  demo?: boolean;
}

export async function getFamilyAdvice(
  input: FamilyAdviceInput,
  signal?: AbortSignal,
): Promise<FamilyAdvice> {
  const response = await api.post<FamilyAdvice>(
    "/family/advice",
    {
      members: input.members.map(({ name, relation, age, activity }) => ({
        name,
        relation,
        age: age ?? undefined,
        activity: activity ?? undefined,
      })),
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName,
      demo: input.demo || false,
    },
    { signal },
  );
  return response.data;
}
