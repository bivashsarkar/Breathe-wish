import type { ReactNode } from "react";
import { Compass, Droplets, Eye, Gauge, Sunrise, Sunset, Wind } from "lucide-react";

import AppIcon from "../common/AppIcon";
import Card from "../common/Card";
import { formatClock, formatNumber } from "../../lib/format";
import type { WeatherData } from "../../types";

function Metric({
  icon,
  label,
  value,
  suffix,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-forest-50/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {value}
        {suffix ? <span className="ml-0.5 text-[10px] font-medium text-ink/40">{suffix}</span> : null}
      </p>
    </div>
  );
}

export default function WeatherCard({ weather }: { weather: WeatherData | null }) {
  if (!weather) {
    return (
      <Card className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
          <Wind size={20} aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-sm font-semibold">Weather unavailable</h2>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink/45">
          Air quality is still live, but the weather service did not respond. Try refreshing in a moment.
        </p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-mint-100/60 blur-2xl" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Weather now</p>
            <p className="mt-1 text-sm font-medium text-ink/55">{weather.condition}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-forest-700 shadow-sm ring-1 ring-forest-100/80">
            <AppIcon name={weather.icon} size={24} strokeWidth={1.7} />
          </div>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <span className="text-[46px] font-semibold leading-none tracking-[-0.05em] text-ink">
            {weather.temperature === null ? "—" : Math.round(weather.temperature)}
          </span>
          <span className="mb-1 text-lg font-medium text-ink/35">°C</span>
          <span className="mb-1.5 ml-auto text-[11px] text-ink/40">
            Feels like {weather.apparentTemperature === null ? "—" : Math.round(weather.apparentTemperature)}°
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric
            icon={<Droplets size={11} aria-hidden="true" />}
            label="Humidity"
            value={formatNumber(weather.humidity)}
            suffix="%"
          />
          <Metric
            icon={<Wind size={11} aria-hidden="true" />}
            label="Wind"
            value={formatNumber(weather.windSpeed, 1)}
            suffix="km/h"
          />
          <Metric
            icon={<Compass size={11} aria-hidden="true" />}
            label="Direction"
            value={weather.windDirectionLabel || "—"}
          />
          <Metric
            icon={<Eye size={11} aria-hidden="true" />}
            label="Visibility"
            value={formatNumber(weather.visibilityKm, 1)}
            suffix="km"
          />
          <Metric
            icon={<Gauge size={11} aria-hidden="true" />}
            label="UV index"
            value={formatNumber(weather.uvIndex, 1)}
          />
          <Metric
            icon={<Wind size={11} aria-hidden="true" />}
            label="Gusts"
            value={formatNumber(weather.windGust, 1)}
            suffix="km/h"
          />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-forest-50 pt-3 text-[11px] text-ink/40">
          <span className="inline-flex items-center gap-1.5">
            <Sunrise size={12} className="text-amber-500" aria-hidden="true" />
            {formatClock(weather.sunrise)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sunset size={12} className="text-orange-500" aria-hidden="true" />
            {formatClock(weather.sunset)}
          </span>
        </div>
      </div>
    </Card>
  );
}
