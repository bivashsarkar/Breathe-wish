import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Database, MapPin, Menu, RefreshCw } from "lucide-react";

import { useAir } from "../../context/AirContext";
import { formatDateLong, formatUpdated } from "../../lib/format";
import { cn } from "../../lib/cn";

const PAGE_META: Record<string, { title: string; section: string }> = {
  "/": { title: "Air quality overview", section: "Dashboard" },
  "/assistant": { title: "Environmental assistant", section: "AI Assistant" },
  "/planner": { title: "Smart daily plan", section: "Daily Planner" },
  "/family": { title: "Family protection", section: "Family Protection" },
  "/indoor": { title: "Indoor air", section: "Indoor Protection" },
  "/impact": { title: "Environmental impact", section: "My Impact" },
};

export default function Navbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { pathname } = useLocation();
  const { location, openPicker, refresh, refreshing, lastUpdated, demoMode, air } = useAir();
  const [, setTick] = useState(0);
  const meta = PAGE_META[pathname] ?? { title: "BreatheWise", section: "Workspace" };

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-forest-100/70 bg-cream/85 backdrop-blur-xl">
      <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-forest-100 bg-white text-forest-800 shadow-sm transition hover:border-mint-300 lg:hidden"
          >
            <Menu size={19} aria-hidden="true" />
          </button>

          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[11px] font-medium text-ink/40">{formatDateLong()}</p>
            <p className="truncate text-sm font-semibold text-ink">{meta.title}</p>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <span className="text-sm font-bold tracking-tight text-forest-950">BreatheWise</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="hidden items-center gap-2 md:flex" aria-live="polite">
            {demoMode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                <Database size={11} aria-hidden="true" />
                Demo data
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink/45 ring-1 ring-forest-100">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    air ? "bg-emerald-500" : "bg-amber-400",
                  )}
                  aria-hidden="true"
                />
                {air ? `Updated ${formatUpdated(lastUpdated)}` : "Connecting"}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={openPicker}
            className="flex h-10 max-w-[190px] items-center gap-2 rounded-xl border border-forest-100 bg-white px-3 text-sm font-medium text-ink/75 shadow-sm transition hover:border-mint-300 hover:text-forest-900 sm:max-w-[240px]"
            aria-label={`Location: ${location.label}. Change location`}
          >
            <MapPin size={15} className="shrink-0 text-forest-600" aria-hidden="true" />
            <span className="truncate">{location.name}</span>
            <ChevronDown size={14} className="shrink-0 text-ink/35" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing environmental data" : "Refresh environmental data"}
            title="Refresh live data"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-forest-100 bg-white text-ink/55 shadow-sm transition hover:border-mint-300 hover:text-forest-800 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={cn(refreshing && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
