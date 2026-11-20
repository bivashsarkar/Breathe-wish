import type { AQICategory } from "../types";

export const AQI_LEVEL_STYLES: Record<
  string,
  { badge: string; dot: string; soft: string; text: string; bar: string }
> = {
  good: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  moderate: {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",
    dot: "bg-amber-500",
    soft: "bg-amber-50",
    text: "text-amber-700",
    bar: "bg-amber-500",
  },
  sensitive: {
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80",
    dot: "bg-orange-500",
    soft: "bg-orange-50",
    text: "text-orange-700",
    bar: "bg-orange-500",
  },
  unhealthy: {
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200/80",
    dot: "bg-red-500",
    soft: "bg-red-50",
    text: "text-red-700",
    bar: "bg-red-500",
  },
  "very-unhealthy": {
    badge: "bg-purple-50 text-purple-700 ring-1 ring-purple-200/80",
    dot: "bg-purple-500",
    soft: "bg-purple-50",
    text: "text-purple-700",
    bar: "bg-purple-500",
  },
  hazardous: {
    badge: "bg-rose-100 text-rose-900 ring-1 ring-rose-300/80",
    dot: "bg-rose-700",
    soft: "bg-rose-100",
    text: "text-rose-900",
    bar: "bg-rose-700",
  },
  unknown: {
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    soft: "bg-slate-50",
    text: "text-slate-600",
    bar: "bg-slate-400",
  },
};

export function levelStyle(level: string | undefined) {
  return AQI_LEVEL_STYLES[level ?? "unknown"] ?? AQI_LEVEL_STYLES.unknown;
}

/** Client-side mirror of the backend EPA breakpoints for forecast display. */
export function levelFromAqi(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi)) return "unknown";
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very-unhealthy";
  return "hazardous";
}

export function styleForCategory(category: AQICategory | undefined) {
  return levelStyle(category?.level);
}

export function pollutantTone(percent: number | null | undefined): {
  text: string;
  bar: string;
} {
  if (percent === null || percent === undefined) {
    return { text: "text-slate-500", bar: "bg-slate-300" };
  }
  if (percent <= 100) return { text: "text-emerald-700", bar: "bg-emerald-500" };
  if (percent <= 200) return { text: "text-amber-700", bar: "bg-amber-500" };
  if (percent <= 300) return { text: "text-orange-700", bar: "bg-orange-500" };
  return { text: "text-red-700", bar: "bg-red-500" };
}

export const PLAN_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  good: { label: "Good", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  acceptable: {
    label: "Acceptable",
    className: "bg-lime-50 text-lime-700 ring-1 ring-lime-200",
  },
  caution: {
    label: "Caution",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  avoid: { label: "Avoid", className: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  unknown: { label: "Unknown", className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
};

export const RISK_STYLES: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  moderate: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  high: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  "very-high": "bg-red-50 text-red-700 ring-1 ring-red-200",
  unknown: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
