import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "mint" | "amber" | "red" | "forest" | "purple";
  dot?: boolean;
}

const TONES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  mint: "bg-mint-50 text-forest-700 ring-1 ring-mint-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  forest: "bg-forest-900 text-mint-100 ring-1 ring-forest-800",
  purple: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
};

export default function Badge({ children, className, tone = "neutral", dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
