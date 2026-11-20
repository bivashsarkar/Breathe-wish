import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Leaf } from "lucide-react";

import AppIcon from "../common/AppIcon";
import { cn } from "../../lib/cn";
import type { Recommendation } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health",
  travel: "Travel",
  home: "Home",
  indoor: "Indoor air",
  eco: "Environment",
  outdoor: "Outdoors",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-red-100",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  low: "bg-forest-50 text-forest-700 ring-1 ring-forest-100",
};

export default function RecommendationCard({
  recommendation,
  index = 0,
}: {
  recommendation: Recommendation;
  index?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col rounded-2xl border border-forest-100/80 bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-mint-200 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700 transition group-hover:bg-mint-50 group-hover:text-forest-900">
          <AppIcon name={recommendation.icon} size={19} />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
            PRIORITY_STYLES[recommendation.priority] ?? PRIORITY_STYLES.low,
          )}
        >
          {recommendation.priority}
        </span>
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-500">
        {CATEGORY_LABELS[recommendation.category] ?? recommendation.category}
      </p>
      <h3 className="mt-1 text-[15px] font-semibold leading-snug text-ink">{recommendation.title}</h3>
      <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-ink/55">{recommendation.description}</p>

      <div className="mt-4 rounded-xl bg-forest-50/60 p-3">
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-forest-600">
          <Leaf size={10} aria-hidden="true" />
          Why it matters
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink/50">{recommendation.impact}</p>
      </div>

      <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-forest-500 opacity-0 transition group-hover:opacity-100">
        Guidance grounded in today's data
        <ArrowRight size={11} aria-hidden="true" />
      </div>
    </motion.article>
  );
}
