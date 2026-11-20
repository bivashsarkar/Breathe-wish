import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "../../lib/cn";

type Tone = "info" | "warning" | "success" | "danger";

const TONES: Record<Tone, { wrapper: string; icon: string; title: string; body: string }> = {
  info: {
    wrapper: "border-sky-100 bg-sky-50/70",
    icon: "text-sky-600",
    title: "text-sky-900",
    body: "text-sky-900/70",
  },
  warning: {
    wrapper: "border-amber-200/70 bg-amber-50/80",
    icon: "text-amber-600",
    title: "text-amber-900",
    body: "text-amber-900/75",
  },
  success: {
    wrapper: "border-emerald-100 bg-emerald-50/70",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    body: "text-emerald-900/70",
  },
  danger: {
    wrapper: "border-red-100 bg-red-50/70",
    icon: "text-red-600",
    title: "text-red-900",
    body: "text-red-900/70",
  },
};

const ICONS = {
  info: Info,
  warning: TriangleAlert,
  success: CircleCheck,
  danger: CircleAlert,
};

interface NoticeProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export default function Notice({ tone = "info", title, children, className, icon }: NoticeProps) {
  const Icon = ICONS[tone];
  const styles = TONES[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm",
        styles.wrapper,
        className,
      )}
    >
      <span className={cn("mt-0.5 shrink-0", styles.icon)}>
        {icon ?? <Icon size={16} aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        {title ? <p className={cn("font-semibold", styles.title)}>{title}</p> : null}
        <div className={cn("leading-relaxed", styles.body, title ? "mt-0.5" : "")}>{children}</div>
      </div>
    </div>
  );
}
