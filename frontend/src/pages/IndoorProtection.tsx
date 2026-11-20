import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Clock,
  Home,
  Shield,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Notice from "../components/common/Notice";
import ErrorState from "../components/common/ErrorState";
import AppIcon from "../components/common/AppIcon";
import { useAir } from "../context/AirContext";
import { getIndoorAdvice } from "../services/indoorService";
import { getApiErrorMessage } from "../services/api";
import { readStored, writeStored } from "../lib/storage";
import { formatAqi, formatNumber, formatUpdated, todayIso } from "../lib/format";
import { styleForCategory } from "../lib/aqi";
import { cn } from "../lib/cn";
import type { IndoorAdvice } from "../types";

const CHECKLIST_KEY = "breathew.indoor.checklist.v1";

interface ChecklistState {
  date: string;
  checked: string[];
}

function loadChecklist(): string[] {
  const stored = readStored<ChecklistState | null>(CHECKLIST_KEY, null);
  if (!stored || stored.date !== todayIso() || !Array.isArray(stored.checked)) return [];
  return stored.checked.filter((value): value is string => typeof value === "string");
}

export default function IndoorProtection() {
  const { air, location, demoMode } = useAir();
  const [areaSqm, setAreaSqm] = useState(30);
  const [hasPurifier, setHasPurifier] = useState(false);
  const [applied, setApplied] = useState({ areaSqm: 30, hasPurifier: false });
  const [advice, setAdvice] = useState<IndoorAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checked, setChecked] = useState<string[]>(loadChecklist);
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    writeStored<ChecklistState>(CHECKLIST_KEY, { date: todayIso(), checked });
  }, [checked]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    getIndoorAdvice(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.label || location.name,
        areaSqm: applied.areaSqm,
        hasPurifier: applied.hasPurifier,
        demo: demoMode,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setAdvice(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    applied.areaSqm,
    applied.hasPurifier,
    demoMode,
    location.label,
    location.latitude,
    location.longitude,
    refreshKey,
  ]);

  const applySettings = () => {
    if (!Number.isFinite(areaSqm) || areaSqm < 5 || areaSqm > 200) {
      setFormError("Room area must be between 5 and 200 m².");
      return;
    }
    setFormError(null);
    setApplied({ areaSqm, hasPurifier });
  };

  const toggleChecklist = (id: string) => {
    setChecked((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const checklistLength = advice?.checklist.length ?? 6;
  const progress = Math.round((checked.length / checklistLength) * 100);
  const categoryStyle = styleForCategory(advice?.current.category ?? air?.current.category);
  const status = advice?.ventilation.status ?? "closed";
  const statusMeta =
    status === "open"
      ? {
          icon: Wind,
          wrapper: "from-emerald-600 to-forest-700",
          label: "Ventilate now",
          chip: "bg-white/15 text-white",
        }
      : status === "brief"
        ? {
            icon: Clock,
            wrapper: "from-amber-500 to-orange-600",
            label: "Brief ventilation",
            chip: "bg-white/15 text-white",
          }
        : {
            icon: Shield,
            wrapper: "from-forest-800 to-forest-950",
            label: "Keep windows closed",
            chip: "bg-white/15 text-white",
          };
  const StatusIcon = statusMeta.icon;
  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Indoor air protection"
        title="Make the air inside the safest air you have."
        description="Ventilation timing, affordable source control and right-sized filtration — all based on outdoor conditions, without expensive gadgets."
        actions={
          <>
            <Badge tone={advice?.current.isDemo ? "amber" : "mint"} dot>
              {advice
                ? `Outdoor AQI ${formatAqi(advice.current.aqi)} · ${advice.current.category.label}`
                : "Loading outdoor conditions"}
            </Badge>
            <Link
              to="/"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-forest-100 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition hover:border-mint-300"
            >
              <Wind size={15} aria-hidden="true" />
              Hourly forecast
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {advice?.current.isDemo ? (
        <Notice tone="warning" title="Demo dataset in use">
          Indoor guidance is based on clearly labelled illustrative values, not live measurements.
        </Notice>
      ) : null}

      {error ? (
        <ErrorState
          title="Indoor guidance is unavailable"
          message={error}
          onRetry={() => setRefreshKey((value) => value + 1)}
          retrying={loading}
        />
      ) : null}

      {loading && !advice ? (
        <div className="grid gap-5 xl:grid-cols-12" aria-busy="true" aria-label="Loading indoor guidance">
          <div className="skeleton h-[320px] rounded-3xl xl:col-span-8" />
          <div className="skeleton h-[320px] rounded-3xl xl:col-span-4" />
          <div className="skeleton h-[420px] rounded-3xl xl:col-span-8" />
          <div className="skeleton h-[420px] rounded-3xl xl:col-span-4" />
        </div>
      ) : null}

      {advice ? (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-8">
            <section
              className={cn(
                "relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-lift sm:p-6",
                statusMeta.wrapper,
              )}
              aria-labelledby="ventilation-heading"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15">
                      <StatusIcon size={21} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Ventilation guidance
                      </p>
                      <h2 id="ventilation-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                        {advice.ventilation.headline}
                      </h2>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", statusMeta.chip)}>
                    {statusMeta.label}
                  </span>
                </div>

                <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/70">
                  {advice.ventilation.advice}
                </p>

                {advice.ventilation.windows.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {advice.ventilation.windows.map((window, index) => (
                      <div
                        key={`${window.start}-${index}`}
                        className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-medium text-white/85 ring-1 ring-white/10"
                      >
                        <span className="font-semibold text-white">
                          {window.startLabel}–{window.endLabel}
                        </span>
                        <span className="ml-1.5 text-white/50">avg AQI {Math.round(window.averageAqi)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-[10px] text-white/50">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={11} aria-hidden="true" />
                    Updated {formatUpdated(advice.generatedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wind size={11} aria-hidden="true" />
                    Outdoor PM2.5{" "}
                    {air?.current.pollutants.pm2_5
                      ? `${formatNumber(air.current.pollutants.pm2_5.displayValue, 1)} µg/m³`
                      : "unavailable"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Home size={11} aria-hidden="true" />
                    {applied.areaSqm} m² home profile
                  </span>
                </div>
              </div>
            </section>

            <Card className="p-5 sm:p-6" aria-labelledby="purifier-heading">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Purifier sizing</p>
                  <h2 id="purifier-heading" className="mt-1 text-lg font-semibold">
                    The right filter for your room
                  </h2>
                  <p className="mt-1 max-w-lg text-xs leading-relaxed text-ink/45">
                    CADR (clean air delivery rate) matters more than marketing claims. We calculate a
                    practical range for 3–5 air changes per hour.
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-forest-700">
                  <Wind size={18} aria-hidden="true" />
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="indoor-area" className="field-label">
                      Room area
                    </label>
                    <div className="relative">
                      <input
                        id="indoor-area"
                        type="number"
                        min={5}
                        max={200}
                        step={1}
                        className="field pr-10"
                        value={areaSqm}
                        onChange={(event) => setAreaSqm(Number(event.target.value))}
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink/35">
                        m²
                      </span>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-xl border border-forest-100 px-3 py-2.5 text-[11px] font-medium text-ink/60 transition hover:border-mint-200">
                    <input
                      type="checkbox"
                      checked={hasPurifier}
                      onChange={(event) => setHasPurifier(event.target.checked)}
                      className="h-4 w-4 rounded border-forest-300 accent-forest-700"
                    />
                    I already own one
                  </label>
                </div>
                <Button variant="secondary" onClick={applySettings} className="sm:mb-0">
                  Update guidance
                </Button>
              </div>
              {formError ? (
                <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">
                  {formError}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
                <div className="rounded-2xl bg-forest-900 p-4 text-white">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mint-200/55">
                    Target CADR
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                    {advice.purifier.cadrMin}–{advice.purifier.cadrMax}
                    <span className="ml-1 text-[10px] font-medium text-mint-200/50">m³/h</span>
                  </p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-mint-100/50">
                    {advice.purifier.recommended
                      ? "Recommended while outdoor pollution is elevated."
                      : "Below the WHO guideline, but useful if you are sensitive to particles."}
                  </p>
                </div>
                <ul className="space-y-2">
                  {advice.purifier.notes.map((note, index) => (
                    <li key={index} className="flex items-start gap-2 text-[11px] leading-relaxed text-ink/50">
                      <Check size={12} className="mt-0.5 shrink-0 text-mint-600" aria-hidden="true" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <section aria-labelledby="indoor-tips-heading">
              <div className="mb-3">
                <p className="eyebrow">Affordable actions</p>
                <h2 id="indoor-tips-heading" className="mt-1 text-lg font-semibold">
                  Indoor air, improved step by step
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {advice.tips.map((tip) => (
                  <article key={tip.id} className="rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                        <AppIcon name={tip.icon} size={17} />
                      </span>
                      <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-forest-600">
                        {tip.cost === "free" ? "Free" : tip.cost === "low" ? "Low cost" : "Investment"}
                      </span>
                    </div>
                    <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-forest-500">
                      {tip.category}
                    </p>
                    <h3 className="mt-1 text-[13px] font-semibold text-ink">{tip.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink/50">{tip.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-4 xl:col-span-4">
            <Card className="p-5" aria-labelledby="checklist-heading">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Daily checklist</p>
                  <h2 id="checklist-heading" className="mt-1 text-lg font-semibold">
                    Today's clean-air routine
                  </h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-50 text-forest-800">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-medium text-ink/40">
                  <span>
                    {checked.length} of {checklistLength} complete
                  </span>
                  <span className="font-bold text-forest-700">{progress}%</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest-50"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Indoor checklist progress"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mint-400 to-forest-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-1">
                {advice.checklist.map((item) => {
                  const isChecked = checked.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition",
                        isChecked ? "bg-mint-50/70" : "hover:bg-forest-50/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecklist(item.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-forest-300 accent-forest-700"
                      />
                      <span>
                        <span
                          className={cn(
                            "block text-[11.5px] font-medium leading-snug",
                            isChecked ? "text-forest-800 line-through decoration-forest-300" : "text-ink/65",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-[9.5px] leading-relaxed text-ink/35">
                          {item.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[9.5px] text-ink/30">Resets automatically tomorrow.</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setChecked([])}
                  disabled={checked.length === 0}
                >
                  Reset
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <p className="eyebrow">Outdoor context</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-4xl font-semibold tracking-[-0.05em] text-ink">
                    {advice.current.aqi === null ? "—" : Math.round(advice.current.aqi)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink/40">{advice.location.name}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold uppercase", categoryStyle.badge)}>
                  {advice.current.category.label}
                </span>
              </div>
              <div className="mt-4 space-y-2 border-t border-forest-50 pt-3 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink/40">Outdoor PM2.5</span>
                  <span className="font-semibold text-ink">
                    {advice.current.aqi === null
                      ? "—"
                      : `${formatNumber(air?.current.pollutants.pm2_5?.displayValue ?? null, 1)} µg/m³`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink/40">Weather</span>
                  <span className="font-semibold text-ink">
                    {advice.current.weather
                      ? `${Math.round(advice.current.weather.temperature ?? 0)}°C · ${advice.current.weather.condition}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink/40">Purifier</span>
                  <span className="font-semibold text-ink">
                    {advice.purifier.hasPurifier ? "Owned · maintain it" : "Recommended when AQI is high"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[9.5px] leading-relaxed text-ink/30">{advice.current.source}</p>
            </Card>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-[10px] leading-relaxed text-amber-900/70">
              <p className="flex items-center gap-1.5 font-semibold text-amber-900">
                <Sparkles size={12} aria-hidden="true" />
                Safety note
              </p>
              <p className="mt-1.5">{advice.disclaimer}</p>
              <p className="mt-1.5">
                Never use ozone generators. DIY filter boxes must not overheat and should never be left
                unattended.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
