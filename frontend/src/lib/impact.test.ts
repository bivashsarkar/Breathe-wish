import { describe, expect, it } from "vitest";

import {
  EMISSION_FACTORS,
  calculateCo2Saved,
  createImpactEntry,
  getLastSevenDays,
  roundKg,
  summarizeImpact,
} from "./impact";
import type { ImpactEntry } from "../types";

function entry(overrides: Partial<ImpactEntry> = {}): ImpactEntry {
  return {
    id: overrides.id ?? "entry-1",
    type: overrides.type ?? "walk",
    distanceKm: overrides.distanceKm ?? 5,
    date: overrides.date ?? "2026-01-15",
    co2SavedKg: overrides.co2SavedKg ?? 0.96,
    createdAt: overrides.createdAt ?? "2026-01-15T08:00:00.000Z",
    note: overrides.note,
  };
}

describe("calculateCo2Saved", () => {
  it("uses the per-mode emission factor", () => {
    expect(calculateCo2Saved("walk", 5)).toBe(0.96);
    expect(calculateCo2Saved("bus", 10)).toBe(1.1);
    expect(calculateCo2Saved("metro", 10)).toBe(1.51);
  });

  it("clamps invalid distances to zero", () => {
    expect(calculateCo2Saved("walk", -4)).toBe(0);
    expect(calculateCo2Saved("walk", Number.NaN)).toBe(0);
  });

  it("rounds estimates to two decimals", () => {
    expect(calculateCo2Saved("walk", 3.333)).toBe(roundKg(3.333 * EMISSION_FACTORS.walk));
  });
});

describe("createImpactEntry", () => {
  it("builds a complete, rounded entry", () => {
    const created = createImpactEntry({ type: "bus", distanceKm: 7.44, date: "2026-02-01" });
    expect(created.type).toBe("bus");
    expect(created.distanceKm).toBe(7.4);
    expect(created.date).toBe("2026-02-01");
    expect(created.co2SavedKg).toBe(calculateCo2Saved("bus", 7.4));
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.note).toBeUndefined();
  });

  it("never logs a distance below 0.1 km", () => {
    const created = createImpactEntry({ type: "cycle", distanceKm: 0 });
    expect(created.distanceKm).toBe(0.1);
  });
});

describe("getLastSevenDays", () => {
  it("returns seven consecutive days ending today", () => {
    const now = new Date("2026-03-10T09:00:00");
    const days = getLastSevenDays([], now);
    expect(days).toHaveLength(7);
    expect(days[6].date).toBe("2026-03-10");
    expect(days[0].date).toBe("2026-03-04");
  });

  it("sums daily savings and counts entries", () => {
    const now = new Date("2026-03-10T09:00:00");
    const days = getLastSevenDays(
      [
        entry({ id: "a", date: "2026-03-10", co2SavedKg: 0.5 }),
        entry({ id: "b", date: "2026-03-10", co2SavedKg: 0.25 }),
        entry({ id: "c", date: "2026-03-09", co2SavedKg: 1 }),
      ],
      now,
    );
    const today = days.find((day) => day.date === "2026-03-10");
    const yesterday = days.find((day) => day.date === "2026-03-09");
    expect(today?.co2SavedKg).toBe(0.75);
    expect(today?.count).toBe(2);
    expect(yesterday?.co2SavedKg).toBe(1);
  });
});

describe("summarizeImpact", () => {
  const now = new Date("2026-03-10T09:00:00");

  it("handles an empty log", () => {
    const summary = summarizeImpact([], now);
    expect(summary.totalKg).toBe(0);
    expect(summary.weekKg).toBe(0);
    expect(summary.streakDays).toBe(0);
    expect(summary.goalPercent).toBe(0);
  });

  it("counts consecutive logging days including today", () => {
    const summary = summarizeImpact(
      [
        entry({ id: "a", date: "2026-03-10", co2SavedKg: 1 }),
        entry({ id: "b", date: "2026-03-09", co2SavedKg: 1 }),
        entry({ id: "c", date: "2026-03-08", co2SavedKg: 1 }),
        entry({ id: "d", date: "2026-03-06", co2SavedKg: 1 }),
      ],
      now,
    );
    expect(summary.streakDays).toBe(3);
    expect(summary.totalCount).toBe(4);
    expect(summary.todayKg).toBe(1);
  });

  it("caps the weekly goal percentage at 100", () => {
    const summary = summarizeImpact([entry({ date: "2026-03-10", co2SavedKg: 40 })], now);
    expect(summary.goalPercent).toBe(100);
  });
});
