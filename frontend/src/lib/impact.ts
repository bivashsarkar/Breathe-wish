import type { ImpactActivityType, ImpactEntry } from "../types";
import { todayIso } from "./format";
import { readStored, writeStored } from "./storage";

/**
 * Emission factors in kg CO2e per passenger-km.
 *
 * The "avoided" modes are compared against a solo petrol car trip. These are
 * estimates based on widely used average factors, not measurements. They say
 * nothing about local pollutant concentrations.
 */
export const EMISSION_FACTORS: Record<ImpactActivityType, number> = {
  walk: 0.192,
  cycle: 0.192,
  bus: 0.11,
  metro: 0.151,
  "avoided-car": 0.192,
  "remote-work": 0.192,
};

export interface ImpactActivityDefinition {
  value: ImpactActivityType;
  label: string;
  shortLabel: string;
  description: string;
  baseline: string;
}

export const IMPACT_ACTIVITIES: ImpactActivityDefinition[] = [
  {
    value: "walk",
    label: "Walked instead of driving",
    shortLabel: "Walked",
    description: "A zero-tailpipe trip that replaces a short car journey.",
    baseline: "Compared with a petrol car: 0.192 kg CO₂e per km",
  },
  {
    value: "cycle",
    label: "Cycled instead of driving",
    shortLabel: "Cycled",
    description: "Zero tailpipe emissions and no fuel use.",
    baseline: "Compared with a petrol car: 0.192 kg CO₂e per km",
  },
  {
    value: "bus",
    label: "Took the bus",
    shortLabel: "Bus",
    description: "Shared transport spreads emissions across many passengers.",
    baseline: "Bus minus solo car: about 0.11 kg CO₂e saved per km",
  },
  {
    value: "metro",
    label: "Took the metro or train",
    shortLabel: "Metro",
    description: "Electric rail is usually the lowest-carbon motorised option.",
    baseline: "Metro minus solo car: about 0.151 kg CO₂e saved per km",
  },
  {
    value: "avoided-car",
    label: "Avoided a car trip",
    shortLabel: "Car trip avoided",
    description: "Combined errands, carpooled or skipped a solo drive.",
    baseline: "Avoided petrol car: 0.192 kg CO₂e per km",
  },
  {
    value: "remote-work",
    label: "Worked from home",
    shortLabel: "Remote work",
    description: "Enter the commute distance you did not travel.",
    baseline: "Avoided petrol car commute: 0.192 kg CO₂e per km",
  },
];

export const IMPACT_STORAGE_KEY = "breathew.impact.v1";
export const WEEKLY_GOAL_KG = 15;

export function roundKg(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCo2Saved(
  type: ImpactActivityType,
  distanceKm: number,
): number {
  const distance = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const factor = EMISSION_FACTORS[type] ?? 0;
  return roundKg(distance * factor);
}

export function createImpactEntry(input: {
  type: ImpactActivityType;
  distanceKm: number;
  date?: string;
  note?: string;
}): ImpactEntry {
  const distanceKm = Math.round(Math.max(0.1, input.distanceKm) * 10) / 10;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `impact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    distanceKm,
    date: input.date || todayIso(),
    note: input.note?.trim() || undefined,
    co2SavedKg: calculateCo2Saved(input.type, distanceKm),
    createdAt: new Date().toISOString(),
  };
}

function isValidEntry(value: unknown): value is ImpactEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ImpactEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.type === "string" &&
    entry.type in EMISSION_FACTORS &&
    typeof entry.distanceKm === "number" &&
    entry.distanceKm > 0 &&
    typeof entry.co2SavedKg === "number" &&
    typeof entry.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
  );
}

export function loadImpactEntries(): ImpactEntry[] {
  const stored = readStored<unknown>(IMPACT_STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isValidEntry);
}

export function saveImpactEntries(entries: ImpactEntry[]): boolean {
  return writeStored(IMPACT_STORAGE_KEY, entries);
}

export function addImpactEntry(entry: ImpactEntry): ImpactEntry[] {
  const entries = loadImpactEntries();
  const next = [entry, ...entries];
  saveImpactEntries(next);
  return next;
}

export interface DayImpact {
  date: string;
  label: string;
  co2SavedKg: number;
  count: number;
}

export function getLastSevenDays(entries: ImpactEntry[], now = new Date()): DayImpact[] {
  const days: DayImpact[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const iso = todayIso(date);
    const dayEntries = entries.filter((entry) => entry.date === iso);
    days.push({
      date: iso,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      co2SavedKg: roundKg(dayEntries.reduce((sum, entry) => sum + entry.co2SavedKg, 0)),
      count: dayEntries.length,
    });
  }
  return days;
}

export interface ImpactSummary {
  totalKg: number;
  weekKg: number;
  weekCount: number;
  totalCount: number;
  todayKg: number;
  streakDays: number;
  weeklyGoalKg: number;
  goalPercent: number;
}

export function summarizeImpact(entries: ImpactEntry[], now = new Date()): ImpactSummary {
  const days = getLastSevenDays(entries, now);
  const weekDates = new Set(days.map((day) => day.date));
  const today = todayIso(now);
  const totalKg = roundKg(entries.reduce((sum, entry) => sum + entry.co2SavedKg, 0));
  const weekEntries = entries.filter((entry) => weekDates.has(entry.date));
  const weekKg = roundKg(weekEntries.reduce((sum, entry) => sum + entry.co2SavedKg, 0));

  const activeDates = new Set(entries.map((entry) => entry.date));
  let streakDays = 0;
  const cursor = new Date(now);
  // A streak can start today or yesterday, then must be consecutive.
  if (!activeDates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDates.has(todayIso(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalKg,
    weekKg,
    weekCount: weekEntries.length,
    totalCount: entries.length,
    todayKg: roundKg(
      entries.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.co2SavedKg, 0),
    ),
    streakDays,
    weeklyGoalKg: WEEKLY_GOAL_KG,
    goalPercent: Math.min(100, Math.round((weekKg / WEEKLY_GOAL_KG) * 100)),
  };
}
