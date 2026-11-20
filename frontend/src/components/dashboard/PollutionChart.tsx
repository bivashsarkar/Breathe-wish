import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesColumn } from "lucide-react";

import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { formatNumber } from "../../lib/format";
import { cn } from "../../lib/cn";
import type { HourlyPoint } from "../../types";

type Metric = "aqi" | "pm2_5";

interface TooltipPayloadItem {
  value?: number | string;
  dataKey?: string;
  payload?: HourlyPoint;
}

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: Metric;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-forest-100 bg-white px-3 py-2.5 text-xs shadow-lift">
      <p className="font-semibold text-ink">{point?.label}</p>
      <p className="mt-1 text-ink/55">
        AQI <span className="font-semibold text-forest-800">{formatNumber(point?.aqi)}</span>
      </p>
      <p className="text-ink/55">
        PM2.5 <span className="font-semibold text-forest-800">{formatNumber(point?.pm2_5, 1)} µg/m³</span>
      </p>
      {metric === "pm2_5" ? (
        <p className="mt-1 text-[10px] text-ink/35">WHO 24h guideline: 15 µg/m³</p>
      ) : null}
    </div>
  );
}

export default function PollutionChart({ hourly }: { hourly: HourlyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("aqi");

  const data = useMemo(
    () =>
      hourly.map((point) => ({
        ...point,
        aqi: point.aqi,
        pm2_5: point.pm2_5,
      })),
    [hourly],
  );

  const summary = useMemo(() => {
    if (data.length === 0) return "No hourly forecast available.";
    const aqis = data.map((point) => point.aqi);
    return `Next ${data.length} hours: AQI ranges from ${Math.min(...aqis)} to ${Math.max(...aqis)}.`;
  }, [data]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Hourly forecast</p>
          <h2 className="mt-1 text-lg font-semibold">How the air changes today</h2>
          <p className="mt-1 text-xs text-ink/45">Plan outdoor time around the cleaner hours.</p>
        </div>
        <div
          className="inline-flex self-start rounded-xl border border-forest-100 bg-forest-50/60 p-1"
          role="group"
          aria-label="Forecast metric"
        >
          {(["aqi", "pm2_5"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMetric(value)}
              aria-pressed={metric === value}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                metric === value
                  ? "bg-white text-forest-900 shadow-sm"
                  : "text-ink/45 hover:text-ink/75",
              )}
            >
              {value === "aqi" ? "AQI" : "PM2.5"}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<ChartNoAxesColumn size={20} aria-hidden="true" />}
          title="Forecast not available"
          description="The hourly forecast could not be loaded. Current conditions are still shown above."
        />
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          <div className="mt-5 h-[260px] w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bw-forecast-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12b981" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#12b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0d1f18" strokeOpacity={0.06} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64756e" }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(1, Math.floor(data.length / 8))}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64756e" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={[0, "auto"]}
                />
                <Tooltip content={<ChartTooltip metric={metric} />} />
                {metric === "aqi" ? (
                  <>
                    <ReferenceLine
                      y={100}
                      stroke="#d97706"
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                    />
                    <ReferenceLine
                      y={150}
                      stroke="#dc2626"
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                    />
                  </>
                ) : (
                  <ReferenceLine
                    y={15}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="#0f6f4e"
                  strokeWidth={2.4}
                  fill="url(#bw-forecast-fill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#0f6f4e" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-ink/40">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-forest-600" aria-hidden="true" />
              {metric === "aqi" ? "US AQI" : "PM2.5 (µg/m³)"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t border-dashed border-amber-500" aria-hidden="true" />
              {metric === "aqi" ? "Sensitive threshold (100)" : "WHO guideline (15)"}
            </span>
            {metric === "aqi" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-4 border-t border-dashed border-red-500" aria-hidden="true" />
                Unhealthy threshold (150)
              </span>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
