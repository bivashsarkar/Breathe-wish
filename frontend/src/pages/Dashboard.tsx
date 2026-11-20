import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  Wind,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Notice from "../components/common/Notice";
import ErrorState from "../components/common/ErrorState";
import AQICard from "../components/dashboard/AQICard";
import WeatherCard from "../components/dashboard/WeatherCard";
import PollutantCard from "../components/dashboard/PollutantCard";
import PollutionChart from "../components/dashboard/PollutionChart";
import ForecastStrip from "../components/dashboard/ForecastStrip";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import { useAir } from "../context/AirContext";
import { greeting } from "../lib/format";
import { cn } from "../lib/cn";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading live air quality">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton h-9 w-full max-w-lg rounded-xl" />
        <div className="skeleton h-4 w-full max-w-xl rounded-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="skeleton h-[390px] rounded-3xl xl:col-span-7" />
        <div className="skeleton h-[390px] rounded-3xl xl:col-span-5" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-[128px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="skeleton h-[380px] rounded-3xl xl:col-span-8" />
        <div className="skeleton h-[380px] rounded-3xl xl:col-span-4" />
      </div>
    </div>
  );
}

function InsightStrip({ air }: { air: NonNullable<ReturnType<typeof useAir>["air"]> }) {
  const best = air.insights.bestOutdoorWindow;
  const trend = air.insights.trend;
  const TrendIcon = trend === "improving" ? TrendingDown : trend === "worsening" ? TrendingUp : Minus;
  const trendLabel =
    trend === "improving" ? "Improving tomorrow" : trend === "worsening" ? "Worsening tomorrow" : "Holding steady";
  const trendTone =
    trend === "improving" ? "text-emerald-600" : trend === "worsening" ? "text-red-600" : "text-ink/45";

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-forest-700">
          <Clock size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Best time outside</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {best ? `${best.startLabel} – ${best.endLabel}` : "No clean window"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink/45">
            {best ? `Average AQI ${Math.round(best.averageAqi)}` : "Keep outdoor time short"}
          </p>
        </div>
      </Card>
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Wind size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Ventilation</p>
          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-ink">
            {air.insights.ventilationAdvice}
          </p>
        </div>
      </Card>
      <Card className="flex items-start gap-3 p-4">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50", trendTone)}>
          <TrendIcon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Short-term trend</p>
          <p className={cn("mt-1 text-sm font-semibold", trendTone)}>{trendLabel}</p>
          <p className="mt-0.5 text-[11px] text-ink/45">Based on the daily forecast</p>
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { air, loading, error, refresh, refreshing, demoMode, setDemoMode, location, openPicker } = useAir();

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow={`${greeting()} · ${location.name}`}
        title="Breathe easier, one informed choice at a time."
        description="Live air quality, weather and family-safe guidance for your neighbourhood — explained in plain language."
        actions={
          <>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-forest-100 bg-white px-3.5 text-sm font-semibold text-ink/70 shadow-sm transition hover:border-mint-300 hover:text-forest-900"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Change location
            </button>
            <Link
              to="/assistant"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800"
            >
              <Sparkles size={15} aria-hidden="true" />
              Ask BreatheWise
            </Link>
            <Link
              to="/planner"
              className="hidden h-10 items-center gap-2 rounded-xl border border-forest-100 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition hover:border-mint-300 sm:inline-flex"
            >
              <CalendarDays size={15} aria-hidden="true" />
              Plan my day
            </Link>
          </>
        }
      />

      {loading ? <DashboardSkeleton /> : null}

      {!loading && error && !air ? (
        <Card className="p-2">
          <ErrorState
            message={error}
            onRetry={() => void refresh()}
            onDemo={() => setDemoMode(true)}
            retrying={refreshing}
          />
          <div className="px-4 pb-4 pt-2 text-xs leading-relaxed text-ink/40">
            No fallback values are shown as live. You can retry, or explicitly switch to the labelled demo
            dataset to explore every feature.
          </div>
        </Card>
      ) : null}

      {air ? (
        <>
          {error ? (
            <Notice tone="warning" title="Showing the last successful reading">
              {error} Use refresh to try again.
            </Notice>
          ) : null}

          {air.meta.isDemo ? (
            <Notice tone="warning" title="Demo dataset — not live measurements">
              {air.meta.notice ||
                "You are viewing clearly labelled illustrative values. Switch off demo mode in the location picker to return to Open-Meteo live data."}
              <button
                type="button"
                onClick={() => setDemoMode(false)}
                className="ml-1 font-semibold text-amber-800 underline underline-offset-2"
              >
                Return to live data
              </button>
            </Notice>
          ) : null}

          {air.meta.warnings.length > 0 ? (
            <Notice tone="info" title="Partial data">
              {air.meta.warnings.join(" ")}
            </Notice>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-12 xl:gap-6">
            <div className="xl:col-span-7">
              <AQICard air={air} />
            </div>
            <div className="xl:col-span-5">
              <WeatherCard weather={air.current.weather} />
            </div>
          </div>

          <InsightStrip air={air} />

          <section aria-labelledby="pollutants-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Pollutant breakdown</p>
                <h2 id="pollutants-heading" className="mt-1 text-lg font-semibold">
                  What is in the air
                </h2>
              </div>
              <p className="hidden text-[11px] text-ink/35 sm:block">
                Bars show % of WHO 24-hour guideline values
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Object.values(air.current.pollutants).map((pollutant) => (
                <PollutantCard key={pollutant.key} pollutant={pollutant} />
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-12 xl:gap-6">
            <div className="xl:col-span-8">
              <PollutionChart hourly={air.hourly} />
            </div>
            <div className="xl:col-span-4">
              <ForecastStrip daily={air.daily} />
            </div>
          </div>

          <section aria-labelledby="recommendations-heading">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Personalised today</p>
                <h2 id="recommendations-heading" className="mt-1 text-lg font-semibold">
                  Your clean-air action plan
                </h2>
              </div>
              <Link
                to="/assistant"
                className="inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-forest-800"
              >
                Ask a follow-up question
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {air.recommendations.map((recommendation, index) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  index={index}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-forest-100/70 bg-white/60 px-4 py-3 text-[11px] leading-relaxed text-ink/40 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {air.meta.attribution} Pollutant categories use US EPA breakpoints; guideline comparisons use
              WHO 2021 values.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void refresh()}
              loading={refreshing}
              className="self-start text-[11px] sm:self-auto"
            >
              Refresh now
            </Button>
          </div>
        </>
      ) : null}

      {!loading && !error && !air && demoMode ? (
        <ErrorState
          title="Demo data is on, but nothing loaded"
          message="The request did not complete. Refresh the page or return to live data."
          onRetry={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
