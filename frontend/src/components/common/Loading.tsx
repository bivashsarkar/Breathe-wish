import { LoaderCircle, Wind } from "lucide-react";

import { cn } from "../../lib/cn";

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <LoaderCircle
      size={size}
      className={cn("animate-spin text-forest-500", className)}
      aria-hidden="true"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden="true" />;
}

export default function Loading({ label = "Loading live conditions" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-900 text-mint-300 shadow-lift">
        <Wind size={24} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-mint-400 ring-4 ring-cream" />
      </div>
      <p className="text-sm font-medium text-ink/55">{label}</p>
    </div>
  );
}
