import AppIcon from "../common/AppIcon";
import Card from "../common/Card";
import { levelFromAqi, levelStyle } from "../../lib/aqi";
import { formatRelativeDay } from "../../lib/format";
import { cn } from "../../lib/cn";
import type { DailyPoint } from "../../types";

export default function ForecastStrip({ daily }: { daily: DailyPoint[] }) {
  return (
    <Card className="p-5">
      <p className="eyebrow">7-day outlook</p>
      <h2 className="mt-1 text-lg font-semibold">The week ahead</h2>
      <p className="mt-1 text-xs text-ink/45">Average daily air quality and temperature range.</p>

      <ul className="mt-4 divide-y divide-forest-50">
        {daily.slice(0, 7).map((day, index) => {
          const level = levelFromAqi(day.aqiAvg);
          const styles = levelStyle(level);
          return (
            <li key={day.date} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-14 shrink-0 text-[11px] font-semibold text-ink/55">
                {index <= 1 ? formatRelativeDay(day.date) : day.weekday}
              </span>
              <AppIcon name={day.icon} size={17} className="shrink-0 text-forest-500" />
              <span className="min-w-0 flex-1 truncate text-[10px] text-ink/35">{day.condition}</span>
              <span className="shrink-0 text-[10px] text-ink/45">
                {day.tempMax === null ? "—" : Math.round(day.tempMax)}° /{" "}
                {day.tempMin === null ? "—" : Math.round(day.tempMin)}°
              </span>
              <span
                className={cn(
                  "w-9 shrink-0 rounded-md py-1 text-center text-[10px] font-bold",
                  styles.badge.replace("ring-1", "ring-0"),
                )}
                title={`Average AQI ${day.aqiAvg ?? "unavailable"}`}
              >
                {day.aqiAvg === null ? "—" : Math.round(day.aqiAvg)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
