import { Info } from "lucide-react";

import { pollutantTone } from "../../lib/aqi";
import { formatNumber } from "../../lib/format";
import { cn } from "../../lib/cn";
import type { Pollutant } from "../../types";

export default function PollutantCard({ pollutant }: { pollutant: Pollutant }) {
  const tone = pollutantTone(pollutant.percentOfGuideline);
  const width = Math.max(3, Math.min(100, pollutant.percentOfGuideline ?? 3));
  const percentLabel =
    pollutant.percentOfGuideline === null
      ? "No guideline comparison"
      : `${Math.round(pollutant.percentOfGuideline)}% of WHO 24-hour guideline`;
  const aboveGuideline = (pollutant.percentOfGuideline ?? 0) > 100;

  return (
    <div
      className="group rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-mint-200 hover:shadow-lift"
      title={pollutant.description}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">{pollutant.label}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className={cn("text-[26px] font-semibold leading-none tracking-[-0.04em]", tone.text)}>
              {formatNumber(pollutant.displayValue, pollutant.key === "co" ? 2 : 1)}
            </span>
            <span className="text-[10px] font-medium text-ink/35">{pollutant.displayUnit}</span>
          </p>
        </div>
        <span className="text-ink/20 transition group-hover:text-ink/35">
          <Info size={13} aria-hidden="true" />
        </span>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-forest-50"
        role="img"
        aria-label={`${pollutant.label}: ${percentLabel}`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone.bar)}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={cn("text-[10px] font-medium", aboveGuideline ? tone.text : "text-ink/40")}>
          {percentLabel}
        </p>
        <p className="shrink-0 text-[9px] text-ink/30">
          {pollutant.guideline} {pollutant.guidelineUnit}
        </p>
      </div>
    </div>
  );
}
