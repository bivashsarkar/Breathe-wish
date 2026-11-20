import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Database, Sparkles } from "lucide-react";

import { formatClock, formatNumber, formatUpdated } from "../../lib/format";
import { clamp } from "../../lib/aqi";
import type { AirQualityData } from "../../types";

function Gauge({ aqi, color }: { aqi: number | null; color: string }) {
  const value = clamp(aqi ?? 0, 0, 300);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - value / 300);
  return (
    <div
      className="relative flex h-[196px] w-[196px] shrink-0 items-center justify-center"
      role="img"
      aria-label={aqi === null ? "Air quality index unavailable" : `Air quality index ${Math.round(aqi)}`}
    >
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="12"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint-100/55">
          US AQI
        </span>
        <span className="mt-1 text-[52px] font-semibold leading-none tracking-[-0.05em] text-white">
          {aqi === null ? "—" : Math.round(aqi)}
        </span>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-mint-100/80">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          Live index
        </span>
      </div>
    </div>
  );
}

export default function AQICard({ air }: { air: AirQualityData }) {
  const { current, insights, location, meta } = air;
  const category = current.category;
  const pm25 = current.pollutants.pm2_5;
  const pm10 = current.pollutants.pm10;
  const best = insights.bestOutdoorWindow;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-950 via-forest-900 to-[#0d4a34] p-5 text-white shadow-lift sm:p-7">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: category.color }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-mint-400/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-mint-200/55">Current conditions</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white">{location.name}</h2>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-mint-100/50">
              {meta.isDemo ? (
                <>
                  <Database size={11} aria-hidden="true" /> Demo dataset · clearly labelled
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-300" aria-hidden="true" />
                  Live · Open-Meteo · updated {formatUpdated(meta.fetchedAt)}
                </>
              )}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
            style={{ backgroundColor: category.color }}
          >
            {category.label}
          </span>
        </div>

        <div className="mt-5 flex flex-col items-center gap-5 sm:mt-2 sm:flex-row sm:gap-7">
          <Gauge aqi={current.aqi} color={category.color} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h3 className="text-[22px] font-semibold leading-snug tracking-[-0.03em] text-white">
              {insights.headline}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-mint-50/65">{category.advice}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-mint-100/45">
              <span className="font-semibold text-mint-100/70">Sensitive groups:</span>{" "}
              {category.sensitiveAdvice}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-sm">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mint-100/45">PM2.5</p>
                <p className="mt-1 text-lg font-semibold leading-none text-white">
                  {pm25 ? formatNumber(pm25.displayValue, 1) : "—"}
                  <span className="ml-1 text-[10px] font-medium text-mint-100/50">µg/m³</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mint-100/45">PM10</p>
                <p className="mt-1 text-lg font-semibold leading-none text-white">
                  {pm10 ? formatNumber(pm10.displayValue, 1) : "—"}
                  <span className="ml-1 text-[10px] font-medium text-mint-100/50">µg/m³</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[12px] text-mint-100/60">
            <Clock size={14} className="text-mint-300" aria-hidden="true" />
            {best ? (
              <span>
                Cleanest outdoor window{" "}
                <strong className="font-semibold text-mint-100">
                  {formatClock(best.start)}–{formatClock(best.end)}
                </strong>{" "}
                · AQI {Math.round(best.averageAqi)}
              </span>
            ) : (
              <span>No reliable clean window in the next 24 hours.</span>
            )}
          </div>
          <Link
            to="/assistant"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-mint-300 px-3.5 text-[12px] font-bold text-forest-950 transition hover:bg-mint-200"
          >
            <Sparkles size={14} aria-hidden="true" />
            Ask the assistant
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
