import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  Leaf,
  Route,
  Sparkles,
  TrendingDown,
  Users,
  Wind,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Notice from "../components/common/Notice";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import AppIcon from "../components/common/AppIcon";
import { useAir } from "../context/AirContext";
import { generatePlan } from "../services/plannerService";
import { getApiErrorMessage } from "../services/api";
import { addImpactEntry, createImpactEntry } from "../lib/impact";
import { readStored, writeStored } from "../lib/storage";
import { PLAN_STATUS_STYLES, levelStyle } from "../lib/aqi";
import { formatAqi, formatUpdated } from "../lib/format";
import { cn } from "../lib/cn";
import type { PlannerProfile, PlannerResult } from "../types";

const PROFILE_KEY = "breathew.planner.profile.v1";

const DEFAULT_PROFILE: PlannerProfile = {
  occupation: "office",
  transport: "mixed",
  outdoorActivity: "walking",
  activityTime: "morning",
  commuteDistanceKm: 10,
  hasChildren: false,
  hasElderly: false,
};

const OCCUPATIONS: Array<{ value: PlannerProfile["occupation"]; label: string }> = [
  { value: "student", label: "Student" },
  { value: "office", label: "Office worker" },
  { value: "remote", label: "Remote worker" },
  { value: "outdoor-worker", label: "Outdoor worker" },
  { value: "homemaker", label: "Homemaker / caregiver" },
  { value: "other", label: "Other" },
];

const TRANSPORTS: Array<{
  value: PlannerProfile["transport"];
  label: string;
  icon: string;
}> = [
  { value: "walk", label: "Walk", icon: "footprints" },
  { value: "cycle", label: "Cycle", icon: "bike" },
  { value: "bus", label: "Bus", icon: "bus" },
  { value: "metro", label: "Metro", icon: "train" },
  { value: "two-wheeler", label: "Two-wheeler", icon: "car" },
  { value: "car", label: "Car", icon: "car" },
  { value: "mixed", label: "Mixed", icon: "route" },
];

const ACTIVITIES: Array<{ value: PlannerProfile["outdoorActivity"]; label: string }> = [
  { value: "walking", label: "Walking / errands" },
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "sports", label: "Outdoor sports" },
  { value: "none", label: "No outdoor activity" },
];

const PLAN_ICONS: Record<string, string> = {
  health: "heart",
  transport: "bus",
  indoor: "home",
  outdoor: "sun",
  eco: "leaf",
};

function readProfile(): PlannerProfile {
  const stored = readStored<Partial<PlannerProfile>>(PROFILE_KEY, {});
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    commuteDistanceKm:
      typeof stored.commuteDistanceKm === "number" && stored.commuteDistanceKm > 0
        ? stored.commuteDistanceKm
        : DEFAULT_PROFILE.commuteDistanceKm,
  };
}

function PlannerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Generating your plan">
      <div className="skeleton h-32 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function DailyPlanner() {
  const { air, location, demoMode } = useAir();
  const [profile, setProfile] = useState<PlannerProfile>(readProfile);
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loggedIds, setLoggedIds] = useState<string[]>([]);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    writeStored(PROFILE_KEY, profile);
  }, [profile]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const update = <K extends keyof PlannerProfile>(key: K, value: PlannerProfile[K]) => {
    setProfile((previous) => ({ ...previous, [key]: value }));
  };

  const generate = async () => {
    const distance = Number(profile.commuteDistanceKm);
    if (!Number.isFinite(distance) || distance < 0.5 || distance > 100) {
      setFormError("Commute distance must be between 0.5 and 100 km each way.");
      return;
    }
    setFormError(null);
    setError(null);
    setLoading(true);
    setLoggedIds([]);
    setLogMessage(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const plan = await generatePlan(
        {
          profile: { ...profile, commuteDistanceKm: distance },
          latitude: location.latitude,
          longitude: location.longitude,
          locationName: location.label || location.name,
          demo: demoMode,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setResult(plan);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(getApiErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const logSwap = (optionId: string, title: string, logType: string | undefined, dailySaved: number) => {
    const type = (logType ?? "avoided-car") as Parameters<typeof createImpactEntry>[0]["type"];
    const entry = createImpactEntry({
      type,
      distanceKm: Math.max(0.5, Number(profile.commuteDistanceKm) * 2),
      note: `Daily planner swap: ${title}`,
    });
    // Keep the headline savings consistent with the planner estimate.
    entry.co2SavedKg = Math.max(0.01, Math.round(dailySaved * 100) / 100);
    addImpactEntry(entry);
    setLoggedIds((previous) => [...previous, optionId]);
    setLogMessage(`"${title}" was added to My Impact with an estimated ${entry.co2SavedKg.toFixed(2)} kg CO₂e saved.`);
  };

  const generatedElsewhere =
    result !== null &&
    (Math.abs(result.location.latitude - location.latitude) > 0.02 ||
      Math.abs(result.location.longitude - location.longitude) > 0.02);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Smart daily planner"
        title="A routine that works around today's air."
        description="Tell BreatheWise how you live and travel. We combine the live hourly forecast with your routine to find safer outdoor windows and lower-emission swaps."
        actions={
          <>
            <Badge tone={air?.meta.isDemo ? "amber" : "mint"} dot>
              {air?.meta.isDemo ? "Demo data" : `AQI ${air ? formatAqi(air.current.aqi) : "—"} · ${air?.current.category.label ?? "Loading"}`}
            </Badge>
            <Link
              to="/assistant"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-forest-100 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition hover:border-mint-300"
            >
              <Sparkles size={15} aria-hidden="true" />
              Ask the assistant
            </Link>
          </>
        }
      />

      {generatedElsewhere ? (
        <Notice tone="info" title="Location changed since this plan was generated">
          The plan below is for {result?.location.name}. Regenerate it for {location.name} to use current
          conditions.
          <button
            type="button"
            onClick={() => void generate()}
            className="ml-1 font-semibold text-sky-800 underline underline-offset-2"
          >
            Regenerate
          </button>
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="h-fit p-5 sm:p-6 xl:col-span-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
              <CalendarDays size={17} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Your everyday routine</p>
              <p className="text-[10px] text-ink/40">Saved in this browser. You can change it anytime.</p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <div>
              <label htmlFor="planner-occupation" className="field-label">
                What do you do most days?
              </label>
              <select
                id="planner-occupation"
                className="field"
                value={profile.occupation}
                onChange={(event) =>
                  update("occupation", event.target.value as PlannerProfile["occupation"])
                }
              >
                {OCCUPATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="field-label">Usual way to travel</legend>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {TRANSPORTS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-[10.5px] font-semibold transition",
                      profile.transport === option.value
                        ? "border-mint-300 bg-mint-50 text-forest-900 ring-1 ring-mint-200"
                        : "border-forest-100 bg-white text-ink/50 hover:border-mint-200 hover:text-forest-800",
                    )}
                  >
                    <input
                      type="radio"
                      name="transport"
                      value={option.value}
                      checked={profile.transport === option.value}
                      onChange={() => update("transport", option.value)}
                      className="sr-only"
                    />
                    <AppIcon
                      name={option.icon === "route" ? "bus" : option.icon}
                      size={15}
                      className="text-current"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="planner-activity" className="field-label">
                  Outdoor activity
                </label>
                <select
                  id="planner-activity"
                  className="field"
                  value={profile.outdoorActivity}
                  onChange={(event) =>
                    update("outdoorActivity", event.target.value as PlannerProfile["outdoorActivity"])
                  }
                >
                  {ACTIVITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="planner-time" className="field-label">
                  Preferred time
                </label>
                <select
                  id="planner-time"
                  className="field"
                  value={profile.activityTime}
                  onChange={(event) =>
                    update("activityTime", event.target.value as PlannerProfile["activityTime"])
                  }
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="planner-distance" className="field-label">
                One-way commute distance
              </label>
              <div className="relative">
                <input
                  id="planner-distance"
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  inputMode="decimal"
                  className="field pr-12"
                  value={profile.commuteDistanceKm}
                  onChange={(event) => update("commuteDistanceKm", Number(event.target.value))}
                  aria-describedby="planner-distance-help"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink/35">
                  km
                </span>
              </div>
              <p id="planner-distance-help" className="mt-1.5 text-[10px] text-ink/35">
                Used to estimate transport CO₂e savings — never to judge your choices.
              </p>
            </div>

            <fieldset>
              <legend className="field-label">Who is at home?</legend>
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-forest-100 px-3 py-2.5 text-xs font-medium text-ink/65 transition hover:border-mint-200">
                  <input
                    type="checkbox"
                    checked={profile.hasChildren}
                    onChange={(event) => update("hasChildren", event.target.checked)}
                    className="h-4 w-4 rounded border-forest-300 accent-forest-700"
                  />
                  <Users size={14} className="text-forest-500" aria-hidden="true" />
                  Children or teenagers
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-forest-100 px-3 py-2.5 text-xs font-medium text-ink/65 transition hover:border-mint-200">
                  <input
                    type="checkbox"
                    checked={profile.hasElderly}
                    onChange={(event) => update("hasElderly", event.target.checked)}
                    className="h-4 w-4 rounded border-forest-300 accent-forest-700"
                  />
                  <Users size={14} className="text-forest-500" aria-hidden="true" />
                  Older adults
                </label>
              </div>
            </fieldset>

            {formError ? (
              <p role="alert" className="flex items-start gap-1.5 text-[11px] font-medium text-red-600">
                <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
              icon={<Sparkles size={16} aria-hidden="true" />}
            >
              {loading ? "Building your plan…" : result ? "Regenerate my plan" : "Generate my daily plan"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-forest-50 pt-3">
            <p className="text-[10px] text-ink/35">
              {air
                ? `Uses live data updated ${formatUpdated(air.meta.fetchedAt)}.`
                : "Live data will be fetched when you generate the plan."}
            </p>
            <button
              type="button"
              onClick={() => setProfile(DEFAULT_PROFILE)}
              className="text-[10px] font-semibold text-forest-600 hover:underline"
            >
              Reset form
            </button>
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-7">
          {error ? (
            <ErrorState
              title="We could not build your plan"
              message={error}
              onRetry={() => void generate()}
              retrying={loading}
            />
          ) : null}

          {loading ? <PlannerSkeleton /> : null}

          {!loading && !error && !result ? (
            <Card className="p-2">
              <EmptyState
                className="border-0 bg-transparent py-16"
                icon={<Route size={22} aria-hidden="true" />}
                title="Your day, adapted to the air"
                description="Fill in your routine and generate a plan. BreatheWise will find the cleanest outdoor window, adapt your commute and suggest lower-emission alternatives."
                action={
                  <div className="mx-auto grid max-w-md gap-2 text-left text-[11px] text-ink/50 sm:grid-cols-3">
                    {[
                      ["1", "Live forecast", "Reads the next 24 hours"],
                      ["2", "Personal routine", "Commute, exercise, family"],
                      ["3", "Clear impact", "Estimated CO₂e savings"],
                    ].map(([step, title, description]) => (
                      <div key={step} className="rounded-xl bg-forest-50/60 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-forest-500">
                          Step {step}
                        </p>
                        <p className="mt-1 font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 leading-relaxed">{description}</p>
                      </div>
                    ))}
                  </div>
                }
              />
            </Card>
          ) : null}

          {!loading && result ? (
            <>
              <Card className="overflow-hidden">
                <div className="border-b border-forest-50 bg-gradient-to-br from-forest-900 to-forest-700 p-5 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mint-200/60">
                        Plan for {result.location.name}
                      </p>
                      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-mint-50/85">
                        {result.summary}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        levelStyle(
                          result.dataSnapshot.aqi === null
                            ? "unknown"
                            : air?.current.category.level,
                        ).badge,
                      )}
                    >
                      {result.dataSnapshot.category ?? "Unknown"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-mint-100/55">
                    <span className="inline-flex items-center gap-1.5">
                      <Wind size={11} aria-hidden="true" />
                      AQI {result.dataSnapshot.aqi ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={11} aria-hidden="true" />
                      Generated {formatUpdated(result.generatedAt)}
                    </span>
                    {result.dataSnapshot.weather ? (
                      <span>
                        {Math.round(result.dataSnapshot.weather.temperature ?? 0)}°C ·{" "}
                        {result.dataSnapshot.weather.condition}
                      </span>
                    ) : null}
                  </div>
                </div>

                {result.alerts.length > 0 ? (
                  <div className="space-y-2 border-b border-forest-50 p-4">
                    {result.alerts.map((alert, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed",
                          alert.level === "high"
                            ? "bg-red-50 text-red-800"
                            : alert.level === "medium"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-sky-50 text-sky-800",
                        )}
                      >
                        <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {alert.message}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">Your day at a glance</h2>
                    {result.bestWindow ? (
                      <Badge tone="mint">
                        Best window {result.bestWindow.startLabel}–{result.bestWindow.endLabel}
                      </Badge>
                    ) : null}
                  </div>

                  <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[46px] before:top-2 before:w-px before:bg-forest-100 sm:before:left-[54px]">
                    {result.plan.map((item) => {
                      const status = PLAN_STATUS_STYLES[item.status] ?? PLAN_STATUS_STYLES.unknown;
                      return (
                        <li key={item.id} className="relative flex gap-3 sm:gap-4">
                          <span className="relative z-10 mt-0.5 flex w-[34px] shrink-0 flex-col items-center gap-1 sm:w-[42px]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-forest-100 bg-white text-forest-600 shadow-sm">
                              <AppIcon name={PLAN_ICONS[item.category] ?? "activity"} size={15} />
                            </span>
                          </span>
                          <div className="min-w-0 flex-1 rounded-2xl border border-forest-100/70 bg-white p-3.5 shadow-[0_1px_0_rgba(13,31,24,0.02)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold text-forest-500">{item.time}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", status.className)}>
                                {status.label}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] font-semibold text-ink">{item.title}</p>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-ink/50">{item.description}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-50 text-forest-700">
                    <TrendingDown size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">Lower-emission alternatives</h2>
                    <p className="text-[10px] text-ink/40">
                      From {result.alternatives.currentLabel}. Estimates, not measured local AQI changes.
                    </p>
                  </div>
                </div>

                {logMessage ? (
                  <div className="mt-3">
                    <Notice tone="success" title="Saved to My Impact">
                      {logMessage}{" "}
                      <Link to="/impact" className="font-semibold text-emerald-800 underline underline-offset-2">
                        View my impact
                      </Link>
                    </Notice>
                  </div>
                ) : null}

                {result.alternatives.options.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-forest-50/60 px-3 py-3 text-xs text-ink/50">
                    No lower-emission swap is available for this commute. Your current mode may already be
                    the lowest-carbon option.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {result.alternatives.options.map((option) => {
                      const logged = loggedIds.includes(option.id);
                      return (
                        <div
                          key={option.id}
                          className="flex flex-col rounded-2xl border border-forest-100 bg-forest-50/30 p-3.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-semibold text-ink">{option.title}</h3>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-forest-700 ring-1 ring-forest-100">
                              −{option.estimatedCo2SavedKgPerWeek.toFixed(1)} kg/wk
                            </span>
                          </div>
                          <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-ink/50">
                            {option.description}
                          </p>
                          <p className="mt-2 text-[9px] leading-relaxed text-ink/30">{option.assumptions}</p>
                          <Button
                            size="sm"
                            variant={logged ? "secondary" : "primary"}
                            className="mt-3 self-start"
                            onClick={() =>
                              logSwap(
                                option.id,
                                option.title,
                                option.logActivityType,
                                option.dailyCo2SavedKg,
                              )
                            }
                            disabled={logged}
                            icon={
                              logged ? (
                                <Check size={13} aria-hidden="true" />
                              ) : (
                                <Leaf size={13} aria-hidden="true" />
                              )
                            }
                          >
                            {logged ? "Logged in My Impact" : "Log this swap"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-3 text-[9.5px] leading-relaxed text-ink/30">{result.alternatives.note}</p>
              </Card>

              <Notice tone="info" title="How this plan is made">
                Rules combine your profile with the live hourly forecast. {result.disclaimer}
              </Notice>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
