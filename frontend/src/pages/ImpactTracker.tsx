import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CalendarDays,
  Flame,
  Leaf,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Notice from "../components/common/Notice";
import EmptyState from "../components/common/EmptyState";
import AppIcon from "../components/common/AppIcon";
import { addImpactEntry, calculateCo2Saved, createImpactEntry, getLastSevenDays, IMPACT_ACTIVITIES, loadImpactEntries, saveImpactEntries, summarizeImpact } from "../lib/impact";
import { formatNumber, formatRelativeDay, todayIso } from "../lib/format";
import { cn } from "../lib/cn";
import type { ImpactActivityType, ImpactEntry } from "../types";

const ACTIVITY_ICONS: Record<ImpactActivityType, string> = {
  walk: "footprints",
  cycle: "bike",
  bus: "bus",
  metro: "train",
  "avoided-car": "car",
  "remote-work": "home",
};

function activityDefinition(type: ImpactActivityType) {
  return IMPACT_ACTIVITIES.find((activity) => activity.value === type) ?? IMPACT_ACTIVITIES[0];
}

export default function ImpactTracker() {
  const [entries, setEntries] = useState<ImpactEntry[]>(loadImpactEntries);
  const [type, setType] = useState<ImpactActivityType>("walk");
  const [distance, setDistance] = useState(5);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const typeRef = useRef<HTMLSelectElement>(null);

  const summary = useMemo(() => summarizeImpact(entries), [entries]);
  const week = useMemo(() => getLastSevenDays(entries), [entries]);
  const preview = calculateCo2Saved(type, Number.isFinite(distance) ? distance : 0);
  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
      ),
    [entries],
  );
  const maxWeek = Math.max(...week.map((day) => day.co2SavedKg), 1);

  const addActivity = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const numericDistance = Number(distance);
    if (!Number.isFinite(numericDistance) || numericDistance < 0.1 || numericDistance > 500) {
      setError("Distance must be between 0.1 and 500 km.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Choose a valid date.");
      return;
    }
    if (date > todayIso()) {
      setError("You cannot log an activity in the future.");
      return;
    }
    const entry = createImpactEntry({
      type,
      distanceKm: numericDistance,
      date,
      note: note.trim() || undefined,
    });
    const next = addImpactEntry(entry);
    setEntries(next);
    setSuccess(
      `Logged ${activityDefinition(type).shortLabel.toLowerCase()} · ${entry.distanceKm} km · estimated ${entry.co2SavedKg.toFixed(2)} kg CO₂e avoided.`,
    );
    setDistance(5);
    setNote("");
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id);
    saveImpactEntries(next);
    setEntries(next);
    setSuccess("Activity removed.");
  };

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="My environmental impact"
        title="Small shifts, measured honestly."
        description="Log low-emission choices and see an estimate of the carbon you avoided. We keep estimated CO₂e savings clearly separate from measured local air pollution."
        actions={
          <>
            <Badge tone="mint" dot>
              Week goal {summary.weeklyGoalKg} kg CO₂e
            </Badge>
            <Button
              variant="mint"
              onClick={() => {
                typeRef.current?.focus();
                typeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              icon={<Plus size={15} aria-hidden="true" />}
            >
              Log an activity
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "This week",
            value: `${formatNumber(summary.weekKg, 2)} kg`,
            caption: "estimated CO₂e avoided",
            icon: Leaf,
            accent: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "All time",
            value: `${formatNumber(summary.totalKg, 2)} kg`,
            caption: `${summary.totalCount} activities logged`,
            icon: TrendingUp,
            accent: "text-forest-600 bg-forest-50",
          },
          {
            label: "Active streak",
            value: `${summary.streakDays} ${summary.streakDays === 1 ? "day" : "days"}`,
            caption: "consecutive logging days",
            icon: Flame,
            accent: "text-orange-600 bg-orange-50",
          },
          {
            label: "Today",
            value: `${formatNumber(summary.todayKg, 2)} kg`,
            caption: "estimated CO₂e avoided",
            icon: Activity,
            accent: "text-sky-600 bg-sky-50",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">{stat.label}</p>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", stat.accent)}>
                  <Icon size={14} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">{stat.value}</p>
              <p className="mt-0.5 text-[10px] text-ink/35">{stat.caption}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="eyebrow">Weekly progress</p>
              <h2 className="mt-1 text-lg font-semibold">Last seven days</h2>
              <p className="mt-1 text-xs text-ink/45">Estimated kilograms of CO₂e avoided per day.</p>
            </div>
            <Badge tone="neutral">Estimates, not measurements</Badge>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              className="mt-5"
              icon={<TrendingUp size={20} aria-hidden="true" />}
              title="Your impact chart is waiting"
              description="Log a walk, cycle, bus or metro trip to see your estimated weekly carbon savings."
            />
          ) : (
            <>
              <p className="sr-only">
                {week
                  .map((day) => `${day.label}: ${day.co2SavedKg.toFixed(2)} kilograms CO2e avoided`)
                  .join(". ")}
              </p>
              <div className="mt-4 h-[250px] w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={week} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#0d1f18" strokeOpacity={0.06} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#64756e" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64756e" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      domain={[0, Math.ceil(maxWeek * 1.2 * 10) / 10]}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(18,185,129,0.06)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #d8eee0",
                        fontSize: 11,
                        boxShadow: "0 12px 32px -12px rgba(13,31,24,0.2)",
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)} kg`, "CO₂e avoided"]}
                    />
                    <Bar dataKey="co2SavedKg" fill="#12b981" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        <Card className="p-5 xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Weekly goal</p>
              <h2 className="mt-1 text-lg font-semibold">{summary.weeklyGoalKg} kg CO₂e</h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-50 text-forest-800">
              <Target size={18} aria-hidden="true" />
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-ink">
              {formatNumber(summary.weekKg, 2)}
              <span className="ml-1 text-xs font-medium text-ink/35">kg</span>
            </p>
            <p className="text-[11px] font-semibold text-forest-600">{summary.goalPercent}%</p>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-forest-50"
            role="progressbar"
            aria-valuenow={summary.goalPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly carbon savings goal"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint-400 to-forest-600 transition-all duration-700"
              style={{ width: `${summary.goalPercent}%` }}
            />
          </div>

          <div className="mt-4 space-y-2.5 border-t border-forest-50 pt-3 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-ink/40">Activities this week</span>
              <span className="font-semibold text-ink">{summary.weekCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink/40">Average per activity</span>
              <span className="font-semibold text-ink">
                {summary.weekCount ? formatNumber(summary.weekKg / summary.weekCount, 2) : "0.00"} kg
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink/40">Goal remaining</span>
              <span className="font-semibold text-ink">
                {formatNumber(Math.max(0, summary.weeklyGoalKg - summary.weekKg), 2)} kg
              </span>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-forest-50/60 p-3 text-[10px] leading-relaxed text-ink/40">
            A moderate weekly target keeps the habit achievable. The estimate assumes each logged trip replaces
            a solo petrol-car journey.
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="h-fit p-5 sm:p-6 xl:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-50 text-forest-700">
              <Plus size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Log a sustainable choice</h2>
              <p className="text-[10px] text-ink/40">Saved in this browser only.</p>
            </div>
          </div>

          <form onSubmit={addActivity} className="mt-4 space-y-3.5" id="log-activity">
            <div>
              <label htmlFor="impact-type" className="field-label">
                Activity
              </label>
              <select
                id="impact-type"
                ref={typeRef}
                className="field"
                value={type}
                onChange={(event) => {
                  setType(event.target.value as ImpactActivityType);
                  setSuccess(null);
                }}
              >
                {IMPACT_ACTIVITIES.map((activity) => (
                  <option key={activity.value} value={activity.value}>
                    {activity.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[9.5px] leading-relaxed text-ink/35">
                {activityDefinition(type).description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="impact-distance" className="field-label">
                  Distance
                </label>
                <div className="relative">
                  <input
                    id="impact-distance"
                    type="number"
                    min={0.1}
                    max={500}
                    step={0.1}
                    className="field pr-9"
                    value={distance}
                    onChange={(event) => setDistance(Number(event.target.value))}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink/35">
                    km
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="impact-date" className="field-label">
                  Date
                </label>
                <input
                  id="impact-date"
                  type="date"
                  className="field"
                  value={date}
                  max={todayIso()}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="impact-note" className="field-label">
                Note (optional)
              </label>
              <input
                id="impact-note"
                className="field"
                value={note}
                maxLength={120}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. commute to work"
              />
            </div>

            <div className="rounded-xl bg-forest-50/70 px-3.5 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-ink/40">
                Estimated saving
              </p>
              <p className="mt-1 text-lg font-semibold text-forest-800">
                {preview.toFixed(2)} <span className="text-[10px] font-medium text-ink/40">kg CO₂e</span>
              </p>
              <p className="mt-0.5 text-[9px] leading-relaxed text-ink/35">
                {activityDefinition(type).baseline}
              </p>
            </div>

            {error ? (
              <p role="alert" className="text-[11px] font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" icon={<Plus size={15} aria-hidden="true" />}>
              Add to my impact
            </Button>
          </form>

          {success ? (
            <div className="mt-3" aria-live="polite">
              <Notice tone="success">{success}</Notice>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4 xl:col-span-8">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Activity log</p>
                <h2 className="mt-1 text-lg font-semibold">Your sustainable choices</h2>
              </div>
              {entries.length > 0 ? (
                <Badge tone="neutral">
                  <CalendarDays size={11} aria-hidden="true" />
                  {entries.length} total
                </Badge>
              ) : null}
            </div>

            {entries.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={<Leaf size={20} aria-hidden="true" />}
                title="No activities logged yet"
                description="Start with a commute you already made by bus, metro, bike or on foot. Every entry contributes an estimate to your weekly progress."
              />
            ) : (
              <ul className="mt-4 divide-y divide-forest-50">
                {sortedEntries.map((entry) => {
                  const definition = activityDefinition(entry.type);
                  return (
                    <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                        <AppIcon name={ACTIVITY_ICONS[entry.type] ?? "activity"} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-xs font-semibold text-ink">{definition.shortLabel}</p>
                          <span className="text-[10px] text-ink/35">· {entry.distanceKm} km</span>
                          <span className="text-[10px] text-ink/35">· {formatRelativeDay(entry.date)}</span>
                        </div>
                        {entry.note ? (
                          <p className="mt-0.5 truncate text-[10px] text-ink/40">{entry.note}</p>
                        ) : null}
                        <p className="mt-0.5 text-[9px] text-ink/30">
                          Baseline: {definition.baseline}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-forest-700">
                          −{entry.co2SavedKg.toFixed(2)} kg
                        </p>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`Delete ${definition.shortLabel} entry from ${entry.date}`}
                          title="Delete entry"
                          className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/25 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Notice tone="warning" title="Estimated carbon savings are not a measured drop in local pollution">
            Emission factors estimate the CO₂e avoided by choosing a lower-emission trip. They do not measure
            — and should not be presented as — an actual reduction in local AQI or PM2.5. Local air quality
            depends on traffic, industry, weather and many other sources.
          </Notice>

          <details className="rounded-2xl border border-forest-100 bg-white p-4 text-[11px] text-ink/50">
            <summary className="cursor-pointer font-semibold text-ink/70">
              How we calculate these estimates
            </summary>
            <div className="mt-3 space-y-2 leading-relaxed">
              <p>
                We use average per-passenger-km factors: petrol car 0.192 kg CO₂e, bus 0.082, metro/rail
                0.041, walking and cycling 0. Shared trips are compared with a solo car journey, so the
                saving is the difference between the modes.
              </p>
              <p>
                These are planning estimates based on widely used averages. Real emissions vary with vehicle,
                occupancy, fuel and route. We do not claim precision beyond two decimal places.
              </p>
              <p>
                Saved data lives in your browser's localStorage and is not sent to our servers.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
